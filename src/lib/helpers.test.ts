import { describe, expect, it } from "vitest";
import { checkBill, toBill, type ParsedBill } from "./bill";
import { sniffImageType } from "./imageCheck";
import { formatRupees, paiseToRupeeString, parseRupeeInput, toPaise } from "./money";
import { rateLimit } from "./rateLimit";
import { buildUpiLink, buildWhatsAppLink, isValidUpiId } from "./upi";

describe("money", () => {
  it("converts rupees to paise without floating point errors", () => {
    expect(toPaise(0.1 + 0.2)).toBe(30);
    expect(toPaise(113.58)).toBe(11358);
    expect(toPaise(-0.16)).toBe(-16);
  });
  it("formats paise", () => {
    expect(paiseToRupeeString(5)).toBe("0.05");
    expect(paiseToRupeeString(477000)).toBe("4770.00");
    expect(formatRupees(12345678)).toBe("₹1,23,456.78");
    expect(formatRupees(-48)).toBe("-₹0.48");
  });
  it("parses typed amounts", () => {
    expect(parseRupeeInput("₹1,234.5")).toBe(123450);
    expect(parseRupeeInput("abc")).toBeNull();
    expect(parseRupeeInput("1.234")).toBeNull();
    expect(parseRupeeInput("-0.16")).toBe(-16);
  });
});

const sampleParsed: ParsedBill = {
  isBill: true,
  readable: true,
  problem: "",
  restaurantName: "Theo Cafe",
  items: [{ name: "Mint Lemonade", quantity: 2, price: 358 }],
  subtotal: 358,
  taxes: [
    { label: "CGST 2.5%", amount: 8.5 },
    { label: "SGST 2.5%", amount: 8.5 },
  ],
  serviceCharge: 0,
  otherCharges: [{ label: "Gas Crisis Charge 5%", amount: 17.01 }],
  discounts: [{ label: "Discount 5%", amount: 17.9 }],
  roundOff: -0.11,
  grandTotal: 374,
};

describe("bill checks", () => {
  it("a bill that adds up has no warnings", () => {
    const check = checkBill(toBill(sampleParsed));
    expect(check.calculatedTotalPaise).toBe(37400);
    expect(check.warnings).toEqual([]);
  });
  it("warns when items don't match the subtotal", () => {
    const check = checkBill(toBill({ ...sampleParsed, items: [{ name: "Mint Lemonade", quantity: 2, price: 179 }] }));
    expect(check.itemsMatchSubtotal).toBe(false);
    expect(check.totalMatchesGrandTotal).toBe(false);
    expect(check.warnings.length).toBe(2);
  });
  it("drops zero-priced modifier lines", () => {
    const bill = toBill({ ...sampleParsed, items: [...sampleParsed.items, { name: "SPICY GARLIC", quantity: 1, price: 0 }] });
    expect(bill.items.length).toBe(1);
  });
});

describe("UPI links", () => {
  it("validates UPI IDs", () => {
    expect(isValidUpiId("arjun@okicici")).toBe(true);
    expect(isValidUpiId("9876543210@ybl")).toBe(true);
    expect(isValidUpiId("not an id")).toBe(false);
    expect(isValidUpiId("@ybl")).toBe(false);
  });
  it("builds a correctly encoded upi:// link", () => {
    const link = buildUpiLink({ upiId: "arjun@okicici", payeeName: "Arjun K", amountPaise: 182476, note: "Splitly - Plan B" });
    expect(link).toBe("upi://pay?pa=arjun@okicici&pn=Arjun%20K&am=1824.76&cu=INR&tn=Splitly%20-%20Plan%20B");
  });
  it("builds a WhatsApp link containing the amount and UPI link", () => {
    const wa = buildWhatsAppLink({ personName: "Riya", amountPaise: 18700, upiLink: "upi://pay?pa=a%40b", payerName: "Arjun", place: "Theo Cafe" });
    expect(wa.startsWith("https://wa.me/?text=")).toBe(true);
    const text = decodeURIComponent(wa.split("text=")[1]);
    expect(text).toContain("₹187.00");
    expect(text).toContain("upi://pay?pa=a%40b");
  });
});

describe("server guards", () => {
  it("recognises real image bytes and rejects others", () => {
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffImageType(new TextEncoder().encode("....ftypheic...."))).toBe("image/heic");
    expect(sniffImageType(new TextEncoder().encode("<html>hello</html>"))).toBeNull();
  });
  it("rate limits after 10 requests a minute per IP", () => {
    const now = 1_000_000;
    for (let i = 0; i < 10; i++) expect(rateLimit("1.2.3.4", 10, 60_000, now + i).ok).toBe(true);
    expect(rateLimit("1.2.3.4", 10, 60_000, now + 10).ok).toBe(false);
    expect(rateLimit("5.6.7.8", 10, 60_000, now + 10).ok).toBe(true);
    expect(rateLimit("1.2.3.4", 10, 60_000, now + 61_000).ok).toBe(true);
  });
});
