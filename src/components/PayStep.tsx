"use client";

import { useMemo, useState } from "react";
import type { Bill } from "@/lib/bill";
import { formatRupees } from "@/lib/money";
import { splitBill } from "@/lib/split";
import { buildUpiLink, buildWhatsAppLink, isValidUpiId } from "@/lib/upi";
import { colorFor } from "./AssignStep";
import { QrCode } from "./QrCode";
import { NavButtons } from "./ReviewStep";
import type { Assignments, Person } from "./types";

const UPI_KEY = "splitly:upiId";

// localStorage can throw (private mode, blocked storage), so always wrap it.
function loadUpiId(): string {
  try {
    return window.localStorage.getItem(UPI_KEY) ?? "";
  } catch {
    return "";
  }
}
function saveUpiId(id: string) {
  try {
    window.localStorage.setItem(UPI_KEY, id);
  } catch {
    // Not saved this time; the app still works.
  }
}

// Screen 4: who owes what, with a UPI link, QR code and WhatsApp share for each person.
export function PayStep({
  bill,
  people,
  payerId,
  assignments,
  onRenamePayer,
  onBack,
}: {
  bill: Bill;
  people: Person[];
  payerId: string;
  assignments: Assignments;
  onRenamePayer: (name: string) => void;
  onBack: () => void;
}) {
  // This screen only appears after the user taps through, so it never renders on the server.
  const [upiId, setUpiId] = useState(loadUpiId);
  const [openQr, setOpenQr] = useState<string | null>(null);
  const payer = people.find((p) => p.id === payerId)!;
  const upiOk = isValidUpiId(upiId);

  const shares = useMemo(
    () =>
      splitBill({
        people: people.map((p) => p.id),
        payerId,
        totalPaise: bill.grandTotalPaise,
        items: bill.items.map((i) => ({ pricePaise: i.pricePaise, sharedBy: assignments[i.id] ?? [] })),
      }),
    [bill, people, payerId, assignments],
  );

  const sumOfShares = people.reduce((a, p) => a + shares[p.id].totalPaise, 0);
  const balanced = sumOfShares === bill.grandTotalPaise;
  const note = `Splitly${bill.restaurantName ? ` - ${bill.restaurantName}` : " bill split"}`;
  const payerName = payer.name === "Me" ? "" : payer.name;

  return (
    <section className="flex flex-col gap-5 pt-4">
      <div>
        <h1 className="text-2xl font-bold">Who owes what</h1>
        <p className="text-sm text-zinc-500">{bill.restaurantName || "Your bill"}</p>
      </div>

      {/* Total check */}
      <div
        className={`rounded-2xl p-4 ${
          balanced ? "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200" : "bg-red-50 text-red-800"
        }`}
      >
        <div className="flex items-baseline justify-between">
          <span className="text-sm font-medium">Grand total</span>
          <span className="text-2xl font-bold tabular-nums">{formatRupees(bill.grandTotalPaise)}</span>
        </div>
        <p className="mt-1 text-sm">
          {balanced
            ? `✓ Everyone's shares add up to exactly ${formatRupees(sumOfShares)}.`
            : `Shares add up to ${formatRupees(sumOfShares)}, which doesn't match.`}
        </p>
      </div>

      {/* Payer details */}
      <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="font-semibold">Your payment details</p>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500">Your name</span>
          <input
            value={payerName}
            placeholder="e.g. Arjun"
            onChange={(e) => onRenamePayer(e.target.value.slice(0, 24) || "Me")}
            className="h-12 rounded-xl border border-zinc-300 bg-transparent px-3 text-base dark:border-zinc-700"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-zinc-500">Your UPI ID (remembered on this phone)</span>
          <input
            value={upiId}
            placeholder="yourname@okhdfcbank"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            onChange={(e) => {
              const v = e.target.value.trim();
              setUpiId(v);
              if (isValidUpiId(v)) saveUpiId(v);
            }}
            className={`h-12 rounded-xl border bg-transparent px-3 text-base ${
              upiId && !upiOk ? "border-red-500" : "border-zinc-300 dark:border-zinc-700"
            }`}
          />
          {upiId && !upiOk && <span className="text-xs text-red-600">That doesn&apos;t look like a UPI ID (name@bank).</span>}
        </label>
      </div>

      {/* One card per person */}
      <ul className="flex flex-col gap-3">
        {people.map((p, i) => {
          const share = shares[p.id];
          const isPayer = p.id === payerId;
          const link = upiOk
            ? buildUpiLink({ upiId, payeeName: payerName || "Splitly", amountPaise: share.totalPaise, note })
            : "";
          return (
            <li key={p.id} className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
              <div className="flex items-center gap-3">
                <span className={`flex h-10 w-10 items-center justify-center rounded-full font-bold text-white ${colorFor(i)}`}>
                  {p.name.charAt(0).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold">
                    {p.name} {isPayer && <span className="text-xs font-normal text-zinc-500">paid the bill</span>}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Items {formatRupees(share.itemsPaise)} · Tax &amp; charges {formatRupees(share.extrasPaise)}
                  </p>
                </div>
                <span className="text-xl font-bold tabular-nums">{formatRupees(share.totalPaise)}</span>
              </div>

              {!isPayer && share.totalPaise > 0 && (
                <div className="mt-3 flex flex-col gap-2">
                  {upiOk ? (
                    <>
                      <div className="grid grid-cols-2 gap-2">
                        <a href={link} className="flex h-12 items-center justify-center rounded-xl bg-emerald-500 font-semibold text-white">
                          Pay {formatRupees(share.totalPaise)}
                        </a>
                        <a
                          href={buildWhatsAppLink({ personName: p.name, amountPaise: share.totalPaise, upiLink: link, payerName, place: bill.restaurantName })}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex h-12 items-center justify-center rounded-xl bg-[#25D366] font-semibold text-white"
                        >
                          WhatsApp
                        </a>
                      </div>
                      <button
                        onClick={() => setOpenQr(openQr === p.id ? null : p.id)}
                        className="h-11 rounded-xl border border-zinc-300 text-sm font-medium dark:border-zinc-700"
                      >
                        {openQr === p.id ? "Hide QR code" : "Show QR code to scan"}
                      </button>
                      {openQr === p.id && (
                        <div className="flex flex-col items-center gap-2 pt-2">
                          <QrCode text={link} label={`UPI QR code for ${p.name} to pay ${formatRupees(share.totalPaise)}`} />
                          <p className="text-xs text-zinc-500">{p.name} scans this with any UPI app.</p>
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="text-sm text-zinc-500">Add your UPI ID above to get a payment link.</p>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <NavButtons onBack={onBack} />
    </section>
  );
}
