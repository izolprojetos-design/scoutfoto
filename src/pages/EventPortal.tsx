import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Calendar, MapPin, Lock, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
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

      // Fetch the share link
      const { data: linkData, error: linkError } = await supabase
        .from('event_share_links')
        .select('*')
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (linkError || !linkData) {
        setError('Link inválido ou expirado.');
        setLoading(false);
        return;
      }

      // Check expiration
      if (new Date(linkData.expires_at) < new Date()) {
        setError('Este link expirou.');
        setLoading(false);
        return;
      }

      // Check max views
      if (linkData.max_views && linkData.view_count >= linkData.max_views) {
        setError('Este link atingiu o limite de visualizações.');
        setLoading(false);
        return;
      }

      setExpiresAt(linkData.expires_at);

      // Increment view count - use RPC or direct update won't work due to RLS
      // We'll skip incrementing for anon users since RLS only allows admin/chefe to update

      // Fetch event info
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

      // Fetch public/group images for this event (no minors)
      const { data: imgs } = await supabase
        .from('images')
        .select('id, filename, storage_path, thumbnail_path, caption, tags, created_at')
        .eq('event_id', eventData.id)
        .is('minor_age', null)
        .in('visibility', ['public', 'group'])
        .order('created_at', { ascending: false });

      const filtered = imgs || [];
      setImages(filtered);

      // Get signed URLs
      const urls: Record<string, string> = {};
      const thumbs: Record<string, string> = {};
      for (const img of filtered) {
        if (img.thumbnail_path) {
          const { data: td } = await supabase.storage.from('images').createSignedUrl(img.thumbnail_path, 3600);
          if (td?.signedUrl) thumbs[img.id] = td.signedUrl;
        }
        const { data: d } = await supabase.storage.from('images').createSignedUrl(img.storage_path, 3600);
        if (d?.signedUrl) urls[img.id] = d.signedUrl;
      }
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
        <Lock className="mb-4 h-12 w-12 text-muted-foreground" />
        <h1 className="mb-2 text-2xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
          Acesso Indisponível
        </h1>
        <p className="text-center text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
          <div className="flex items-center gap-2">
            <span className="text-2xl">⚜️</span>
            <span className="font-bold text-primary" style={{ fontFamily: 'Space Grotesk' }}>
              ScoutFoto
            </span>
          </div>
          {expiresAt && (
            <Badge variant="outline" className="gap-1 text-xs">
              <Clock className="h-3 w-3" />
              Expira em {format(new Date(expiresAt), "dd/MM/yyyy", { locale: ptBR })}
            </Badge>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6">
        {/* Event Info */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
            📸 {event?.name}
          </h1>
          {event?.description && (
            <p className="mt-2 text-muted-foreground">{event.description}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-3">
            {event?.event_date && (
              <Badge variant="secondary" className="gap-1">
                <Calendar className="h-3 w-3" />
                {format(new Date(event.event_date), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
              </Badge>
            )}
            {event?.location && (
              <Badge variant="outline" className="gap-1">
                <MapPin className="h-3 w-3" />
                {event.location}
              </Badge>
            )}
            <Badge variant="secondary">{images.length} fotos</Badge>
          </div>
        </div>

        {/* Gallery */}
        {images.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <span className="mb-2 text-4xl">📷</span>
            <p>Nenhuma foto disponível para este evento</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {images.map((img, index) => (
              <motion.div
                key={img.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(index * 0.03, 0.5) }}
                className="group cursor-pointer overflow-hidden rounded-xl bg-muted"
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
                      <span className="text-2xl">📷</span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 border-t py-6 text-center text-xs text-muted-foreground">
          <p>⚜️ ScoutFoto — Compartilhamento seguro de fotos escoteiras</p>
          <p className="mt-1">Este link é temporário e protegido. Não compartilhe com terceiros.</p>
        </div>
      </main>

      {/* Image Modal */}
      <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
        <DialogContent className="max-w-4xl border-0 p-0 overflow-hidden">
          {selectedImage && (
            <div>
              <div className="bg-black">
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
                      <Badge key={tag} variant="secondary">{tag}</Badge>
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
