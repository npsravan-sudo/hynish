/**
 * Client-side image compression (DEF-062: product photos ≤ 500px long side, JPEG q0.78).
 * Runs in the browser before upload so Storage only ever receives a small, validated image.
 */
export interface CompressedImage {
  blob: Blob;
  width: number;
  height: number;
}

const MAX_DIM = 500;
const QUALITY = 0.78;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const MAX_INPUT_BYTES = 8 * 1024 * 1024;

export async function compressImage(file: File): Promise<CompressedImage> {
  if (!ACCEPTED.includes(file.type)) throw new Error('Please choose a JPEG, PNG or WebP image.');
  if (file.size > MAX_INPUT_BYTES) throw new Error('Image is too large (max 8 MB before compression).');

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Could not process the image.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', QUALITY));
  if (!blob) throw new Error('Could not process the image.');
  return { blob, width, height };
}
