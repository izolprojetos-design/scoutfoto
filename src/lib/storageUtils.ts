import { supabase } from '@/integrations/supabase/client';

const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();
const SIGNED_URL_TTL = 3500; // seconds (just under 1h)

/** In-flight requests to coalesce duplicate calls for the same path. */
const inflight = new Map<string, Promise<string | null>>();

/**
 * Extracts the storage path from a full public/signed URL or returns the path as-is.
 */
export function extractStoragePath(urlOrPath: string, bucket: string): string {
  if (!urlOrPath.startsWith('http')) return urlOrPath;
  const patterns = [
    `/object/public/${bucket}/`,
    `/object/sign/${bucket}/`,
  ];
  for (const pattern of patterns) {
    const idx = urlOrPath.indexOf(pattern);
    if (idx !== -1) {
      const afterPattern = urlOrPath.substring(idx + pattern.length);
      return afterPattern.split('?')[0];
    }
  }
  return urlOrPath.split('?')[0];
}

/**
 * Returns a signed URL for a file in the scout-photos bucket.
 * Caches results and coalesces concurrent calls for the same path.
 */
export async function getSignedPhotoUrl(urlOrPath: string): Promise<string | null> {
  if (!urlOrPath) return null;

  const path = extractStoragePath(urlOrPath, 'scout-photos');

  const cached = signedUrlCache.get(path);
  if (cached && cached.expiresAt > Date.now() / 1000) {
    return cached.url;
  }

  const existing = inflight.get(path);
  if (existing) return existing;

  const promise = (async () => {
    const { data, error } = await supabase.storage
      .from('scout-photos')
      .createSignedUrl(path, SIGNED_URL_TTL);

    if (error || !data?.signedUrl) {
      console.warn('Failed to get signed URL for', path, error);
      inflight.delete(path);
      return null;
    }

    signedUrlCache.set(path, {
      url: data.signedUrl,
      expiresAt: Date.now() / 1000 + SIGNED_URL_TTL - 60,
    });
    inflight.delete(path);
    return data.signedUrl;
  })();

  inflight.set(path, promise);
  return promise;
}

/**
 * Batch-create signed URLs for any bucket, with shared cache.
 * Much faster than awaiting each createSignedUrl in series.
 */
const bucketCache = new Map<string, Map<string, { url: string; expiresAt: number }>>();

export async function getSignedUrlsBatch(
  bucket: string,
  paths: string[],
  ttl = 3600,
): Promise<Record<string, string>> {
  const result: Record<string, string> = {};
  if (!paths.length) return result;

  let cache = bucketCache.get(bucket);
  if (!cache) {
    cache = new Map();
    bucketCache.set(bucket, cache);
  }

  const now = Date.now() / 1000;
  const toFetch: string[] = [];
  for (const p of paths) {
    if (!p) continue;
    const c = cache.get(p);
    if (c && c.expiresAt > now) {
      result[p] = c.url;
    } else {
      toFetch.push(p);
    }
  }

  if (toFetch.length) {
    // createSignedUrls accepts an array — single round-trip
    const { data } = await supabase.storage.from(bucket).createSignedUrls(toFetch, ttl);
    if (data) {
      for (const item of data) {
        if (item.signedUrl && item.path) {
          result[item.path] = item.signedUrl;
          cache.set(item.path, {
            url: item.signedUrl,
            expiresAt: now + ttl - 60,
          });
        }
      }
    }
  }

  return result;
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
