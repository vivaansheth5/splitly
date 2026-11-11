"use client";

import { useState } from "react";
import { paiseToRupeeString, parseRupeeInput } from "@/lib/money";

// A text box for rupee amounts. It keeps what you type as text (so "12." is
// allowed mid-typing) and only reports a value in paise when it's a valid number.
export function MoneyInput({
  valuePaise,
  onChange,
  label,
  allowNegative = false,
  className = "",
}: {
  valuePaise: number;
  onChange: (paise: number) => void;
  label: string;
  allowNegative?: boolean;
  className?: string;
}) {
  const [text, setText] = useState(paiseToRupeeString(valuePaise));
  const [lastValue, setLastValue] = useState(valuePaise);

  // If the value changes from outside (e.g. "use calculated total"), show it.
  if (valuePaise !== lastValue) {
    setLastValue(valuePaise);
    if (parseRupeeInput(text) !== valuePaise) setText(paiseToRupeeString(valuePaise));
  }

  const invalid = parseRupeeInput(text) === null || (!allowNegative && text.trim().startsWith("-"));

  return (
    <input
      aria-label={label}
      inputMode="decimal"
      value={text}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        const paise = parseRupeeInput(next);
        if (paise !== null && (allowNegative || paise >= 0)) {
          setLastValue(paise);
          onChange(paise);
        }
      }}
      onBlur={() => {
        if (!invalid) setText(paiseToRupeeString(valuePaise));
      }}
      className={`h-11 rounded-xl border bg-transparent px-3 text-right tabular-nums outline-none focus:ring-2 focus:ring-emerald-500 ${
        invalid ? "border-red-500" : "border-zinc-300 dark:border-zinc-700"
      } ${className}`}
    />
  );
}
