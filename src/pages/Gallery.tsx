import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Search, ArrowLeft, Calendar, Download, Eye, Trash2, X, ImageIcon, Film } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { parseLocalDate } from '@/lib/scoutUtils';
import { ptBR } from 'date-fns/locale';
import { logAudit } from '@/lib/auditLog';
import { toast } from 'sonner';
import { usePermissions } from '@/hooks/usePermissions';

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
  branch_id: string;
  views: number;
  downloads: number;
  media_type: string;
}

interface Branch {
  id: string;
  key: string;
  display_name: string;
  icon: string;
}

interface EventData {
  id: string;
  name: string;
  event_date: string | null;
  branch_id: string | null;
  scout_group: string | null;
}

const PAGE_SIZE = 24;

const Gallery = () => {
  const { branchKey } = useParams<{ branchKey: string }>();
  const { user, canViewMinors } = useAuth();
  const navigate = useNavigate();
  const { canDownloadPhotos, canDeletePhotos } = usePermissions();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [images, setImages] = useState<ImageData[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Filters
  const [eventFilter, setEventFilter] = useState('all');
  const [yearFilter, setYearFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [groupFilter, setGroupFilter] = useState('all');
  const [events, setEvents] = useState<EventData[]>([]);

  const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);
  const [imageUrls, setImageUrls] = useState<Record<string, string>>({});
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  // Derive available years from events
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    events.forEach(ev => {
      if (ev.event_date) {
        years.add(parseLocalDate(ev.event_date).getFullYear().toString());
      }
    });
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [events]);

  // Derive available groups from events
  const availableGroups = useMemo(() => {
    const groups = new Set<string>();
    events.forEach(ev => {
      if (ev.scout_group) groups.add(ev.scout_group);
    });
    return Array.from(groups).sort();
  }, [events]);

  // Filter events shown in combobox based on year and branch filters
  const filteredEvents = useMemo(() => {
    return events.filter(ev => {
      const matchYear = yearFilter === 'all' || (ev.event_date && parseLocalDate(ev.event_date).getFullYear().toString() === yearFilter);
      const matchBranch = branchFilter === 'all' || ev.branch_id === branchFilter;
      const matchGroup = groupFilter === 'all' || ev.scout_group === groupFilter;
      return matchYear && matchBranch && matchGroup;
    });
  }, [events, yearFilter, branchFilter, groupFilter]);

  const hasActiveFilters = eventFilter !== 'all' || yearFilter !== 'all' || branchFilter !== 'all' || groupFilter !== 'all' || search !== '';

  const clearFilters = () => {
    setEventFilter('all');
    setYearFilter('all');
    setBranchFilter('all');
    setGroupFilter('all');
    setSearch('');
  };

  const fetchImages = useCallback(async (pageNum: number, append = false) => {
    try {
      let query = supabase
        .from('images')
        .select('*')
        .is('event_id', null)
        .order('created_at', { ascending: false })
        .range(pageNum * PAGE_SIZE, (pageNum + 1) * PAGE_SIZE - 1);

      // If branchKey is set from URL, scope to that branch
      if (selectedBranch) {
        query = query.eq('branch_id', selectedBranch.id);
      }

      const { data } = await query;
      let filtered = data || [];

      if (!canViewMinors) {
        filtered = filtered.filter(img => img.minor_age === null);
      }

      if (append) {
        setImages(prev => [...prev, ...filtered]);
      } else {
        setImages(filtered);
      }
      setHasMore(filtered.length === PAGE_SIZE);

      // Get signed URLs in a single batched call (much faster on mobile)
      const { getSignedUrlsBatch } = await import('@/lib/storageUtils');
      const thumbPaths: string[] = [];
      const fullPaths: string[] = [];
      const thumbIdByPath = new Map<string, string>();
      const fullIdByPath = new Map<string, string>();
      const urls: Record<string, string> = {};
      const thumbs: Record<string, string> = {};

      for (const img of filtered) {
        if (img.thumbnail_path) {
          if (!img.thumbnail_path.startsWith('http')) {
            thumbPaths.push(img.thumbnail_path);
            thumbIdByPath.set(img.thumbnail_path, img.id);
          } else {
            thumbs[img.id] = img.thumbnail_path;
          }
        }
        if (img.storage_path) {
          fullPaths.push(img.storage_path);
          fullIdByPath.set(img.storage_path, img.id);
        }
      }

      const [thumbMap, fullMap] = await Promise.all([
        getSignedUrlsBatch('images', thumbPaths, 3600),
        getSignedUrlsBatch('images', fullPaths, 3600),
      ]);

      for (const [path, url] of Object.entries(thumbMap)) {
        const id = thumbIdByPath.get(path);
        if (id) thumbs[id] = url;
      }
      for (const [path, url] of Object.entries(fullMap)) {
        const id = fullIdByPath.get(path);
        if (id) urls[id] = url;
      }

      setImageUrls(prev => ({ ...prev, ...urls }));
      setThumbUrls(prev => ({ ...prev, ...thumbs }));
    } catch (err) {
      console.error('Error fetching gallery images:', err);
      toast.error('Erro ao carregar galeria.');
    } finally {
      setLoading(false);
    }
  }, [selectedBranch, canViewMinors]);

  useEffect(() => {
    const init = async () => {
      const [{ data: branchesData }, { data: evts }] = await Promise.all([
        supabase.from('branches').select('*').order('sort_order'),
        supabase.from('events').select('id, name, event_date, branch_id, scout_group').order('event_date', { ascending: false }),
      ]);

      setBranches(branchesData || []);
      setEvents(evts || []);

      if (branchKey && branchesData) {
        const found = branchesData.find(b => b.key === branchKey);
        if (found) {
          setSelectedBranch(found);
          setBranchFilter(found.id);
        } else {
          navigate('/dashboard');
        }
      }
    };
    init();
  }, [branchKey]);

  useEffect(() => {
    setPage(0);
    setImages([]);
    setImageUrls({});
    setThumbUrls({});
    fetchImages(0);
  }, [fetchImages]);

  // Infinite scroll — refs avoid re-creating the observer on every state change
  const hasMoreRef = useRef(hasMore);
  const loadingRef = useRef(loading);
  const pageRef = useRef(page);
  const fetchImagesRef = useRef(fetchImages);
  useEffect(() => { hasMoreRef.current = hasMore; }, [hasMore]);
  useEffect(() => { loadingRef.current = loading; }, [loading]);
  useEffect(() => { pageRef.current = page; }, [page]);
  useEffect(() => { fetchImagesRef.current = fetchImages; }, [fetchImages]);

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    observerRef.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasMoreRef.current && !loadingRef.current) {
        const nextPage = pageRef.current + 1;
        setPage(nextPage);
        fetchImagesRef.current(nextPage, true);
      }
    });
    if (loadMoreRef.current) observerRef.current.observe(loadMoreRef.current);
    return () => observerRef.current?.disconnect();
  }, []);

  // O(1) lookup for filter — avoids events.find() inside the images loop
  const eventsById = useMemo(() => {
    const m = new Map<string, EventData>();
    for (const e of events) m.set(e.id, e);
    return m;
  }, [events]);

  // Client-side filtering
  const filteredImages = useMemo(() => {
    return images.filter(img => {
      const q = search.toLowerCase();
      const matchSearch = !q || img.caption?.toLowerCase().includes(q) ||
        img.tags?.some(t => t.toLowerCase().includes(q)) ||
        img.filename.toLowerCase().includes(q);

      const matchEvent = eventFilter === 'all' || img.event_id === eventFilter;

      const matchBranch = branchFilter === 'all' || img.branch_id === branchFilter;

      // Year filter: match images whose event has the selected year
      let matchYear = true;
      if (yearFilter !== 'all') {
        if (img.event_id) {
          const ev = eventsById.get(img.event_id);
          matchYear = !!ev?.event_date && parseLocalDate(ev.event_date).getFullYear().toString() === yearFilter;
        } else {
          matchYear = new Date(img.created_at).getFullYear().toString() === yearFilter;
        }
      }

      // Group filter
      let matchGroup = true;
      if (groupFilter !== 'all' && img.event_id) {
        const ev = eventsById.get(img.event_id);
        matchGroup = ev?.scout_group === groupFilter;
      } else if (groupFilter !== 'all' && !img.event_id) {
        matchGroup = false;
      }

      return matchSearch && matchEvent && matchBranch && matchYear && matchGroup;
    });
  }, [images, search, eventFilter, branchFilter, yearFilter, groupFilter, eventsById]);


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
    await supabase.storage.from('images').remove([img.storage_path]);
    if (img.thumbnail_path) {
      await supabase.storage.from('images').remove([img.thumbnail_path]);
    }
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

  const pageTitle = selectedBranch
    ? `${selectedBranch.icon} ${selectedBranch.display_name}`
    : '📷 Galeria de Fotos';

  return (
    <>
      <div className="mb-6 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
              {pageTitle}
            </h1>
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              {(() => {
                const photoCount = filteredImages.filter(i => i.media_type !== 'video').length;
                const videoCount = filteredImages.filter(i => i.media_type === 'video').length;
                return (
                  <>
                    {photoCount > 0 && (
                      <span className="flex items-center gap-1">
                        <ImageIcon className="h-3.5 w-3.5" />
                        {photoCount} foto{photoCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {photoCount > 0 && videoCount > 0 && <span>•</span>}
                    {videoCount > 0 && (
                      <span className="flex items-center gap-1">
                        <Film className="h-3.5 w-3.5" />
                        {videoCount} vídeo{videoCount !== 1 ? 's' : ''}
                      </span>
                    )}
                    {photoCount === 0 && videoCount === 0 && (
                      <span className="flex items-center gap-1">
                        <ImageIcon className="h-3.5 w-3.5" />
                        0 fotos
                      </span>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome, tag, descrição..." value={search} onChange={e => setSearch(e.target.value)} className="h-9 pl-10 text-sm" />
        </div>

        {/* Filter bar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {/* Event filter */}
          <Select value={eventFilter} onValueChange={setEventFilter}>
            <SelectTrigger className="w-full sm:w-[220px]">
              <SelectValue placeholder="Evento" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os eventos</SelectItem>
              {filteredEvents.map(ev => (
                <SelectItem key={ev.id} value={ev.id}>
                  {ev.name}
                  {ev.event_date && ` — ${format(parseLocalDate(ev.event_date), 'dd/MM/yyyy')}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Year filter */}
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="w-full sm:w-[150px]">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os anos</SelectItem>
              {availableYears.map(y => (
                <SelectItem key={y} value={y}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Branch/Ramo filter (only show if not already scoped by URL) */}
          {!branchKey && (
            <Select value={branchFilter} onValueChange={setBranchFilter}>
              <SelectTrigger className="w-full sm:w-[180px]">
                <SelectValue placeholder="Ramo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os ramos</SelectItem>
                {branches.map(b => (
                  <SelectItem key={b.id} value={b.id}>{b.icon} {b.display_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Group filter */}
          {availableGroups.length > 0 && (
            <Select value={groupFilter} onValueChange={setGroupFilter}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Grupo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os grupos</SelectItem>
                {availableGroups.map(g => (
                  <SelectItem key={g} value={g}>{g}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Clear filters */}
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground" onClick={clearFilters}>
              <X className="h-4 w-4" />
              Limpar filtros
            </Button>
          )}
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
          {hasActiveFilters && (
            <Button variant="link" className="mt-2" onClick={clearFilters}>
              Limpar filtros
            </Button>
          )}
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
                {imageUrls[selectedImage.id] ? (
                  <img
                    src={imageUrls[selectedImage.id]}
                    alt={selectedImage.caption || ''}
                    className="mx-auto max-h-[70vh] object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-12 text-center text-white min-h-[40vh]">
                    <div className="mb-4 rounded-full bg-white/10 p-6">
                      <ImageIcon className="h-12 w-12 text-white/40" />
                    </div>
                    <p className="text-white/60">Não foi possível carregar esta imagem.</p>
                  </div>
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
                  {canDownloadPhotos && (
                    <Button variant="outline" size="sm" className="gap-2" onClick={() => handleDownload(selectedImage)}>
                      <Download className="h-4 w-4" />
                      Download
                    </Button>
                  )}
                  {(canDeletePhotos || selectedImage.user_id === user?.id) && (
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
    </>
  );
};

export default Gallery;
