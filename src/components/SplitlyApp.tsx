"use client";

import { useState } from "react";
import type { Bill } from "@/lib/bill";
import { newId } from "@/lib/bill";
import { UploadStep } from "./UploadStep";
import { ReviewStep } from "./ReviewStep";
import { AssignStep } from "./AssignStep";
import { PayStep } from "./PayStep";
import type { Assignments, Person, Step } from "./types";

const STEPS: { key: Step; label: string }[] = [
  { key: "upload", label: "Photo" },
  { key: "review", label: "Check" },
  { key: "assign", label: "Who had what" },
  { key: "pay", label: "Pay" },
];

const emptyBill = (): Bill => ({
  restaurantName: "",
  items: [],
  subtotalPaise: 0,
  taxes: [],
  serviceChargePaise: 0,
  otherCharges: [],
  discounts: [],
  roundOffPaise: 0,
  grandTotalPaise: 0,
});

// The whole app lives here. It remembers the bill, the people and who had
// what, and shows one of four screens (steps) at a time.
export function SplitlyApp() {
  const [step, setStep] = useState<Step>("upload");
  const [bill, setBill] = useState<Bill>(emptyBill);
  const [people, setPeople] = useState<Person[]>(() => [{ id: "me", name: "Me" }]);
  const [payerId, setPayerId] = useState("me");
  const [assignments, setAssignments] = useState<Assignments>({});

  const stepIndex = STEPS.findIndex((s) => s.key === step);

  function startOver() {
    setBill(emptyBill());
    setAssignments({});
    setStep("upload");
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-8">
      <header className="sticky top-0 z-10 -mx-4 bg-[var(--background)]/90 px-4 pt-4 pb-3 backdrop-blur">
        <div className="flex items-center justify-between">
          <button onClick={startOver} className="text-2xl font-extrabold tracking-tight">
            Split<span className="text-emerald-500">ly</span>
          </button>
          {step !== "upload" && (
            <button
              onClick={startOver}
              className="h-11 rounded-full px-4 text-sm font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            >
              New bill
            </button>
          )}
        </div>
        <ol className="mt-3 grid grid-cols-4 gap-1.5" aria-label="Progress">
          {STEPS.map((s, i) => (
            <li key={s.key} className="flex flex-col gap-1">
              <span className={`h-1.5 rounded-full ${i <= stepIndex ? "bg-emerald-500" : "bg-zinc-200 dark:bg-zinc-800"}`} />
              <span className={`text-[11px] ${i === stepIndex ? "font-semibold" : "text-zinc-500"}`}>{s.label}</span>
            </li>
          ))}
        </ol>
      </header>

      <main className="flex flex-1 flex-col">
        {step === "upload" && (
          <UploadStep
            onParsed={(parsed) => {
              setBill(parsed);
              setAssignments({});
              setStep("review");
            }}
            onManual={() => {
              setBill({ ...emptyBill(), items: [{ id: newId("item"), name: "", quantity: 1, pricePaise: 0 }] });
              setAssignments({});
              setStep("review");
            }}
          />
        )}
        {step === "review" && (
          <ReviewStep bill={bill} onChange={setBill} onBack={startOver} onNext={() => setStep("assign")} />
        )}
        {step === "assign" && (
          <AssignStep
            bill={bill}
            people={people}
            setPeople={setPeople}
            payerId={payerId}
            setPayerId={setPayerId}
            assignments={assignments}
            setAssignments={setAssignments}
            onBack={() => setStep("review")}
            onNext={() => setStep("pay")}
          />
        )}
        {step === "pay" && (
          <PayStep
            bill={bill}
            people={people}
            payerId={payerId}
            assignments={assignments}
            onRenamePayer={(name) => setPeople((ps) => ps.map((p) => (p.id === payerId ? { ...p, name } : p)))}
            onBack={() => setStep("assign")}
          />
        )}
      </main>
    </div>
  );
}
