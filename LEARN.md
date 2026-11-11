# Learning Splitly: how this app works, explained from scratch

This guide is for someone new to code. Read it top to bottom once, then keep it open while you
read the real files. Every file mentioned here is in this repo.

---

## Part 1: The big picture (photo → payment link)

Splitly has two halves that run in two different places:

- **The front end** runs *in your phone's browser*. It's the screens, buttons and maths you see.
- **The back end** (the "server") runs *on Vercel's computers*. It has one job: take a photo, ask
  Claude (an AI model made by Anthropic) to read it, and send the answer back.

Why split it like this? Because talking to Claude needs a secret **API key** (like a password that
costs money when used). Anything in the browser can be seen by anyone, so the key must only live on
the server.

Here is the full journey of one bill:

1. **You take a photo.** Phone photos are huge (3–5 MB). The browser shrinks it to about 300 KB by
   drawing it onto an invisible `<canvas>` at a smaller size and saving it as a JPEG. If it's an
   iPhone HEIC photo that the browser can't open, a converter library turns it into JPEG first.
2. **The browser uploads it** to the server address `/api/parse-bill`.
3. **The server protects itself**: it limits each person to 10 photos per minute, rejects files over
   8 MB, and looks at the first few bytes of the file to make sure it's really an image.
4. **The server asks Claude** to read the bill and reply in an exact JSON shape (JSON is a standard
   text format for data, like `{"grandTotal": 374}`).
5. **The server double-checks Claude's answer** with a library called **zod**, converts every amount
   to **paise** (whole numbers, ₹1 = 100 paise), and checks whether the bill adds up.
6. **The browser shows the bill.** If something doesn't add up, a yellow warning appears and you can
   fix any line by hand.
7. **You add people and tap items** to say who had what.
8. **The split maths runs in the browser**: each person's items, plus their fair share of taxes and
   charges, rounded to the paisa so the total is exact.
9. **Payment links are built**: a `upi://pay?...` link (opens GPay/PhonePe), a QR code of that same
   link, and a WhatsApp message containing it.

Nothing is saved on the server. The photo exists only in memory while that one request runs.

---

## Part 2: The files, one by one

### `package.json`: the shopping list

Lists the libraries the app uses ("dependencies") and handy commands ("scripts"):

- `npm run dev`: start the app on your computer at http://localhost:3000
- `npm run build`: make the optimised version for the internet (also type-checks everything)
- `npm test`: run the automated tests
- `npm run lint`: check the code for common mistakes

Key libraries: `next` (the framework), `react` (builds the screens), `@anthropic-ai/sdk` (talks to
Claude), `zod` (checks data shapes), `qrcode` (draws QR codes), `heic2any` (converts iPhone photos),
`vitest` (runs tests).

### `.gitignore`: what never gets uploaded to GitHub

`.env.local` (holds the secret API key), `node_modules` (downloaded libraries, rebuilt by
`npm install`), `.next` (build output) and `samples/` (your private bill photos).

---

### `src/lib/money.ts`: why paise and not rupees

Computers store decimals in binary, which can't represent some numbers exactly. In JavaScript,
`0.1 + 0.2` gives `0.30000000000000004`. With money, those tiny errors add up and a split ends up
₹0.01 off. The fix: store **whole paise** (integers), which are always exact.

- `toPaise(113.58)` → `11358`. It multiplies by 100 and rounds to clean up binary noise.
- `paiseToRupeeString(11358)` → `"113.58"`, used inside UPI links.
- `formatRupees(477000)` → `"₹4,770.00"`, for display (uses Indian digit grouping like 1,23,456).
- `parseRupeeInput("₹1,234.5")` → `123450`, turns what you typed into paise, or `null` if it's not
  a valid number.

### `src/lib/bill.ts`: the shape of a bill

**Section 1: `ParsedBillSchema`.** A zod schema is a description of what data must look like.
For example `z.number()` means "must be a number". This one schema does two jobs:
1. It's turned into instructions that force Claude to reply in exactly this shape.
2. After Claude replies, `ParsedBillSchema.safeParse(...)` confirms the reply really matches. Never
   trust data from outside your code (users, AIs, other servers) without checking it.

