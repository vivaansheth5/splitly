"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

// Draws a QR code for any text (here: a UPI payment link) as an image.
export function QrCode({ text, label }: { text: string; label: string }) {
  const [result, setResult] = useState<{ text: string; url: string } | null>(null);

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(text, { margin: 1, width: 220, errorCorrectionLevel: "M" })
      .then((url) => {
        if (!cancelled) setResult({ text, url });
      })
      .catch(() => {
        if (!cancelled) setResult(null);
      });
    return () => {
      cancelled = true;
    };
  }, [text]);

  if (!result || result.text !== text) {
    return <div className="h-[220px] w-[220px] animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800" />;
  }
  // A data: URL QR code, so next/image's optimiser isn't needed here.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={result.url} alt={label} width={220} height={220} className="rounded-xl bg-white p-2" />;
}
