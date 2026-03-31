import { useState, useEffect } from 'react';
import { getSignedPhotoUrl } from '@/lib/storageUtils';

/**
 * Hook that resolves a scout-photos public URL or path into a signed URL.
 * Returns null while loading, or the signed URL once ready.
 */
export function useSignedUrl(urlOrPath: string | null | undefined): string | null {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!urlOrPath) {
      setSignedUrl(null);
      return;
    }

    let cancelled = false;
    getSignedPhotoUrl(urlOrPath).then(url => {
      if (!cancelled) setSignedUrl(url);
    });

    return () => { cancelled = true; };
  }, [urlOrPath]);

  return signedUrl;
}

/**
 * Hook that resolves multiple scout-photo URLs into signed URLs.
 */
export function useSignedUrls(items: { id: string; photoUrl: string | null }[]): Map<string, string> {
  const [urlMap, setUrlMap] = useState<Map<string, string>>(new Map());

  useEffect(() => {
    let cancelled = false;
    const resolve = async () => {
      const entries: [string, string][] = [];
      await Promise.all(
        items
          .filter(i => i.photoUrl)
          .map(async (item) => {
            const signed = await getSignedPhotoUrl(item.photoUrl!);
            if (signed) entries.push([item.id, signed]);
          })
      );
      if (!cancelled) setUrlMap(new Map(entries));
    };
    resolve();
    return () => { cancelled = true; };
  }, [items.map(i => i.id + i.photoUrl).join(',')]);

  return urlMap;
}
