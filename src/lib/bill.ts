import { z } from "zod";
import { toPaise } from "./money";

// ---------------------------------------------------------------------------
// 1. What Claude must send back (amounts in rupees, exactly as printed).
//    This zod schema is used twice: to tell Claude the exact JSON shape, and
//    to validate the answer before we trust it.
// ---------------------------------------------------------------------------

const LineSchema = z.object({
  label: z.string().describe("Text printed on the bill, e.g. 'CGST @2.5%'"),
  amount: z.number().describe("Amount in rupees as a positive number"),
});

export const ParsedBillSchema = z.object({
  isBill: z.boolean().describe("false if the photo is not a restaurant/shop bill or receipt"),
  readable: z
    .boolean()
    .describe("false if the bill is too blurry, dark, cut off or unclear to read the amounts reliably"),
  problem: z.string().describe("If isBill or readable is false, a short reason. Otherwise an empty string."),
  restaurantName: z.string().describe("Restaurant name if printed, else an empty string"),
  items: z
    .array(
      z.object({
        name: z.string(),
        quantity: z.number().describe("Quantity ordered (1 if not printed)"),
        price: z.number().describe("Line total in rupees for this item (quantity x rate), as printed"),
      }),
    )
    .describe("Every ordered item with a non-zero amount. Skip zero-priced modifier/flavour lines."),
  subtotal: z.number().describe("Printed subtotal before taxes/charges (0 if not printed)"),
  taxes: z.array(LineSchema).describe("Each tax line separately: CGST, SGST, IGST, VAT, etc."),
  serviceCharge: z.number().describe("Service charge in rupees (0 if none)"),
  otherCharges: z
    .array(LineSchema)
    .describe("Any other added charges that are not tax or service charge (packing, cess, etc.)"),
  discounts: z.array(LineSchema).describe("Each discount as a POSITIVE amount"),
  roundOff: z.number().describe("Round-off adjustment with its sign, e.g. -0.16 (0 if none)"),
  grandTotal: z.number().describe("Final amount payable printed on the bill"),
});

export type ParsedBill = z.infer<typeof ParsedBillSchema>;

// ---------------------------------------------------------------------------
// 2. The bill the app works with: every amount in integer paise.
// ---------------------------------------------------------------------------

export interface BillItem {
  id: string;
  name: string;
  quantity: number;
  pricePaise: number;
}

export interface BillLine {
  id: string;
  label: string;
  amountPaise: number;
}

export interface Bill {
  restaurantName: string;
  items: BillItem[];
  subtotalPaise: number;
  taxes: BillLine[];
  serviceChargePaise: number;
  otherCharges: BillLine[];
  discounts: BillLine[];
  roundOffPaise: number;
  grandTotalPaise: number;
}

let counter = 0;
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}

/** Turn Claude's rupee answer into the paise-based Bill the app uses. */
export function toBill(parsed: ParsedBill): Bill {
  const line = (l: { label: string; amount: number }): BillLine => ({
    id: newId("line"),
    label: l.label,
    amountPaise: Math.abs(toPaise(l.amount)),
  });
  return {
    restaurantName: parsed.restaurantName,
    items: parsed.items
      .filter((i) => toPaise(i.price) !== 0)
      .map((i) => ({
        id: newId("item"),
        name: i.name,
        quantity: i.quantity > 0 ? i.quantity : 1,
        pricePaise: toPaise(i.price),
      })),
    subtotalPaise: toPaise(parsed.subtotal),
    taxes: parsed.taxes.map(line),
    serviceChargePaise: Math.abs(toPaise(parsed.serviceCharge)),
    otherCharges: parsed.otherCharges.map(line),
    discounts: parsed.discounts.map(line),
    roundOffPaise: toPaise(parsed.roundOff),
    grandTotalPaise: toPaise(parsed.grandTotal),
  };
}

// ---------------------------------------------------------------------------
// 3. Sanity checks: does the bill add up?
// ---------------------------------------------------------------------------

const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function itemsTotalPaise(bill: Bill): number {
  return sum(bill.items.map((i) => i.pricePaise));
}

/** Items + taxes + charges - discounts + round off. */
export function calculatedTotalPaise(bill: Bill): number {
  return (
    itemsTotalPaise(bill) +
    sum(bill.taxes.map((t) => t.amountPaise)) +
    bill.serviceChargePaise +
    sum(bill.otherCharges.map((c) => c.amountPaise)) -
    sum(bill.discounts.map((d) => d.amountPaise)) +
    bill.roundOffPaise
  );
}

export interface BillCheck {
  itemsMatchSubtotal: boolean;
  totalMatchesGrandTotal: boolean;
  itemsTotalPaise: number;
  calculatedTotalPaise: number;
  warnings: string[];
}

// Bills sometimes round each tax line, so allow a 1-rupee wiggle on the total.
const TOTAL_TOLERANCE_PAISE = 100;

export function checkBill(bill: Bill): BillCheck {
  const items = itemsTotalPaise(bill);
  const calc = calculatedTotalPaise(bill);
  const warnings: string[] = [];

  // A subtotal of 0 means none was printed, so there is nothing to compare.
  const itemsMatchSubtotal = bill.subtotalPaise === 0 || items === bill.subtotalPaise;
  if (!itemsMatchSubtotal) {
    warnings.push("The items don't add up to the bill's subtotal. Check the item prices.");
  }
  const totalMatchesGrandTotal = Math.abs(calc - bill.grandTotalPaise) <= TOTAL_TOLERANCE_PAISE;
  if (!totalMatchesGrandTotal) {
    warnings.push("Items, taxes and charges don't add up to the grand total. Check the tax and discount lines.");
  }
  if (bill.items.length === 0) {
    warnings.push("No items were found on this bill. Add them by hand.");
  }
  return {
    itemsMatchSubtotal,
    totalMatchesGrandTotal,
    itemsTotalPaise: items,
    calculatedTotalPaise: calc,
    warnings,
  };
}
