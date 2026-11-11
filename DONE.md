# Splitly: done

## Links

- **Live app:** https://splitly-upi.vercel.app
  (also served at https://bill-splitter-amber-chi.vercel.app, Vercel's default name for the project)
- **GitHub (public):** https://github.com/vivaansheth5/splitly

## Test results

| Check | Result |
|---|---|
| Vitest unit tests (`npm test`) | ✅ 23/23 passed. 12 split-math cases (shared items, GST, service charge + round off, discounts, odd rounding, one person pays everything, payer ate nothing, unpicked items, removed people, bad input, 2,000 random bills) + 11 helper tests |
| `npm run build` | ✅ exits 0, TypeScript passes with zero errors |
| `npm run lint` | ✅ zero errors, zero warnings |
| Samples vs **local** API (`node scripts/test-samples.mjs http://localhost:3456`) | ✅ 3/3 |
| Samples vs **live** API (`node scripts/test-samples.mjs https://splitly-upi.vercel.app`) | ✅ 3/3 |
| Live homepage | ✅ HTTP 200, renders the upload screen |
| Live full click-through in headless Chrome (upload → review → assign → pay, QR shown, UPI ID remembered) | ✅ no console errors |
| API key not in browser JavaScript | ✅ 0 occurrences in all client bundles |
| Live rate limit | ✅ requests beyond 10/minute from one IP get HTTP 429 |
| Error states (fake image, missing file, non-bill photo) | ✅ friendly `not_image`, `bad_request`, `not_a_bill` messages |
| GitHub → Vercel auto-deploy | ✅ connected; a push triggered a production deploy by itself |
| Nothing private committed | ✅ `.env.local` and `samples/` are git-ignored; every commit was checked for sample images and `sk-ant-` keys |

Sample results on the live API (parsed grand total vs the printed one):

| Sample | Items found | Parsed total | Printed total | Adds up? |
|---|---|---|---|---|
| RESTAURANT BILL 1.jpeg | 14 | ₹4,770.00 | ₹4,770.00 | ✅ no warning needed |
| RESTAURANT BILL 2.jpg | 8 (₹0 flavour lines correctly skipped) | ₹5,226.00 | ₹5,226.00 | ✅ no warning needed |
| RESTAURANT BILL 3.jpeg | 1 (discount + "Gas Crisis Charge" captured) | ₹374.00 | ₹374.00 | ✅ no warning needed |

## What didn't work / what to know

1. **Auto-deploy from GitHub is on.** The repo `vivaansheth5/splitly` is connected to the Vercel
   project, so every `git push` to `main` deploys automatically (verified with a test push).
2. **`splitly.vercel.app` was already taken** by someone else, so the app lives at
   `splitly-upi.vercel.app`. The Vercel project itself is called `bill-splitter` (from the folder
   name). You can rename it in the Vercel dashboard if you like.
3. **The rate limit is per server instance.** Vercel can run several copies of the server, each with
   its own memory, so it's a simple guard, not a strict global limit. A shared store (e.g. Upstash
   Redis) would make it strict.
4. **HEIC photos** are converted in the browser. Safari opens them natively; Chrome/Firefox download
   a converter the first time. If both fail, the server politely asks for a JPG.
5. **Refusal fallback not enabled.** The Claude call doesn't use Anthropic's optional "fallback model"
   beta. A bill photo is very unlikely to be refused, and if it ever is, the user sees "We couldn't
   read this bill. Please try another photo."
6. I couldn't test on a physical phone. The UPI button opening GPay/PhonePe, and the camera
   button, need a real device. Everything else was tested in a mobile-sized Chrome window.

## Record a 30-second demo video (3 steps)

1. **Set up (before recording):** on your phone, open https://splitly-upi.vercel.app, turn on screen
   recording (iPhone: Control Centre → Record; Android: Quick Settings → Screen record), and have a
   real restaurant bill on the table.
2. **Record (~25 seconds):** tap **Take a photo of the bill** → snap it → pause one second on the green
   "Everything adds up" check → **Looks right** → add two friends' names → tap a couple of items for
   each, then **Split the rest between everyone** → **See who owes what** → type your UPI ID → tap
   **Show QR code**, then **WhatsApp** to show the ready-made message.
3. **Finish:** trim the start and end in your phone's Photos app, add a one-line caption like
   "Bill → UPI links in 20 seconds", and post it with the text from `POST.md`.
