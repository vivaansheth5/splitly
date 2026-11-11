// All money in Splitly is stored as whole paise (1 rupee = 100 paise).
// Integers never suffer from floating-point errors like 0.1 + 0.2 = 0.30000000000000004.

/** Convert a rupee amount like 113.58 into paise (11358). */
export function toPaise(rupees: number): number {
  if (!Number.isFinite(rupees)) return 0;
  return Math.round(rupees * 100);
}

/** Convert paise back to a plain rupee string with 2 decimals, e.g. 11358 -> "113.58". */
export function paiseToRupeeString(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(paise));
  const rupees = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, "0");
  return `${sign}${rupees}.${rest}`;
}

/** Pretty Indian-style display, e.g. 477000 -> "₹4,770.00". */
export function formatRupees(paise: number): string {
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(Math.trunc(paise));
  const rupees = Math.floor(abs / 100).toLocaleString("en-IN");
  const rest = String(abs % 100).padStart(2, "0");
  return `${sign}₹${rupees}.${rest}`;
}

/** Parse what a user typed into a price box ("1,234.5") into paise, or null if invalid. */
export function parseRupeeInput(text: string): number | null {
  const cleaned = text.replace(/[₹,\s]/g, "");
  if (!/^-?\d*(\.\d{0,2})?$/.test(cleaned) || cleaned === "" || cleaned === "-" || cleaned === ".") {
    return null;
  }
  return toPaise(Number(cleaned));
}
