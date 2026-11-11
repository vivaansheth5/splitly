"use client";

import { useRef, useState } from "react";
import type { Bill, BillCheck } from "@/lib/bill";
import { ImageInputError, compressImage } from "@/lib/compressImage";

type Status = { kind: "idle" } | { kind: "working"; message: string } | { kind: "error"; title: string; message: string };

// Friendly titles for each error the server can send back.
const ERROR_TITLES: Record<string, string> = {
  blurry: "Photo too blurry",
  not_a_bill: "That's not a bill",
  rate_limited: "Slow down a little",
  too_large: "Photo too big",
  not_image: "Not a photo",
  heic_unsupported: "Can't open this photo",
};

export function UploadStep({ onParsed, onManual }: { onParsed: (bill: Bill) => void; onManual: () => void }) {
  const cameraInput = useRef<HTMLInputElement>(null);
  const libraryInput = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function handleFile(file: File | undefined) {
    if (!file) return;
    try {
      setStatus({ kind: "working", message: "Shrinking photo…" });
      const image = await compressImage(file);

      setStatus({ kind: "working", message: "Reading every line of your bill…" });
      const form = new FormData();
      form.append("image", image, "bill.jpg");
      const res = await fetch("/api/parse-bill", { method: "POST", body: form });
      const body = (await res.json().catch(() => null)) as
        | { bill: Bill; check: BillCheck }
        | { error: { code: string; message: string } }
        | null;

      if (!res.ok || !body || "error" in body) {
        const err = body && "error" in body ? body.error : null;
        setStatus({
          kind: "error",
          title: (err && ERROR_TITLES[err.code]) || "Couldn't read the bill",
          message: err?.message ?? "Something went wrong. Check your connection and try again.",
        });
        return;
      }
      setStatus({ kind: "idle" });
      onParsed(body.bill);
    } catch (e) {
      setStatus({
        kind: "error",
        title: "Couldn't read the bill",
        message: e instanceof ImageInputError ? e.message : "Check your internet connection and try again.",
      });
    }
  }

  const working = status.kind === "working";
  const accept = "image/jpeg,image/png,image/heic,image/heif,.heic,.heif,.jpg,.jpeg,.png";

  return (
    <section className="flex flex-1 flex-col gap-5 pt-6">
      <div>
        <h1 className="text-3xl font-bold leading-tight">Split the bill in seconds.</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          Snap the bill, tap who had what, and send everyone a UPI link for their exact share.
        </p>
      </div>

      {status.kind === "error" && (
        <div role="alert" className="rounded-2xl border border-red-300 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950/50">
          <p className="font-semibold text-red-700 dark:text-red-300">{status.title}</p>
          <p className="mt-1 text-sm text-red-700/90 dark:text-red-300/90">{status.message}</p>
        </div>
      )}

      {working ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-4 py-16" aria-live="polite">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent" />
          <p className="font-medium">{status.message}</p>
          <p className="text-sm text-zinc-500">This usually takes 5–10 seconds.</p>
        </div>
      ) : (
        <div className="mt-auto flex flex-col gap-3">
          <button
            onClick={() => cameraInput.current?.click()}
            className="h-16 rounded-2xl bg-emerald-500 text-lg font-semibold text-white shadow-lg shadow-emerald-500/20 active:scale-[0.99]"
          >
            📷 Take a photo of the bill
          </button>
          <button
            onClick={() => libraryInput.current?.click()}
            className="h-14 rounded-2xl border border-zinc-300 font-semibold dark:border-zinc-700"
          >
            Choose from gallery
          </button>
          <button onClick={onManual} className="h-12 text-sm font-medium text-zinc-500 underline-offset-4 hover:underline">
            No photo? Enter the bill by hand
          </button>
          <p className="text-center text-xs text-zinc-500">
            JPG, PNG or HEIC, up to 8 MB. Your photo is read once and never stored.
          </p>
        </div>
      )}

      <input
        ref={cameraInput}
        type="file"
        accept={accept}
        capture="environment"
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={libraryInput}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          void handleFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </section>
  );
}
