# Splitly

**Snap a restaurant bill, tap who had what, and send everyone a UPI link for their exact share.**

🔗 **Live app:** LIVE_URL_PLACEHOLDER

## The problem

After a group dinner in India, one person pays and everyone else owes them. Splitting fairly is a pain:
- Someone types every item into a calculator.
- CGST, SGST, service charge and discounts get split "roughly", so someone always over- or under-pays.
- Then everyone has to ask for the payer's UPI ID and type in an amount.

## What Splitly does

1. **Photograph the bill** (or pick it from your gallery). JPG, PNG and iPhone HEIC photos work.
2. **AI reads every line**: items, quantities, prices, each tax line, service charge, discounts, round off and the grand total.
3. **It checks the maths.** If the items don't add up to the subtotal, or the lines don't add up to the grand total, you get a warning and can fix any line by hand.
4. **Add people as chips and tap items** to say who had what. Shared items are split evenly.
5. **Everyone gets their exact share**, to the paisa, with:
   - a tap-to-pay **UPI button** (opens GPay, PhonePe, Paytm…),
   - a **QR code** they can scan from your phone,
   - a **Share on WhatsApp** button with their amount and payment link.
6. **A summary** that proves the shares add up to the grand total exactly.

## How it works

```
Phone camera ──► browser shrinks photo (canvas, HEIC → JPEG)
             ──► POST /api/parse-bill (Next.js server route)
                   • rate limit: 10 requests/minute per IP
                   • checks file size (≤ 8 MB) and real image bytes
                   • sends the image to Claude (claude-sonnet-5-5) with a strict JSON schema
                   • validates the answer with zod
             ◄── bill JSON (all money in integer paise) + "does it add up?" checks
Browser ──► review & edit ──► assign items ──► split maths ──► UPI links, QR codes, WhatsApp
```

**The split rule.** Each person pays for their own items (shared items split evenly). Taxes, service
charge, other charges, discounts and round off are shared in proportion to each person's item subtotal.
All maths is done in **integer paise** (with BigInt for exact fractions), each person's share is rounded
down, and the few leftover paise go to the person who paid. So the shares always add up to the bill
exactly.

**Privacy.** The API key lives only on the server. Photos are processed in memory for one request and
never stored. Your UPI ID is saved only in your own browser.

## Tech stack

- [Next.js 16](https://nextjs.org) (App Router) + TypeScript + Tailwind CSS 4
- [Anthropic API](https://docs.claude.com) (`claude-sonnet-5-5`, vision + structured outputs) via `@anthropic-ai/sdk`
- [zod](https://zod.dev) for validating the AI's JSON
- [`qrcode`](https://www.npmjs.com/package/qrcode) for UPI QR codes, `heic2any` for iPhone photos
- [Vitest](https://vitest.dev) for tests
- Hosted on [Vercel](https://vercel.com)

## Run it locally

You need Node.js 20+ and an [Anthropic API key](https://console.anthropic.com).

```bash
git clone https://github.com/vivaansheth5/splitly.git
cd splitly
npm install
echo "ANTHROPIC_API_KEY=your-key-here" > .env.local
npm run dev            # open http://localhost:3000
```

Other commands:

```bash
npm test               # run the Vitest unit tests
npm run lint           # ESLint
npm run build          # production build (type-checks everything)
node scripts/test-samples.mjs http://localhost:3000   # send every photo in samples/ to the parser
```

`samples/` is git-ignored so your own bill photos stay private. Optionally add `samples/expected.json`
(`{ "bill.jpg": 4770.00 }`) so the sample script also checks the printed grand total.

## Project layout

```
src/app/page.tsx                 the home page (renders the app)
src/app/api/parse-bill/route.ts  server route that reads the bill with Claude
src/components/                  the four screens: Upload, Review, Assign, Pay
src/lib/split.ts                 the split maths (fully unit tested)
src/lib/bill.ts                  bill schema (zod), paise conversion, "does it add up?" checks
src/lib/upi.ts                   UPI and WhatsApp link builders
src/lib/money.ts                 paise ⇄ rupee helpers
src/lib/compressImage.ts         in-browser photo shrinking + HEIC conversion
src/lib/rateLimit.ts             per-IP rate limiter
src/lib/imageCheck.ts            checks uploaded bytes are really an image
```

New to the code? Read [LEARN.md](LEARN.md) for a plain-English walkthrough.
