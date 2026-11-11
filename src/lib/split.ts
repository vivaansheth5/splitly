// The split maths. Everything is in integer paise.
//
// Rule: each person pays for the items they had. An item shared by several
// people is split evenly between them. Everything else on the bill (taxes,
// service charge, other charges, discounts, round off) is shared in proportion
// to each person's item subtotal. Any paise left over from rounding go to the
// payer, so the shares always add up to the bill total exactly.

export interface SplitItem {
  pricePaise: number;
  /** IDs of the people sharing this item. Empty = nobody picked it (payer covers it). */
  sharedBy: string[];
}

export interface SplitInput {
  /** Everyone at the table, including the payer. */
  people: string[];
  /** The person who paid the restaurant. Receives rounding leftovers. */
  payerId: string;
  items: SplitItem[];
  /** The amount to split: normally the bill's grand total. */
  totalPaise: number;
}

export interface PersonShare {
  /** This person's share of the items, before taxes etc. */
  itemsPaise: number;
  /** Their share of taxes, charges, discounts and round off (can be negative). */
  extrasPaise: number;
  /** What they owe in total: itemsPaise + extrasPaise. */
  totalPaise: number;
}

export type SplitResult = Record<string, PersonShare>;

const big = BigInt;

/** Greatest common divisor and least common multiple for whole numbers. */
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
function lcm(a: number, b: number): number {
  return (a / gcd(a, b)) * b;
}

/** Floor division for BigInt (BigInt "/" rounds toward zero, which is wrong for negatives). */
function floorDiv(a: bigint, b: bigint): bigint {
  const q = a / b;
  return (a % b !== 0n && (a < 0n) !== (b < 0n)) ? q - 1n : q;
}

export function splitBill(input: SplitInput): SplitResult {
  const { people, payerId, totalPaise } = input;
  if (!people.includes(payerId)) throw new Error("The payer must be one of the people.");
  for (const n of [totalPaise, ...input.items.map((i) => i.pricePaise)]) {
    if (!Number.isInteger(n)) throw new Error("Amounts must be whole paise.");
  }

  // Items nobody picked are put on the payer, so no money goes missing.
  const items = input.items.map((item) => {
    const sharers = [...new Set(item.sharedBy.filter((id) => people.includes(id)))];
    return { pricePaise: item.pricePaise, sharedBy: sharers.length ? sharers : [payerId] };
  });

  // To keep shared items exact, measure everything in "1/L paise", where L is a
  // common multiple of every group size. An item shared by n people then gives
  // each of them exactly price * (L / n) of these tiny units, with no fractions.
  const L = items.reduce((acc, item) => lcm(acc, item.sharedBy.length), 1);
  const units: Record<string, bigint> = Object.fromEntries(people.map((p) => [p, 0n]));
  for (const item of items) {
    const perPerson = big(item.pricePaise) * big(L / item.sharedBy.length);
    for (const p of item.sharedBy) units[p] += perPerson;
  }
  const itemsTotalUnits = Object.values(units).reduce((a, b) => a + b, 0n); // = itemsTotal * L
  const itemsTotalPaise = items.reduce((a, i) => a + i.pricePaise, 0);

  const result: SplitResult = {};
  let othersTotal = 0;
  for (const p of people) {
    if (p === payerId) continue;
    // Exact share = (my item units / all item units) * bill total. Round down;
    // the payer picks up whatever is left.
    const share =
      itemsTotalUnits === 0n ? 0 : Number(floorDiv(units[p] * big(totalPaise), itemsTotalUnits));
    const myItems = Number(floorDiv(units[p], big(L)));
    result[p] = { itemsPaise: myItems, extrasPaise: share - myItems, totalPaise: share };
    othersTotal += share;
  }

  const payerTotal = totalPaise - othersTotal;
  const othersItems = Object.values(result).reduce((a, r) => a + r.itemsPaise, 0);
  const payerItems = itemsTotalPaise - othersItems;
  result[payerId] = { itemsPaise: payerItems, extrasPaise: payerTotal - payerItems, totalPaise: payerTotal };

  // Safety net: this can never fail, but if it did we'd rather crash than send wrong amounts.
  const check = people.reduce((a, p) => a + result[p].totalPaise, 0);
  if (check !== totalPaise) {
    throw new Error("Split does not add up to the bill total.");
  }
  return result;
}
