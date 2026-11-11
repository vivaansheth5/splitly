"use client";

import type { Bill, BillLine } from "@/lib/bill";
import { checkBill, newId } from "@/lib/bill";
import { formatRupees } from "@/lib/money";
import { MoneyInput } from "./MoneyInput";

// Screen 2: show what was read from the bill and let the user fix anything.
export function ReviewStep({
  bill,
  onChange,
  onBack,
  onNext,
}: {
  bill: Bill;
  onChange: (bill: Bill) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const check = checkBill(bill);
  const canContinue = bill.items.length > 0 && check.itemsTotalPaise > 0 && bill.grandTotalPaise > 0;

  const update = (patch: Partial<Bill>) => onChange({ ...bill, ...patch });

  return (
    <section className="flex flex-col gap-5 pt-4">
      <div>
        <h1 className="text-2xl font-bold">Check the bill</h1>
        <p className="text-sm text-zinc-500">
          {bill.restaurantName ? `${bill.restaurantName} · ` : ""}Tap any line to fix it.
        </p>
      </div>

      {check.warnings.length > 0 ? (
        <div role="alert" className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          <p className="font-semibold text-amber-800 dark:text-amber-300">⚠️ Something doesn&apos;t add up</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-amber-800/90 dark:text-amber-200/90">
            {check.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
          {!check.totalMatchesGrandTotal && check.calculatedTotalPaise > 0 && (
            <button
              onClick={() => update({ grandTotalPaise: check.calculatedTotalPaise })}
              className="mt-3 h-11 rounded-xl bg-amber-500 px-4 font-semibold text-white"
            >
              Use calculated total {formatRupees(check.calculatedTotalPaise)}
            </button>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-emerald-50 p-3 text-sm font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
          ✓ Everything adds up to the grand total.
        </div>
      )}

      {/* Items */}
      <div className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Items</h2>
        {bill.items.map((item) => (
          <div key={item.id} className="flex items-center gap-2">
            <input
              aria-label="Quantity"
              inputMode="numeric"
              value={item.quantity}
              onChange={(e) => {
                const q = Number(e.target.value.replace(/\D/g, "")) || 1;
                update({ items: bill.items.map((i) => (i.id === item.id ? { ...i, quantity: q } : i)) });
              }}
              className="h-11 w-11 shrink-0 rounded-xl border border-zinc-300 bg-transparent text-center dark:border-zinc-700"
            />
            <input
              aria-label="Item name"
              placeholder="Item name"
              value={item.name}
              onChange={(e) =>
                update({ items: bill.items.map((i) => (i.id === item.id ? { ...i, name: e.target.value } : i)) })
              }
              className="h-11 min-w-0 flex-1 rounded-xl border border-zinc-300 bg-transparent px-3 dark:border-zinc-700"
            />
            <MoneyInput
              label={`Price of ${item.name || "item"}`}
              valuePaise={item.pricePaise}
              onChange={(p) => update({ items: bill.items.map((i) => (i.id === item.id ? { ...i, pricePaise: p } : i)) })}
              className="w-24 shrink-0"
            />
            <RemoveButton onClick={() => update({ items: bill.items.filter((i) => i.id !== item.id) })} />
          </div>
        ))}
        <AddButton
          label="Add item"
          onClick={() => update({ items: [...bill.items, { id: newId("item"), name: "", quantity: 1, pricePaise: 0 }] })}
        />
        <Row label="Items total" value={formatRupees(check.itemsTotalPaise)} />
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm">Subtotal printed on bill</span>
          <MoneyInput label="Subtotal" valuePaise={bill.subtotalPaise} onChange={(p) => update({ subtotalPaise: p })} className="w-28" />
        </div>
      </div>

      <LineEditor title="Taxes" placeholder="e.g. CGST 2.5%" lines={bill.taxes} onChange={(taxes) => update({ taxes })} />

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Service charge</h2>
        <MoneyInput label="Service charge" valuePaise={bill.serviceChargePaise} onChange={(p) => update({ serviceChargePaise: p })} className="w-28" />
      </div>

      <LineEditor title="Other charges" placeholder="e.g. Packing" lines={bill.otherCharges} onChange={(otherCharges) => update({ otherCharges })} />
      <LineEditor title="Discounts" placeholder="e.g. 10% off" lines={bill.discounts} onChange={(discounts) => update({ discounts })} />

      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">Round off</h2>
        <MoneyInput label="Round off" allowNegative valuePaise={bill.roundOffPaise} onChange={(p) => update({ roundOffPaise: p })} className="w-28" />
      </div>

      <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-800">
        <div className="flex items-center justify-between gap-2">
          <span className="text-lg font-bold">Grand total</span>
          <MoneyInput label="Grand total" valuePaise={bill.grandTotalPaise} onChange={(p) => update({ grandTotalPaise: p })} className="w-32 text-lg font-bold" />
        </div>
        <p className="mt-1 text-xs text-zinc-500">Calculated from the lines above: {formatRupees(check.calculatedTotalPaise)}</p>
      </div>

      <NavButtons onBack={onBack} backLabel="Retake" onNext={onNext} nextLabel="Looks right →" nextDisabled={!canContinue} />
    </section>
  );
}

function LineEditor({
  title,
  placeholder,
  lines,
  onChange,
}: {
  title: string;
  placeholder: string;
  lines: BillLine[];
  onChange: (lines: BillLine[]) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">{title}</h2>
      {lines.map((line) => (
        <div key={line.id} className="flex items-center gap-2">
          <input
            aria-label={`${title} name`}
            placeholder={placeholder}
            value={line.label}
            onChange={(e) => onChange(lines.map((l) => (l.id === line.id ? { ...l, label: e.target.value } : l)))}
            className="h-11 min-w-0 flex-1 rounded-xl border border-zinc-300 bg-transparent px-3 dark:border-zinc-700"
          />
          <MoneyInput
            label={`${line.label || title} amount`}
            valuePaise={line.amountPaise}
            onChange={(p) => onChange(lines.map((l) => (l.id === line.id ? { ...l, amountPaise: p } : l)))}
            className="w-24 shrink-0"
          />
          <RemoveButton onClick={() => onChange(lines.filter((l) => l.id !== line.id))} />
        </div>
      ))}
      <AddButton label={`Add ${title.toLowerCase().replace(/s$/, "")}`} onClick={() => onChange([...lines, { id: newId("line"), label: "", amountPaise: 0 }])} />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span>{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function RemoveButton({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label="Remove" className="h-11 w-9 shrink-0 rounded-xl text-xl text-zinc-400 hover:text-red-500">
      ×
    </button>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="h-11 self-start rounded-xl px-2 text-sm font-semibold text-emerald-600 dark:text-emerald-400">
      + {label}
    </button>
  );
}

export function NavButtons({
  onBack,
  backLabel = "← Back",
  onNext,
  nextLabel,
  nextDisabled,
}: {
  onBack: () => void;
  backLabel?: string;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div className="sticky bottom-0 -mx-4 mt-2 flex gap-3 bg-[var(--background)]/95 px-4 pt-3 pb-4 backdrop-blur">
      <button onClick={onBack} className="h-14 rounded-2xl border border-zinc-300 px-5 font-semibold dark:border-zinc-700">
        {backLabel}
      </button>
      {onNext && (
        <button
          onClick={onNext}
          disabled={nextDisabled}
          className="h-14 flex-1 rounded-2xl bg-emerald-500 font-semibold text-white disabled:opacity-40"
        >
          {nextLabel}
        </button>
      )}
    </div>
  );
}
