import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { ParsedBillSchema, checkBill, toBill } from "@/lib/bill";
import { MAX_UPLOAD_BYTES, sniffImageType } from "@/lib/imageCheck";
import { clientIp, rateLimit } from "@/lib/rateLimit";

// Reading a photo can take a while; give the function up to 60 seconds.
export const maxDuration = 60;

const MODEL = "claude-sonnet-5-5";

const PROMPT = `You are reading a photo of a restaurant bill (usually Indian, amounts in rupees).
Extract it exactly as printed. Rules:
- items: one entry per ordered line. "price" is the line's total amount (quantity x rate), not the rate.
- Skip lines whose amount is 0.00 (flavour choices, modifiers, notes). Do not invent items.
- taxes: each tax line separately (CGST, SGST, IGST, VAT, cess on tax...). Use the printed amount.
- serviceCharge: service charge / SERC amount, or 0.
- otherCharges: any other added charge (packing, delivery, "gas charge", etc.).
- discounts: each discount as a positive number.
- roundOff: the round-off line with its sign (e.g. -0.16), or 0.
- grandTotal: the final payable amount (Grand Total / Net Amount / Total Payable).
- Copy numbers exactly as printed; do not "fix" the bill's maths.
- If the photo is not a bill, set isBill=false. If it is too blurry or cut off to read the amounts, set readable=false. Explain briefly in "problem".`;

function errorResponse(status: number, code: string, message: string, extraHeaders?: HeadersInit) {
  return Response.json({ error: { code, message } }, { status, headers: extraHeaders });
}

export async function POST(request: Request) {
  // 1. Rate limit: 10 requests per minute per IP.
  const limit = rateLimit(clientIp(request.headers));
  if (!limit.ok) {
    return errorResponse(429, "rate_limited", "Too many bills at once. Please wait a minute and try again.", {
      "Retry-After": String(limit.retryAfterSeconds),
    });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return errorResponse(500, "not_configured", "The server isn't set up to read bills yet.");
  }

  // 2. Get the uploaded file and check it on the server (never trust the browser).
  let file: File | null = null;
  try {
    const form = await request.formData();
    const value = form.get("image");
    file = value instanceof File ? value : null;
  } catch {
    return errorResponse(400, "bad_request", "Please upload a photo of the bill.");
  }
  if (!file) return errorResponse(400, "no_file", "Please upload a photo of the bill.");
  if (file.size > MAX_UPLOAD_BYTES) {
    return errorResponse(413, "too_large", "That photo is over 8 MB. Please use a smaller one.");
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImageType(bytes);
  if (!kind) {
    return errorResponse(415, "not_image", "That file isn't a JPG, PNG or HEIC image.");
  }
  if (kind === "image/heic") {
    // The browser normally converts HEIC to JPEG before upload. Claude can't read HEIC directly.
    return errorResponse(
      415,
      "heic_unsupported",
      "This browser couldn't convert the HEIC photo. Please take a screenshot of it or share it as JPG.",
    );
  }

  // 3. Ask Claude to read the bill. The image lives only in memory for this request.
  const client = new Anthropic();
  let message;
  try {
    message = await client.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      output_config: { effort: "medium", format: zodOutputFormat(ParsedBillSchema) },
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: kind, data: Buffer.from(bytes).toString("base64") },
            },
            { type: "text", text: PROMPT },
          ],
        },
      ],
    });
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      return errorResponse(503, "api_busy", "The bill reader is busy right now. Please try again in a moment.");
    }
    if (err instanceof Anthropic.APIError) {
      console.error("Anthropic API error", err.status, err.name);
      return errorResponse(502, "api_failure", "We couldn't read the bill right now. Please try again.");
    }
    console.error("Unexpected error reading bill", err instanceof Error ? err.name : "unknown");
    return errorResponse(500, "api_failure", "Something went wrong reading the bill. Please try again.");
  }

  if (message.stop_reason === "refusal" || message.stop_reason === "max_tokens") {
    return errorResponse(502, "api_failure", "We couldn't read this bill. Please try another photo.");
  }

  // 4. Validate Claude's answer with zod before trusting it.
  const result = ParsedBillSchema.safeParse(message.parsed_output);
  if (!result.success) {
    return errorResponse(502, "bad_output", "We couldn't make sense of this bill. Please try a clearer photo.");
  }
  const parsed = result.data;
  if (!parsed.isBill) {
    return errorResponse(422, "not_a_bill", "This doesn't look like a bill. Please take a photo of the receipt.");
  }
  if (!parsed.readable) {
    return errorResponse(
      422,
      "blurry",
      "The photo is too blurry to read. Try again in good light, holding the phone steady and close to the bill.",
    );
  }

  const bill = toBill(parsed);
  return Response.json({ bill, check: checkBill(bill) });
}
