/**
 * Product photo picker (Phase 4 §11). Shows the current photo (existing storage path or a freshly
 * picked file), lets the user replace or remove it, and reports the choice UP to the form — it never
 * uploads or writes Storage itself. The form saves the product first, then the service compresses +
 * uploads the file and records it server-side (which deletes the previous object; fixes legacy KL-03).
 */
import { useEffect, useRef, useState } from 'react';
import { ImageIcon, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { resolveImageUrl } from '@/infrastructure/storage/product-image';

const ACCEPTED = 'image/jpeg,image/png,image/webp';
const MAX_INPUT_BYTES = 8 * 1024 * 1024;

export interface ProductImageFieldProps {
  /** Storage path of the already-saved image, or null when there is none / it was cleared. */
  existingPath: string | null;
  /** A newly picked file, or null. Kept in the parent so it survives re-renders. */
  file: File | null;
  onFileSelected: (file: File) => void;
  onCleared: () => void;
}

export function ProductImageField({ existingPath, file, onFileSelected, onCleared }: ProductImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [existingUrl, setExistingUrl] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Resolve a display URL for the already-saved image.
  useEffect(() => {
    let cancelled = false;
    if (!existingPath || file) {
      setExistingUrl(null);
      return;
    }
    setResolving(true);
    resolveImageUrl(existingPath)
      .then((url) => {
        if (!cancelled) setExistingUrl(url);
      })
      .catch(() => {
        if (!cancelled) setExistingUrl(null);
      })
      .finally(() => {
        if (!cancelled) setResolving(false);
      });
    return () => {
      cancelled = true;
    };
  }, [existingPath, file]);

  // Object URL for the freshly picked file (revoked on change/unmount).
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setFileUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setFileUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const previewUrl = fileUrl ?? existingUrl;

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const picked = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file
    if (!picked) return;
    if (!ACCEPTED.split(',').includes(picked.type)) {
      setError('Please choose a JPEG, PNG or WebP image.');
      return;
    }
    if (picked.size > MAX_INPUT_BYTES) {
      setError('Image is too large (max 8 MB).');
      return;
    }
    onFileSelected(picked);
  }

  function clear() {
    setError(null);
    onCleared();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <div className="flex size-24 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-muted">
          {previewUrl ? (
            <img src={previewUrl} alt="Product" className="size-full object-cover" />
          ) : (
            <ImageIcon className="size-8 text-muted-foreground" aria-hidden />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input ref={inputRef} type="file" accept={ACCEPTED} className="sr-only" onChange={onPick} aria-label="Choose product photo" />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} loading={resolving}>
              <Upload className="size-4" /> {previewUrl ? 'Replace' : 'Upload photo'}
            </Button>
            {previewUrl && (
              <Button type="button" variant="ghost" size="sm" onClick={clear}>
                <X className="size-4" /> Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">JPEG, PNG or WebP. Resized to 500px on upload.</p>
        </div>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
