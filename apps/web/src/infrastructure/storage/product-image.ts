/**
 * Product image Storage integration (Phase 4 §11). Uploads a compressed JPEG to the
 * business-scoped, member-gated path enforced by Storage rules. The old object is deleted
 * server-side by the setProductImage callable, so images are never orphaned (fixes legacy KL-03).
 * This lives in the infrastructure layer — UI never touches Storage directly.
 */
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getFirebaseStorage } from '@/lib/firebase/storage';
import { newId } from '@hynish/domain';
import { compressImage } from '@/lib/image';

export interface UploadedImage {
  path: string;
  downloadUrl: string;
}

/** Compress and upload a product image; returns the storage path + a display URL. */
export async function uploadProductImage(
  businessId: string,
  productId: string,
  file: File,
): Promise<UploadedImage> {
  const { blob } = await compressImage(file);
  const path = `businesses/${businessId}/products/${productId}/${newId()}.jpg`;
  const storageRef = ref(getFirebaseStorage(), path);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  const downloadUrl = await getDownloadURL(storageRef);
  return { path, downloadUrl };
}

/** Resolve a display URL for a stored image path (used by list/detail views). */
export async function resolveImageUrl(path: string): Promise<string> {
  return getDownloadURL(ref(getFirebaseStorage(), path));
}
