import { describe, expect, it } from "vitest";
import { splitBill, type SplitInput } from "./split";

const totalOf = (r: ReturnType<typeof splitBill>) => Object.values(r).reduce((a, s) => a + s.totalPaise, 0);

describe("splitBill", () => {
  it("1. two people, separate items, no tax: each pays exactly their items", () => {
    const r = splitBill({
      people: ["a", "b"],
      payerId: "a",
      totalPaise: 50000,
      items: [
        { pricePaise: 30000, sharedBy: ["a"] },
        { pricePaise: 20000, sharedBy: ["b"] },
      ],
    });
    expect(r.a.totalPaise).toBe(30000);
    expect(r.b.totalPaise).toBe(20000);
    expect(r.b.extrasPaise).toBe(0);
  });

  it("2. shared item is split evenly between the people who had it", () => {
    const r = splitBill({
      people: ["a", "b", "c"],
      payerId: "a",
      totalPaise: 90000,
      items: [
        { pricePaise: 60000, sharedBy: ["a", "b", "c"] }, // ₹200 each
        { pricePaise: 30000, sharedBy: ["c"] },
      ],
    });
    expect(r.a.totalPaise).toBe(20000);
    expect(r.b.totalPaise).toBe(20000);
    expect(r.c.totalPaise).toBe(50000);
  });

  it("3. GST is shared in proportion to each person's items", () => {
    // ₹300 + ₹100 of items, 5% GST = ₹20, total ₹420.
    const r = splitBill({
      people: ["a", "b"],
      payerId: "a",
      totalPaise: 42000,
      items: [
        { pricePaise: 30000, sharedBy: ["a"] },
        { pricePaise: 10000, sharedBy: ["b"] },
      ],
    });
    expect(r.a.totalPaise).toBe(31500);
    expect(r.b.totalPaise).toBe(10500);
    expect(r.b.extrasPaise).toBe(500);
  });

  it("4. service charge + GST + round off (real bill: ₹4525 items, ₹5226 total)", () => {
    // Items ₹4525, SERC 10% ₹452.50, SGST ₹124.49, CGST ₹124.49, round off -₹0.48 = ₹5226.
    const r = splitBill({
      people: ["a", "b", "c"],
      payerId: "a",
      totalPaise: 522600,
      items: [
        { pricePaise: 39000, sharedBy: ["a"] }, // Ginger ale
        { pricePaise: 46000, sharedBy: ["b"] }, // Brownie
        { pricePaise: 27000, sharedBy: ["a", "b", "c"] }, // Fries
        { pricePaise: 31500, sharedBy: ["c"] }, // 1 dozen wings
        { pricePaise: 225000, sharedBy: ["a", "b", "c"] }, // 10 x half dozen
        { pricePaise: 28000, sharedBy: ["a"] },
        { pricePaise: 28000, sharedBy: ["b"] },
        { pricePaise: 28000, sharedBy: ["c"] },
      ],
    });
    expect(totalOf(r)).toBe(522600);
    // b had 460 + 280 + (270 + 2250)/3 = 1580 of 4525 items -> 1580/4525 * 5226 = 1824.76 (rounded down)
    expect(r.b.itemsPaise).toBe(158000);
    expect(r.b.totalPaise).toBe(182476);
  });

  it("5. a discount lowers everyone's share proportionally (real bill: ₹358 -> ₹374)", () => {
    // Items ₹358, discount -₹17.90, CGST ₹8.50, SGST ₹8.50, gas charge ₹17.01, round off -₹0.11 = ₹374.
    const r = splitBill({
      people: ["a", "b"],
      payerId: "a",
      totalPaise: 37400,
      items: [{ pricePaise: 35800, sharedBy: ["a", "b"] }],
    });
    expect(r.a.totalPaise).toBe(18700);
    expect(r.b.totalPaise).toBe(18700);

    const discounted = splitBill({
      people: ["a", "b"],
      payerId: "a",
      totalPaise: 9000, // ₹100 of items, ₹10 discount
      items: [
        { pricePaise: 6000, sharedBy: ["a"] },
        { pricePaise: 4000, sharedBy: ["b"] },
      ],
    });
    expect(discounted.a.totalPaise).toBe(5400);
    expect(discounted.b.totalPaise).toBe(3600);
    expect(discounted.b.extrasPaise).toBe(-400);
  });

  it("6. odd rounding: ₹100 shared by 3, the payer gets the leftover paisa", () => {
    const r = splitBill({
      people: ["a", "b", "c"],
      payerId: "a",
      totalPaise: 10000,
      items: [{ pricePaise: 10000, sharedBy: ["a", "b", "c"] }],
    });
    expect(r.b.totalPaise).toBe(3333);
    expect(r.c.totalPaise).toBe(3333);
    expect(r.a.totalPaise).toBe(3334);
    expect(totalOf(r)).toBe(10000);
  });

  it("7. one person pays for everything: they owe the whole bill, others owe nothing", () => {
    const r = splitBill({
      people: ["a", "b", "c"],
      payerId: "b",
      totalPaise: 123457,
      items: [
        { pricePaise: 50000, sharedBy: ["b"] },
        { pricePaise: 60000, sharedBy: ["b"] },
      ],
    });
    expect(r.b.totalPaise).toBe(123457);
    expect(r.a.totalPaise).toBe(0);
    expect(r.c.totalPaise).toBe(0);
  });

  it("8. the payer had nothing but still absorbs rounding leftovers", () => {
    const r = splitBill({
      people: ["payer", "x", "y", "z"],
      payerId: "payer",
      totalPaise: 10001,
      items: [{ pricePaise: 9500, sharedBy: ["x", "y", "z"] }],
    });
    // Each of x, y, z owes floor(10001 / 3) = 3333; payer gets the 2 leftover paise.
    expect(r.x.totalPaise).toBe(3333);
    expect(r.payer.totalPaise).toBe(2);
    expect(totalOf(r)).toBe(10001);
  });

  it("9. items nobody picked are put on the payer", () => {
    const r = splitBill({
      people: ["a", "b"],
      payerId: "a",
      totalPaise: 30000,
      items: [
        { pricePaise: 10000, sharedBy: ["b"] },
        { pricePaise: 20000, sharedBy: [] },
      ],
    });
    expect(r.b.totalPaise).toBe(10000);
    expect(r.a.totalPaise).toBe(20000);
  });

  it("10. people removed from the table are ignored on items", () => {
    const r = splitBill({
      people: ["a", "b"],
      payerId: "a",
      totalPaise: 20000,
      items: [{ pricePaise: 20000, sharedBy: ["a", "b", "ghost"] }],
    });
    expect(r.a.totalPaise).toBe(10000);
    expect(r.b.totalPaise).toBe(10000);
    expect(r.ghost).toBeUndefined();
  });

  it("11. rejects a payer who isn't at the table and non-integer amounts", () => {
    const base: SplitInput = { people: ["a"], payerId: "a", totalPaise: 100, items: [{ pricePaise: 100, sharedBy: ["a"] }] };
    expect(() => splitBill({ ...base, payerId: "zz" })).toThrow();
    expect(() => splitBill({ ...base, totalPaise: 10.5 })).toThrow();
  });

  it("12. 2,000 random bills always add up to the exact total, never negative for big bills", () => {
    let seed = 42;
    const rand = (n: number) => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed % n;
    };
    for (let t = 0; t < 2000; t++) {
      const people = Array.from({ length: 2 + rand(9) }, (_, i) => `p${i}`);
      const items = Array.from({ length: 1 + rand(15) }, () => ({
        pricePaise: 100 + rand(100000),
        sharedBy: people.filter(() => rand(3) === 0),
      }));
      const itemsTotal = items.reduce((a, i) => a + i.pricePaise, 0);
      // Total between 80% (discounts) and 130% (tax + service) of the items.
      const totalPaise = Math.round(itemsTotal * (0.8 + rand(50) / 100));
      const payerId = people[rand(people.length)];
      const r = splitBill({ people, payerId, totalPaise, items });
      expect(totalOf(r)).toBe(totalPaise);
      for (const p of people) {
        expect(Number.isInteger(r[p].totalPaise)).toBe(true);
        expect(r[p].totalPaise).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
