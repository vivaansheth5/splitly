"use client";

import { useState } from "react";
import type { Bill } from "@/lib/bill";
import { newId } from "@/lib/bill";
import { formatRupees } from "@/lib/money";
import { NavButtons } from "./ReviewStep";
import type { Assignments, Person } from "./types";

const COLORS = [
  "bg-emerald-500", "bg-sky-500", "bg-violet-500", "bg-amber-500",
  "bg-rose-500", "bg-teal-500", "bg-indigo-500", "bg-orange-500",
];
export const colorFor = (index: number) => COLORS[index % COLORS.length];

// Screen 3: add people, then tap items to say who had them.
export function AssignStep({
  bill,
  people,
  setPeople,
  payerId,
  setPayerId,
  assignments,
  setAssignments,
  onBack,
  onNext,
}: {
  bill: Bill;
  people: Person[];
  setPeople: (fn: (p: Person[]) => Person[]) => void;
  payerId: string;
  setPayerId: (id: string) => void;
  assignments: Assignments;
  setAssignments: (fn: (a: Assignments) => Assignments) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const [name, setName] = useState("");
  const [activeId, setActiveId] = useState(people[0]?.id ?? "");
  const active = people.find((p) => p.id === activeId) ?? people[0];

  function addPerson() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const person = { id: newId("person"), name: trimmed.slice(0, 24) };
    setPeople((ps) => [...ps, person]);
    setActiveId(person.id);
    setName("");
  }

  function removePerson(id: string) {
    setPeople((ps) => ps.filter((p) => p.id !== id));
    setAssignments((a) => Object.fromEntries(Object.entries(a).map(([item, ids]) => [item, ids.filter((x) => x !== id)])));
    if (activeId === id) setActiveId(payerId);
  }

  function toggle(itemId: string) {
    if (!active) return;
    setAssignments((a) => {
      const current = a[itemId] ?? [];
      const next = current.includes(active.id) ? current.filter((x) => x !== active.id) : [...current, active.id];
      return { ...a, [itemId]: next };
    });
  }

  function shareRestWithEveryone() {
    setAssignments((a) => {
      const next = { ...a };
      for (const item of bill.items) if (!next[item.id]?.length) next[item.id] = people.map((p) => p.id);
      return next;
    });
  }

  const unassigned = bill.items.filter((i) => !(assignments[i.id] ?? []).some((id) => people.some((p) => p.id === id)));

  return (
    <section className="flex flex-col gap-5 pt-4">
      <div>
        <h1 className="text-2xl font-bold">Who had what?</h1>
        <p className="text-sm text-zinc-500">Add everyone, pick a person, then tap the items they had.</p>
      </div>

      {/* People chips */}
      <div className="flex flex-col gap-3">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            addPerson();
          }}
          className="flex gap-2"
        >
          <input
            aria-label="Person's name"
            placeholder="Add a name, e.g. Riya"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-12 min-w-0 flex-1 rounded-2xl border border-zinc-300 bg-transparent px-4 dark:border-zinc-700"
          />
          <button type="submit" className="h-12 rounded-2xl bg-zinc-900 px-5 font-semibold text-white dark:bg-zinc-100 dark:text-zinc-900">
            Add
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          {people.map((p, i) => {
            const selected = p.id === active?.id;
            return (
              <span
                key={p.id}
                className={`flex h-11 items-center rounded-full border-2 pl-1 ${
                  selected ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50" : "border-transparent bg-zinc-100 dark:bg-zinc-900"
                }`}
              >
                <button onClick={() => setActiveId(p.id)} aria-pressed={selected} className="flex h-full items-center gap-2 pr-3">
                  <span className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold text-white ${colorFor(i)}`}>
                    {p.name.charAt(0).toUpperCase()}
                  </span>
                  <span className="font-medium">{p.name}</span>
                  {p.id === payerId && <span className="text-xs text-zinc-500">(paid)</span>}
                </button>
                {p.id !== payerId && (
                  <button onClick={() => removePerson(p.id)} aria-label={`Remove ${p.name}`} className="h-full pr-3 pl-1 text-zinc-400">
                    ×
                  </button>
                )}
              </span>
            );
          })}
        </div>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-zinc-500">Who paid the restaurant?</span>
          <select
            value={payerId}
            onChange={(e) => setPayerId(e.target.value)}
            className="h-11 rounded-xl border border-zinc-300 bg-transparent px-3 dark:border-zinc-700"
          >
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Items */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
            Tap items for <span className="text-emerald-600 dark:text-emerald-400">{active?.name}</span>
          </h2>
        </div>
        {bill.items.map((item) => {
          const ids = (assignments[item.id] ?? []).filter((id) => people.some((p) => p.id === id));
          const mine = active ? ids.includes(active.id) : false;
          return (
            <button
              key={item.id}
              onClick={() => toggle(item.id)}
              aria-pressed={mine}
              className={`flex min-h-16 items-center gap-3 rounded-2xl border-2 p-3 text-left transition ${
                mine ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-950/40" : "border-zinc-200 dark:border-zinc-800"
              }`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">
                  {item.quantity > 1 && <span className="text-zinc-500">{item.quantity}× </span>}
                  {item.name || "Item"}
                </p>
                <div className="mt-1 flex items-center gap-1">
                  {ids.length === 0 ? (
                    <span className="text-xs text-amber-600">Nobody yet</span>
                  ) : (
                    <>
                      {ids.map((id) => {
                        const idx = people.findIndex((p) => p.id === id);
                        return (
                          <span key={id} className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white ${colorFor(idx)}`}>
                            {people[idx].name.charAt(0).toUpperCase()}
                          </span>
                        );
                      })}
                      {ids.length > 1 && <span className="ml-1 text-xs text-zinc-500">split {ids.length} ways</span>}
                    </>
                  )}
                </div>
              </div>
              <span className="font-semibold tabular-nums">{formatRupees(item.pricePaise)}</span>
            </button>
          );
        })}
      </div>

      {unassigned.length > 0 && (
        <div className="flex flex-col gap-2 rounded-2xl bg-amber-50 p-4 text-sm dark:bg-amber-950/40">
          <p className="text-amber-800 dark:text-amber-300">
            {unassigned.length} item{unassigned.length > 1 ? "s" : ""} still need{unassigned.length > 1 ? "" : "s"} someone.
          </p>
          <button onClick={shareRestWithEveryone} className="h-11 self-start rounded-xl bg-amber-500 px-4 font-semibold text-white">
            Split the rest between everyone
          </button>
        </div>
      )}

      <NavButtons
        onBack={onBack}
        onNext={onNext}
        nextLabel={people.length < 2 ? "Add at least 2 people" : unassigned.length ? "Assign every item" : "See who owes what →"}
        nextDisabled={people.length < 2 || unassigned.length > 0}
      />
    </section>
  );
}