The `.describe(...)` text on each field is shown to Claude as a hint, e.g. "Each discount as a
POSITIVE amount".

**Section 2: the `Bill` type.** The version of the bill the app uses: the same information, but every
amount is in paise (`pricePaise`, `grandTotalPaise`...). Each item and line gets an `id` so React can
keep track of it while you edit. `toBill()` converts Claude's answer (rupees) into a `Bill` (paise),
and drops ₹0.00 lines like flavour choices.

**Section 3: checks.** `checkBill()` answers two questions:
- Do the items add up to the printed subtotal?
- Do items + taxes + service charge + other charges − discounts + round off equal the grand total?
  (It allows ₹1 of wiggle room, because restaurants sometimes round each tax line.)

If not, it returns friendly warning sentences, which the Review screen shows in yellow.

### `src/lib/split.ts`: the heart of the app

This is the fairness maths. `splitBill()` receives the people, who paid, the items (with who shared
each one) and the total to split, and returns each person's share.

The rule:
- You pay for what you had. An item shared by 3 people costs each of them a third.
- Everything else (tax, service charge, discounts, round off) is shared *in proportion*. If your
  items were 30% of the food, you pay 30% of the tax.

That simplifies to one formula: **your share = (your items ÷ all items) × grand total**.

The tricky part is fractions. ₹100 split 3 ways is ₹33.333… Step by step, here's how the code keeps
it exact:

1. **Unpicked items go to the payer**, so no money disappears.
2. **Common unit.** `L` is the smallest number that every group size divides into (for groups of 2
   and 3, `L = 6`). Each item is measured in "1/L paise". An item shared by `n` people gives each
   person `price × (L ÷ n)` units, always a whole number. No fractions yet.
3. **BigInt.** These numbers can get very big when multiplied, beyond what normal JavaScript numbers
   store exactly, so the code uses `BigInt`, JavaScript's unlimited-size whole numbers (written like
   `0n`).
4. **Round down for everyone except the payer.** Each non-payer gets
   `floor(myUnits × total ÷ allUnits)`. "Floor" means round down.
5. **The payer gets what's left**: `total − everyone else`. That's the rule "leftover paise go to the
   person who paid", and it guarantees the shares add up to the total *exactly*.
6. **Safety net.** At the end it re-adds everything and throws an error if it doesn't match. It
   should never happen, but crashing is better than sending someone a wrong amount.

`floorDiv()` exists because BigInt division rounds *toward zero* (−3.5 becomes −3), but we need
true rounding *down* (−3.5 becomes −4).

### `src/lib/split.test.ts` and `src/lib/helpers.test.ts`: the tests

A test is code that runs your code and checks the answer. `expect(r.a.totalPaise).toBe(3334)` means
"fail loudly if this isn't 3334". The split tests cover: separate items, shared items, GST, service
charge + GST + round off (using a real bill), discounts, odd rounding (₹100 ÷ 3), one person paying
for everything, a payer who ate nothing, unpicked items, and 2,000 random bills that must all add up
exactly. The helper tests check money formatting, bill warnings, UPI links, image detection and the
rate limiter. Run them all with `npm test`.

### `src/lib/upi.ts`: payment links

UPI apps understand links like:

```
upi://pay?pa=arjun@okicici&pn=Arjun&am=187.00&cu=INR&tn=Splitly%20-%20Theo%20Cafe
```

`pa` = payee address (your UPI ID), `pn` = payee name, `am` = amount, `cu` = currency, `tn` = note.
`encodeURIComponent` turns spaces and symbols into `%20`-style codes so the link doesn't break. The
`@` is put back as-is because some UPI apps don't understand `%40`.

`isValidUpiId()` uses a **regular expression** (a text pattern) to check the ID looks like
`something@bank`. `buildWhatsAppLink()` builds `https://wa.me/?text=...`, which opens WhatsApp with
the message typed in, ready for you to pick a contact.

### `src/lib/rateLimit.ts`: stopping abuse

Every Claude call costs money, so one person shouldn't be able to send 1,000 photos. The limiter
keeps a `Map` (a lookup table) from IP address → list of recent request times. If an IP has 10 in the
last 60 seconds, the request is refused with HTTP status **429 Too Many Requests**. Note: on Vercel,
several copies of the server can run at once and each keeps its own list, so this is a simple guard,
not a perfect global limit.

