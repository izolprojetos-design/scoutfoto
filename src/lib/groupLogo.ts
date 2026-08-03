import { supabase } from '@/integrations/supabase/client';

/**
 * Branding storage layout:
 *   bucket: branding (public)
 *   path:   group-logo.<ext>  (we list to find current ext)
 *
 * Resolution order when generating PDFs:
 *   1) any file in the `branding` bucket starting with `group-logo`
 *   2) fallback to the bundled `/images/logo-grupo.png`
 */

const BUCKET = 'branding';
const LOGO_PREFIX = 'group-logo';
const FALLBACK_PATH = '/images/logo-grupo.png';

let cachedDataUrl: Promise<string | null> | null = null;

async function fetchAsDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const r = new FileReader();
      r.onloadend = () => resolve(r.result as string);
      r.onerror = () => resolve(null);
      r.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Returns the public URL of the current uploaded logo, or null if none. */
export async function getGroupLogoPublicUrl(): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(BUCKET)
    .list('', { limit: 20, search: LOGO_PREFIX });
  if (error || !data) return null;
  const file = data.find((f) => f.name.startsWith(LOGO_PREFIX));
  if (!file) return null;
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(file.name);
  // bust browser cache via updated_at
  const v = file.updated_at ? new Date(file.updated_at).getTime() : Date.now();
  return `${pub.publicUrl}?v=${v}`;
}

/** Returns a base64 data URL of the group logo (uploaded or fallback). Memoised. */
export async function getGroupLogoDataUrl(): Promise<string | null> {
  if (cachedDataUrl) return cachedDataUrl;
  cachedDataUrl = (async () => {
    const remote = await getGroupLogoPublicUrl();
    if (remote) {
      const d = await fetchAsDataUrl(remote);
      if (d) return d;
    }
    return fetchAsDataUrl(FALLBACK_PATH);
  })();
  return cachedDataUrl;
}

/** Call after a successful upload/removal to invalidate the in-memory cache. */
export function invalidateGroupLogoCache() {
  cachedDataUrl = null;
}

/** Upload a new logo, replacing any existing one. */
export async function uploadGroupLogo(file: File): Promise<string> {
  // Remove existing logo files first so only one remains.
  const { data: existing } = await supabase.storage
    .from(BUCKET)
    .list('', { limit: 20, search: LOGO_PREFIX });
  if (existing && existing.length) {
    await supabase.storage.from(BUCKET).remove(existing.map((f) => f.name));
  }
  const ext = (file.name.split('.').pop() || 'png').toLowerCase();
  const path = `${LOGO_PREFIX}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  invalidateGroupLogoCache();
  return path;
}

/** Remove the uploaded logo so the bundled fallback is used again. */
export async function removeGroupLogo(): Promise<void> {
  const { data: existing } = await supabase.storage
    .from(BUCKET)
    .list('', { limit: 20, search: LOGO_PREFIX });
  if (existing && existing.length) {
    await supabase.storage.from(BUCKET).remove(existing.map((f) => f.name));
  }
  invalidateGroupLogoCache();
}
