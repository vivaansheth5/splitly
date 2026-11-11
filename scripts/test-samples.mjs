// Sends every photo in samples/ to a running /api/parse-bill and checks the result.
//
// Usage:  node scripts/test-samples.mjs http://localhost:3000
//         node scripts/test-samples.mjs https://your-site.vercel.app
//
// Optional: samples/expected.json maps file names to the printed grand total,
// e.g. { "bill1.jpg": 4770.00 }. samples/ is git-ignored, so your bills stay private.

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const dir = path.resolve("samples");
const types = { ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".heic": "image/heic", ".webp": "image/webp" };

let expected = {};
try {
  expected = JSON.parse(await readFile(path.join(dir, "expected.json"), "utf8"));
} catch {
  console.log("(no samples/expected.json, will only check that the bill adds up)");
}

const files = (await readdir(dir)).filter((f) => types[path.extname(f).toLowerCase()]);
let failures = 0;

for (const name of files) {
  const bytes = await readFile(path.join(dir, name));
  const form = new FormData();
  form.append("image", new Blob([bytes], { type: types[path.extname(name).toLowerCase()] }), name);

  const started = Date.now();
  const res = await fetch(`${base}/api/parse-bill`, { method: "POST", body: form });
  const seconds = ((Date.now() - started) / 1000).toFixed(1);
  const body = await res.json();

  if (!res.ok) {
    failures++;
    console.log(`FAIL ${name} (${seconds}s): HTTP ${res.status} ${body.error?.code} - ${body.error?.message}`);
    continue;
  }

  const { bill, check } = body;
  const parsedTotal = bill.grandTotalPaise / 100;
  const want = expected[name];
  const totalOk = want === undefined || Math.round(want * 100) === bill.grandTotalPaise;
  const warningShown = check.warnings.length > 0;
  const pass = totalOk && (check.totalMatchesGrandTotal || warningShown);
  if (!pass) failures++;

  console.log(
    `${pass ? "PASS" : "FAIL"} ${name} (${seconds}s): ${bill.items.length} items, ` +
      `items ₹${(check.itemsTotalPaise / 100).toFixed(2)} vs subtotal ₹${(bill.subtotalPaise / 100).toFixed(2)}, ` +
      `calculated ₹${(check.calculatedTotalPaise / 100).toFixed(2)}, parsed grand total ₹${parsedTotal.toFixed(2)}` +
      (want !== undefined ? ` (printed ₹${want.toFixed(2)})` : "") +
      (warningShown ? ` | warnings: ${check.warnings.join(" / ")}` : " | adds up, no warning"),
  );
}

console.log(`\n${files.length - failures}/${files.length} samples passed against ${base}`);
process.exit(failures ? 1 : 0);
