// Runs in the browser: shrink the photo before uploading so it's fast on mobile data.
// A 12-megapixel phone photo (~4 MB) becomes a ~300 KB JPEG that is still sharp
// enough to read every line of the bill.

import { MAX_UPLOAD_BYTES } from "./imageCheck";

const MAX_SIDE = 2000; // pixels on the longest side
const QUALITY = 0.85;

export class ImageInputError extends Error {}

function looksLikeHeic(file: File): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
}

export function checkSelectedFile(file: File): void {
  const isImage = file.type.startsWith("image/") || looksLikeHeic(file);
  if (!isImage) throw new ImageInputError("Please choose a photo (JPG, PNG or HEIC).");
  if (file.size > MAX_UPLOAD_BYTES) throw new ImageInputError("That photo is over 8 MB. Please use a smaller one.");
}

async function decode(blob: Blob): Promise<ImageBitmap> {
  return createImageBitmap(blob, { imageOrientation: "from-image" });
}

export async function compressImage(file: File): Promise<Blob> {
  checkSelectedFile(file);

  let bitmap: ImageBitmap;
  try {
    bitmap = await decode(file);
  } catch {
    if (!looksLikeHeic(file)) throw new ImageInputError("We couldn't open that photo. Try a different one.");
    // Chrome and Firefox can't open iPhone HEIC photos, so convert them first.
    // The converter is large, so it's only downloaded when it's needed.
    const { default: heic2any } = await import("heic2any");
    const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: QUALITY });
    bitmap = await decode(Array.isArray(converted) ? converted[0] : converted);
  }

  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageInputError("Your browser couldn't process the photo.");
  ctx.fillStyle = "#fff"; // transparent PNGs become white, not black
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  if (!blob) throw new ImageInputError("Your browser couldn't process the photo.");

  // If the original was already a small JPEG/PNG, keep whichever is smaller.
  if (!looksLikeHeic(file) && file.size <= blob.size && /image\/(jpeg|png)/.test(file.type)) return file;
  return blob;
}
