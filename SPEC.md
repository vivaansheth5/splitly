# Bill Splitter — Build, test, publish, deploy

## What it is
A mobile-first web app. A user photographs a restaurant bill, the app reads every
line item, the user assigns items to people, and each person gets their exact share
plus a UPI payment link and QR code.

## Stack
- Next.js (App Router) + TypeScript + Tailwind CSS
- Anthropic API (model: claude-sonnet-5-5) for reading the bill image
- `qrcode` npm package for QR codes
- Vitest for tests
- GitHub (via `gh` CLI) + Vercel (via `vercel` CLI) — both are already logged in
- The API key is in `.env.local`. Never print it, log it, or commit it.

## Features
1. Upload or take a photo of a bill (accept JPG/PNG/HEIC, max 8MB). Compress the
   image in the browser before upload.
2. Server route `/api/parse-bill` sends the image to Claude and returns strict JSON:
   items (name, quantity, price), subtotal, each tax line (CGST, SGST, VAT etc.),
   service charge, discounts, grand total. Validate the JSON with zod. If the
   parsed items don't add up to the bill's subtotal, show a warning and let the
   user edit any item, price or tax line by hand.
3. Add people by name (chips). Tap an item to assign it to one or more people.
   An item assigned to several people splits evenly among them.
4. Split logic: each person pays for their items; taxes, service charge and
   discounts are shared in proportion to each person's item subtotal. Do all
   money math in integer paise. Give rounding leftovers to the person who paid
   so the total always matches the bill exactly to the paisa.
5. The payer enters their UPI ID once (remember it in localStorage, wrapped in
   try/catch). For each person, generate
   `upi://pay?pa=<UPI ID>&pn=<payer name>&am=<amount>&cu=INR&tn=<note>`
   and show it as a tap-to-pay button plus a QR code.
6. "Share on WhatsApp" button per person that opens wa.me with their amount and
   their UPI link.
7. Summary screen showing who owes what, and a check that it equals the grand total.

## Security and reliability
- API key used only on the server. Never sent to the browser.
- Reject files that aren't images or are too large, on the server too.
- Simple per-IP rate limit on `/api/parse-bill` (e.g. 10 requests/minute).
- Never store images or bill data on the server.
- Friendly error states: blurry photo, not a bill, API failure.

## Design
Clean, modern, mobile-first. One-handed use on a phone. Big tap targets.
Dark mode support. App name: "Splitly" (or pick something better and short).

## Testing (must pass before publishing)
- Vitest unit tests for the split math: at least 8 cases, including shared items,
  discounts, service charge, odd rounding, and one person paying for everything.
- Run the real `/api/parse-bill` against every photo in `samples/` and confirm the
  parsed total matches the printed grand total, or that the warning appears.
- `npm run build` succeeds with zero type errors and zero lint errors.

## Learning files (I am learning to code through this project)
- `LEARN.md`: explain the architecture in plain English (what happens from photo
  to payment link), then walk through every file I'd need to understand, section
  by section, explaining what each part does and why. Write for someone new to code.
- End `LEARN.md` with 10 quiz questions about this codebase, with answers hidden
  in a collapsible `<details>` block.

## Publishing (do all of this yourself)
1. `git init`. Add a `.gitignore` that excludes `.env.local`, `node_modules`,
   `.next`, and `samples/` (my bills are private). Before every commit, confirm
   no secret or sample image is staged.
2. Commit in small steps with clear messages (scaffold, parsing, split logic,
   UI, tests, docs) — not one giant commit.
3. Write a strong `README.md`: what it does, the problem it solves, how it
   works, tech stack, how to run locally.
4. `gh repo create splitly --public --source=. --push` (if the name is taken,
   add a suffix).
5. Deploy: `vercel --prod --yes`. Add the key with
   `vercel env add ANTHROPIC_API_KEY production`, reading the value from
   `.env.local`, then redeploy. Connect the GitHub repo to the Vercel project so
   future pushes deploy automatically.
6. Verify the live site: the homepage loads, and `/api/parse-bill` works on the
   live URL with one sample image.
7. Add the live URL to the README and the GitHub repo description, then push.

## Final deliverables
- Write `POST.md`: a LinkedIn post draft (under 150 words) about building this —
  the problem, what it does, one technical thing I learned, live link, GitHub link.
- Write `DONE.md` with: live URL, GitHub URL, test results, anything that didn't
  work, and a 3-step guide for me to record a 30-second demo video.
