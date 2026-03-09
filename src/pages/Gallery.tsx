import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Search, ArrowLeft, Calendar, Download, Eye, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { logAudit } from '@/lib/auditLog';

interface ImageData {
  id: string;
  filename: string;
  storage_path: string;
  thumbnail_path: string | null;
  caption: string | null;
  tags: string[] | null;
  minor_age: number | null;
  visibility: string;
  created_at: string;
  user_id: string;
  event_id: string | null;
  views: number;
  downloads: number;
}

interface Branch {
  id: string;
  key: string;
  display_name: string;
  icon: string;
}

interface Event {
  id: string;
  name: string;
}

const PAGE_SIZE = 24;

const Gallery = () => {
  const { branchKey } = useParams<{ branchKey: string }>();
  const { user, canViewMinors } = useAuth();
  const navigate = useNavigate();
  const [branch, setBranch] = useState<Branch | null>(null);
  const [images, setImages] = useState<ImageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState('all');
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const fetchImages = useCallback(async (pageNum: number, append = false) => {
    if (!branch) return;
    
    let query = supabase
      .from('images')
      .select('*')
      .eq('branch_id', branch.id)
      .order('created_at', { ascending: false })
      .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

    const { data } = await query;
    let filtered = data || [];

    // Filter minor images if user can't view them
    if (!canViewMinors) {
      filtered = filtered.filter(img => img.minor_age === null);
    }

    if (append) {
      setImages(prev => [...prev, ...filtered]);
    } else {
      setImages(filtered);
    }
    setHasMore(filtered.length === PAGE_SIZE);

    // Get signed URLs for thumbnails and full images
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
    setImageUrls(prev => ({ ...prev, ...urls }));
    setThumbUrls(prev => ({ ...prev, ...thumbs }));
    setLoading(false);
  }, [branch, canViewMinors]);

  useEffect(() => {
    const init = async () => {
      const { data: branchData } = await supabase
        .from('branches')
        .select('*')
        .eq('key', branchKey)
        .single();

      if (!branchData) { navigate('/dashboard'); return; }
      setBranch(branchData);

      const { data: evts } = await supabase.from('events').select('id, name').order('event_date', { ascending: false });
      setEvents(evts || []);
    };
    init();
  }, [branchKey]);

  useEffect(() => {
    if (branch) {
      setPage(0);
      setImages([]);
      fetchImages(0);
    }
  }, [branch, fetchImages]);

  // Infinite scroll
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMore && !loading) {
        const nextPage = page + 1;
        setPage(nextPage);
        fetchImages(nextPage, true);
      }
    });
    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);
    return () => observerRef.current?.disconnect();
  }, [hasMore, loading, page, fetchImages]);

  // Filtered images (client-side search + event filter)
  const filteredImages = images.filter(img => {
    const q = search.toLowerCase();
    const matchSearch = !q || img.caption?.toLowerCase().includes(q) ||
      img.tags?.some(t => t.toLowerCase().includes(q)) ||
      img.filename.toLowerCase().includes(q);
    const matchEvent = eventFilter === 'all' || img.event_id === eventFilter;
    return matchSearch && matchEvent;
  });

  const handleViewImage = async (img: ImageData) => {
    setSelectedImage(img);
    if (user) await logAudit(user.id, 'view', img.id);
  };

  const handleDownload = async (img: ImageData) => {
    const url = imageUrls[img.id];
    if (!url) return;
    window.open(url, '_blank');
    if (user) await logAudit(user.id, 'download', img.id);
  };

  const handleDeleteImage = async (img: ImageData) => {
    // Delete from storage
    await supabase.storage.from('images').remove([img.storage_path]);
    if (img.thumbnail_path) {
      await supabase.storage.from('images').remove([img.thumbnail_path]);
    }
    // Delete from DB
    const { error } = await supabase.from('images').delete().eq('id', img.id);
    if (error) {
      toast.error('Erro ao excluir: ' + error.message);
    } else {
      toast.success('Foto excluída com sucesso!');
      setImages(prev => prev.filter(i => i.id !== img.id));
      setSelectedImage(null);
      if (user) await logAudit(user.id, 'delete', img.id);
    }
  };

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
              {branch?.icon} {branch?.display_name}
            </h1>
            <p className="text-sm text-muted-foreground">{filteredImages.length} fotos</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Buscar por nome, tag, descrição..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="w-full sm:w-[200px]"><SelectValue placeholder="Filtrar por evento" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os eventos</SelectItem>
              {events.map(ev => (
                <SelectItem key={ev.id} value={ev.id}>{ev.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading && images.length === 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {[...Array(10)].map((_, i) => (
            <div key={i} className="aspect-square animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : filteredImages.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <span className="mb-2 text-4xl">📷</span>
          <p>Nenhuma foto encontrada</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {filteredImages.map((img, index) => (
              <motion.div
                key={img.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: Math.min(index * 0.02, 0.5) }}
                className="group cursor-pointer overflow-hidden rounded-xl bg-muted"
                onClick={() => handleViewImage(img)}
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
                    <div className="flex h-full items-center justify-center"><span className="text-2xl">📷</span></div>
                  )}
                </div>
                {img.minor_age && (
                  <div className="absolute right-2 top-2">
                    <Badge variant="destructive" className="text-xs">Menor</Badge>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
          <div ref={loadMoreRef} className="h-10" />
        </>
      )}

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
                <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    {format(new Date(selectedImage.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                  </div>
                  <div className="flex items-center gap-1">
                    <Eye className="h-3.5 w-3.5" />
                    {selectedImage.views} views
                  </div>
                </div>
                {selectedImage.tags && selectedImage.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {selectedImage.tags.map(tag => (
                      <Badge key={tag} variant="secondary">{tag}</Badge>
                    ))}
                  </div>
                )}
                <div className="mt-4 flex gap-2">
                  <Button variant="outline" size="sm" className="gap-2" onClick={() => handleDownload(selectedImage)}>
                    <Download className="h-4 w-4" />
                    Download
                  </Button>
                  {(selectedImage.user_id === user?.id) && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="destructive" size="sm" className="gap-2">
                          <Trash2 className="h-4 w-4" />
                          Excluir
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir foto?</AlertDialogTitle>
                          <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => handleDeleteImage(selectedImage)}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Gallery;