### `src/lib/imageCheck.ts`: is this really an image?

A file called `photo.jpg` could secretly be anything. Real file formats start with known
"magic bytes": JPEGs start with `FF D8 FF`, PNGs with `89 50 4E 47...`. `sniffImageType()` reads
those bytes to decide what the file really is.

### `src/lib/compressImage.ts`: shrinking photos in the browser

Runs on your phone, not the server. It opens the photo with `createImageBitmap`, draws it on a
canvas at most 2000 pixels on the longest side, and exports a JPEG at 85% quality. If the browser
can't open a HEIC photo, it *dynamically imports* `heic2any`: the converter is only downloaded when
needed, so everyone else's page stays fast.

---

### `src/app/api/parse-bill/route.ts`: the server

In Next.js, a file named `route.ts` inside `src/app/api/parse-bill/` automatically becomes the web
address `/api/parse-bill`. Exporting a function called `POST` means it handles uploads. Walk through
it top to bottom:

1. `maxDuration = 60`: allow up to 60 seconds (AI reading can take a few seconds).
2. **Rate limit** using the caller's IP.
3. **Read the upload** with `request.formData()`, then check size and magic bytes. HEIC is refused
   here because Claude can't read HEIC (the browser normally converts it first).
4. **Call Claude** with `client.messages.parse(...)`:
   - `model: "claude-sonnet-5-5"`, the AI model.
   - The message contains the image (as base64 text, a way of writing bytes as letters) plus the
     instructions in `PROMPT`.
   - `output_config.format: zodOutputFormat(ParsedBillSchema)` forces the reply to match our schema.
   - `effort: "medium"` balances speed and care.
   - `new Anthropic()` automatically reads `ANTHROPIC_API_KEY` from the server's environment, so the
     key never appears in the code.
5. **Handle errors** (`try / catch`): if Claude is busy or fails, return a friendly message instead
   of crashing. The code never logs the key or the photo.
6. **Validate** with zod, then turn special cases into friendly errors: `not_a_bill`, `blurry`.
7. **Reply** with `{ bill, check }` as JSON.

### `src/app/layout.tsx` and `src/app/page.tsx`

`layout.tsx` wraps every page: it loads the font, sets the page title and description, and the
mobile viewport. `page.tsx` is the home page at `/` and simply shows `<SplitlyApp />`.

### `src/app/globals.css`: colours and dark mode

Sets the background and text colours as CSS variables, and swaps them when the phone is in dark mode
(`@media (prefers-color-scheme: dark)`). Tailwind's `dark:` classes in the components do the same
for individual elements. Inputs are kept at 16px so iPhones don't zoom in when you tap them.

---

### The screens (`src/components/`)

These are **React components**: functions that return what the screen should look like. When their
**state** (remembered data) changes, React redraws them automatically. `"use client"` at the top
means "this runs in the browser".

**`SplitlyApp.tsx`: the conductor.** It holds the important state with `useState`:
`step` (which screen), `bill`, `people`, `payerId` and `assignments` (item id → list of person ids).
It shows the progress bar and exactly one screen, passing each screen the data it needs plus
functions to change it (for example `onNext={() => setStep("pay")}`).

**`UploadStep.tsx`: screen 1.** Two hidden `<input type="file">` elements: one with
`capture="environment"` (opens the back camera) and one for the gallery. The big buttons just
"click" those hidden inputs. `handleFile` shrinks the photo, sends it with `fetch`, and either moves
on or shows an error box. `ERROR_TITLES` maps server error codes to friendly headings.

