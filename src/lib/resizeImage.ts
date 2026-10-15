// ABOUTME: Canvas-based image downscaler for large phone screenshots so the
// ABOUTME: ingest-document edge function stays within Claude's payload limits.

const RESIZE_THRESHOLD_BYTES = 4 * 1024 * 1024;
const MAX_LONG_EDGE = 2000;
const JPEG_QUALITY = 0.85;

// Non-images pass through untouched. Images under the threshold pass through too.
// Anything larger is drawn to a canvas at ≤ 2000px longest edge and re-encoded
// as JPEG. Returns a File so the existing signed PUT upload path works unchanged.
export async function maybeResizeImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= RESIZE_THRESHOLD_BYTES) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    return file;
  }

  const longest = Math.max(bitmap.width, bitmap.height);
  const scale = longest > MAX_LONG_EDGE ? MAX_LONG_EDGE / longest : 1;
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    return file;
  }
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  if (!blob) return file;

  const nameNoExt = file.name.replace(/\.[^.]+$/, "");
  return new File([blob], `${nameNoExt}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}
