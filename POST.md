Every group dinner ends the same way: one person pays, then someone spends ten minutes with a calculator splitting GST and service charge "roughly".

So I built Splitly. Snap the bill and AI reads every line: items, CGST/SGST, service charge, discounts, round off. Tap who had what. Everyone gets their exact share with a UPI pay button, a QR code and a WhatsApp message.

One thing I learned: never do money maths with decimals. In JavaScript, 0.1 + 0.2 = 0.30000000000000004. Splitly works in whole paise, shares tax in proportion to what each person ate, and gives the leftover paisa to whoever paid. The total always matches the bill exactly.

I'm learning to code, and this is my first app that's live on the internet.

Try it: https://splitly-upi.vercel.app
Code: https://github.com/vivaansheth5/splitly

#BuildInPublic #NextJS #UPI #LearningToCode
