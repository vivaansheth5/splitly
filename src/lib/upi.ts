import { formatRupees, paiseToRupeeString } from "./money";

// A UPI ID looks like "name@bank", e.g. "priya@okicici" or "9876543210@ybl".
const UPI_ID_PATTERN = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9.\-]{1,64}$/;

export function isValidUpiId(id: string): boolean {
  return UPI_ID_PATTERN.test(id.trim());
}

export interface UpiLinkInput {
  upiId: string;
  payeeName: string;
  amountPaise: number;
  note: string;
}

/**
 * Build a UPI deep link. Tapping it on a phone opens GPay / PhonePe / Paytm
 * with the payee, amount and note already filled in.
 */
export function buildUpiLink({ upiId, payeeName, amountPaise, note }: UpiLinkInput): string {
  const params = [
    ["pa", upiId.trim()],
    ["pn", payeeName.trim() || "Splitly"],
    ["am", paiseToRupeeString(amountPaise)],
    ["cu", "INR"],
    ["tn", note.trim().slice(0, 50)],
  ];
  // Keep "@" readable in the UPI ID: some UPI apps don't decode "%40".
  const query = params.map(([k, v]) => `${k}=${encodeURIComponent(v).replace(/%40/g, "@")}`).join("&");
  return `upi://pay?${query}`;
}

/** A wa.me link that opens WhatsApp with a ready-to-send message. */
export function buildWhatsAppLink(opts: {
  personName: string;
  amountPaise: number;
  upiLink: string;
  payerName: string;
  place: string;
}): string {
  const where = opts.place ? ` at ${opts.place}` : "";
  const text =
    `Hi ${opts.personName}! Your share of the bill${where} is ${formatRupees(opts.amountPaise)}.\n` +
    `Pay ${opts.payerName || "me"} on UPI: ${opts.upiLink}\n` +
    `(Split with Splitly)`;
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