**`ReviewStep.tsx`: screen 2.** Shows every item, tax, charge, discount, round off and the grand total
as editable boxes. Every change calls `onChange` with a *new* bill object (React needs a new object
to notice the change, which is why you see `{ ...bill, ...patch }`: "copy the bill, then overwrite
these fields"). It runs `checkBill` on every redraw, so the warning updates as you type. If the lines
don't match the total, a button offers to use the calculated total. `LineEditor` is a small reusable
piece used for taxes, other charges and discounts. `NavButtons` (Back / Next) is shared by other
screens.

**`MoneyInput.tsx`: a price box.** While typing "12." the text isn't a valid amount yet, so the box
remembers the raw text separately and only reports a value (in paise) when it's valid. Invalid input
gets a red border.

**`AssignStep.tsx`: screen 3.** A form adds people as chips (each gets a colour and initial). Tapping
a chip makes that person "active"; tapping an item adds or removes the active person from it.
Items show the initials of everyone sharing them and "split 3 ways". The Next button stays disabled
until there are at least 2 people and every item has someone; a shortcut splits any remaining items
between everyone. You also choose who paid the restaurant.

**`PayStep.tsx`: screen 4.** The payer types their name and UPI ID. The UPI ID is saved in
`localStorage` (a small storage box in the browser) inside `try/catch`, because some browsers (like
private mode) throw errors when you touch it. `useMemo` runs `splitBill` only when its inputs change.
The green box checks the shares add up to the grand total. Each person gets a card with their items
share, their tax & charges share, a **Pay** button (the `upi://` link), a **WhatsApp** button, and a
**QR code** you can show them to scan.

**`QrCode.tsx`.** Uses the `qrcode` library to draw the link as an image. Making the QR is
asynchronous (it finishes a moment later), so it runs in `useEffect` and shows a grey placeholder
until ready.

**`types.ts`.** Shared TypeScript types (`Person`, `Assignments`, `Step`). TypeScript is JavaScript
with labels saying what kind of data each thing is, so mistakes are caught before the app runs.

### `scripts/test-samples.mjs`: testing with real bills

Sends every photo in `samples/` to a running server (local or live) and prints whether the parsed
grand total matches the printed one (from `samples/expected.json`), or whether the warning appeared.

---

## Part 3: Quiz

Try to answer each question before opening the answers.

1. Why does the Claude API key live only on the server and never in the browser?
2. Why does Splitly store money as paise (whole numbers) instead of rupees with decimals?
3. What two jobs does `ParsedBillSchema` (the zod schema) do?
4. A bill has ₹100 of items shared equally by 3 people, and the payer is one of them. How much does
   each person pay, and why?
5. If your items are 25% of the food total, what share of the GST and service charge do you pay?
6. What happens to an item that nobody was assigned to?
7. How does the server know an upload is really a JPEG, even if the file name lies?
8. What does the rate limiter do, and what HTTP status code does it send when you hit the limit?
9. Why is `localStorage` wrapped in `try/catch`?
10. In `upi://pay?pa=...&pn=...&am=...&cu=INR&tn=...`, what do `pa` and `am` mean?

<details>
<summary>Show answers</summary>

1. Anything sent to the browser can be read by anyone using the site. If the key were there, people
   could copy it and run up costs on your account. The server keeps it secret and only exposes
   `/api/parse-bill`.
2. Computers can't store many decimals exactly (`0.1 + 0.2 = 0.30000000000000004`). Whole numbers
   are always exact, so the split adds up to the paisa.
3. It forces Claude to reply in exactly that JSON shape (via `zodOutputFormat`), and it validates the
   reply afterwards with `safeParse` before the app trusts it.
4. The two non-payers each pay ₹33.33 (rounded down). The payer pays ₹33.34, because leftover paise
   from rounding go to the payer, so the total is exactly ₹100.00.
5. 25%. Taxes, charges and discounts are shared in proportion to each person's item subtotal.
6. It's put on the payer, so no money goes missing. (In the app, you must assign every item before
   continuing anyway.)
7. It checks the file's first bytes ("magic bytes"). JPEGs always start with `FF D8 FF`
   (`sniffImageType` in `imageCheck.ts`).
8. It allows at most 10 requests per minute from each IP address and refuses extra ones with HTTP
   429 (Too Many Requests), to stop abuse and protect API costs.
9. Some browsers (for example in private mode, or with storage blocked) throw an error when you use
   `localStorage`. Catching it means the app keeps working; it just won't remember the UPI ID.
10. `pa` is the payee address (the UPI ID money goes to) and `am` is the amount in rupees, like
    `187.00`.

</details>
