import { useState, useEffect, ImgHTMLAttributes } from 'react';
import { getSignedPhotoUrl } from '@/lib/storageUtils';
import { cn } from '@/lib/utils';

interface ScoutPhotoProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, 'src'> {
  photoUrl: string | null | undefined;
  fallback?: React.ReactNode;
  onBroken?: () => void;
}

/**
 * Component that auto-resolves scout-photos public URLs into signed URLs.
 * Shows fallback while loading or if the URL can't be resolved.
 */
const ScoutPhoto = ({ photoUrl, fallback, onBroken, className, alt, ...imgProps }: ScoutPhotoProps) => {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(!!photoUrl);
  const [errored, setErrored] = useState(false);

  useEffect(() => {
    if (!photoUrl) {
      setSignedUrl(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setErrored(false);

    getSignedPhotoUrl(photoUrl).then(url => {
      if (cancelled) return;
      if (url) {
        setSignedUrl(url);
      } else {
        setErrored(true);
        onBroken?.();
      }
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [photoUrl]);

  if (!photoUrl || errored) {
    return <>{fallback}</> || null;
  }

  if (loading || !signedUrl) {
    return (
      <div className={cn('animate-pulse bg-muted', className)} />
    );
  }

  return (
    <img
      src={signedUrl}
      alt={alt}
      loading="lazy"
      decoding="async"
      // @ts-expect-error fetchpriority is a valid HTML attr not yet typed
      fetchpriority="low"
      className={className}
      onError={() => {
        setErrored(true);
        onBroken?.();
      }}
      {...imgProps}
    />
  );
};

export default ScoutPhoto;
