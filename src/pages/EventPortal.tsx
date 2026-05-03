import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Calendar, MapPin, Lock, Clock, ImageIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/scoutUtils';
import { ptBR } from 'date-fns/locale';

interface EventData {
  id: string;
  name: string;
  description: string | null;
  event_date: string | null;
  location: string | null;
}

interface ImageData {
  id: string;
  filename: string;
  storage_path: string;
  thumbnail_path: string | null;
  caption: string | null;
  tags: string[] | null;
  created_at: string;
}

const getSharedImageUrl = async (token: string, path: string): Promise<string | null> => {
  try {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const res = await fetch(
      `https://${projectId}.supabase.co/functions/v1/serve-shared-image?token=${encodeURIComponent(token)}&path=${encodeURIComponent(path)}`,
      {
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.url || null;
  } catch {
    return null;
  }
};

const EventPortal = () => {
  const { token } = useParams<{ token: string }>();
  const [event, setEvent] = useState<EventData | null>(null);
  const [images, setImages] = useState<ImageData[]>([]);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);

  useEffect(() => {
    const loadPortal = async () => {
      if (!token) {
        setError('Link inválido.');
        setLoading(false);
        return;
      }

      // Use secure RPC function to validate token
      const { data: linkRows, error: linkError } = await supabase
        .rpc('get_share_link_by_token', { p_token: token });

      const linkData = linkRows?.[0];

      if (linkError || !linkData) {
        setError('Link inválido ou expirado.');
        setLoading(false);
        return;
      }

      setExpiresAt(linkData.expires_at);

      // Increment view count via secure function
      await supabase.rpc('increment_share_link_view', { p_token: token });

      const { data: eventData } = await supabase
        .from('events')
        .select('id, name, description, event_date, location')
        .eq('id', linkData.event_id)
        .single();

      if (!eventData) {
        setError('Evento não encontrado.');
        setLoading(false);
        return;
      }

      setEvent(eventData);

      const { data: imgs } = await supabase
        .from('images')
        .select('id, filename, storage_path, thumbnail_path, caption, tags, created_at')
        .eq('event_id', eventData.id)
        .is('minor_age', null)
        .in('visibility', ['public', 'group'])
        .order('created_at', { ascending: false });

      const filtered = imgs || [];
      setImages(filtered);

      // Use edge function to get signed URLs for anonymous access
      const urls: Record<string, string> = {};
      const thumbs: Record<string, string> = {};
      
      await Promise.all(filtered.map(async (img) => {
        if (img.thumbnail_path) {
          const thumbUrl = await getSharedImageUrl(token, img.thumbnail_path);
          if (thumbUrl) thumbs[img.id] = thumbUrl;
        }
        const fullUrl = await getSharedImageUrl(token, img.storage_path);
        if (fullUrl) urls[img.id] = fullUrl;
      }));

      setImageUrls(urls);
      setThumbUrls(thumbs);
      setLoading(false);
    };

    loadPortal();
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Carregando fotos...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
        <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-muted mb-6">
          <Lock className="h-10 w-10 text-muted-foreground" />
        </div>
        <h1 className="mb-2 text-2xl font-bold tracking-tight">Acesso Indisponível</h1>
        <p className="text-center text-muted-foreground max-w-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/95 backdrop-blur sticky top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg scout-gradient shadow-sm overflow-hidden p-1">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain drop-shadow-sm" />
            </div>
            <span className="font-bold text-foreground tracking-tight">ScoutFoto</span>
          </div>
          {expiresAt && (
            <Badge variant="outline" className="gap-1.5 text-xs font-normal">
              <Clock className="h-3 w-3" />
              Expira em {format(new Date(expiresAt), "dd/MM/yyyy", { locale: ptBR })}
            </Badge>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">{event?.name}</h1>
          {event?.description && (
            <p className="mt-2 text-muted-foreground max-w-2xl">{event.description}</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {event?.event_date && (
              <Badge variant="secondary" className="gap-1.5 font-normal">
                <Calendar className="h-3 w-3" />
                {format(parseLocalDate(event.event_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </Badge>
            )}
            {event?.location && (
              <Badge variant="outline" className="gap-1.5 font-normal">
                <MapPin className="h-3 w-3" />
                {event.location}
              </Badge>
            )}
            <Badge variant="secondary" className="gap-1.5 font-normal">
              <ImageIcon className="h-3 w-3" />
              {images.length} {images.length === 1 ? 'foto' : 'fotos'}
            </Badge>
          </div>
        </div>

        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
              <ImageIcon className="h-8 w-8" />
            </div>
            <p className="text-lg font-medium text-foreground">Nenhuma foto disponível</p>
            <p className="mt-1 text-sm">As fotos deste evento ainda não foram publicadas</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {images.map((img, index) => (
              <motion.div
                key={img.id}
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(index * 0.03, 0.5) }}
                className="group cursor-pointer overflow-hidden rounded-xl bg-muted shadow-sm transition-shadow hover:shadow-md"
                onClick={() => setSelectedImage(img)}
              >
                <div className="aspect-square overflow-hidden">
                  {(thumbUrls[img.id] || imageUrls[img.id]) ? (
                    <img
                      src={thumbUrls[img.id] || imageUrls[img.id]}
                      alt={img.caption || img.filename}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <div className="mt-16 border-t py-8 text-center">
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <div className="w-6 h-6 rounded-md scout-gradient overflow-hidden p-0.5 inline-block align-middle mr-1 shadow-sm">
              <img src="/logo.png" alt="Logo" className="w-full h-full object-contain drop-shadow-sm" />
            </div>
            <span>ScoutFoto — Compartilhamento seguro de fotos escoteiras</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground/70">
            Este link é temporário e protegido. Não compartilhe com terceiros.
          </p>
        </div>
      </main>

      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl border-0 p-0 overflow-hidden bg-card">
          {selectedImage && (
            <div>
              <div className="bg-black/95 flex items-center justify-center min-h-[40vh]">
                {imageUrls[selectedImage.id] && (
                  <img
                    src={imageUrls[selectedImage.id]}
                    alt={selectedImage.caption || ''}
                    className="mx-auto max-h-[70vh] object-contain"
                  />
                )}
              </div>
              <div className="p-6">
                {selectedImage.caption && (
                  <p className="mb-3 text-lg font-medium">{selectedImage.caption}</p>
                )}
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(new Date(selectedImage.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                </div>
                {selectedImage.tags && selectedImage.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selectedImage.tags.map(tag => (
                      <Badge key={tag} variant="secondary" className="font-normal">{tag}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default EventPortal;
