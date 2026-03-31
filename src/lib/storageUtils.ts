import { supabase } from '@/integrations/supabase/client';

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const SIGNED_URL_TTL = 3500; // seconds (just under 1h)

/**
 * Extracts the storage path from a full public/signed URL or returns the path as-is.
 */
export function extractStoragePath(urlOrPath: string, bucket: string): string {
  if (!urlOrPath.startsWith('http')) return urlOrPath;
  // Match /object/public/<bucket>/ or /object/sign/<bucket>/
  const patterns = [
    `/object/public/${bucket}/`,
    `/object/sign/${bucket}/`,
  ];
  for (const pattern of patterns) {
    const idx = urlOrPath.indexOf(pattern);
    if (idx !== -1) {
      const afterPattern = urlOrPath.substring(idx + pattern.length);
      // Remove query params
      return afterPattern.split('?')[0];
    }
  }
  // Fallback: try to get last segment
  return urlOrPath.split('?')[0];
}

/**
 * Returns a signed URL for a file in the scout-photos bucket.
 * Caches results to avoid redundant API calls.
 */
export async function getSignedPhotoUrl(urlOrPath: string): Promise<string | null> {
  if (!urlOrPath) return null;

  const path = extractStoragePath(urlOrPath, 'scout-photos');
  
  // Check cache
  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now() / 1000) {
    return cached.url;
  }

  const { data, error } = await supabase.storage
    .from('scout-photos')
    .createSignedUrl(path, SIGNED_URL_TTL);

  if (error || !data?.signedUrl) {
    console.warn('Failed to get signed URL for', path, error);
    return null;
  }

  signedUrlCache.set(path, {
    url: data.signedUrl,
    expiresAt: Date.now() / 1000 + SIGNED_URL_TTL - 60,
  });

  return data.signedUrl;
}

/**
 * Upload a file to scout-photos and return the storage path (not a public URL).
 */
export async function uploadScoutPhoto(
  path: string,
  file: File | Blob,
): Promise<string | null> {
  const { error } = await supabase.storage
    .from('scout-photos')
    .upload(path, file, { upsert: true });

  if (error) {
    console.error('Upload error:', error);
    return null;
  }

  return path;
}
