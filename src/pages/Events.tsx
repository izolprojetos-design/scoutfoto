import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

import { toast } from 'sonner';
import { Plus, Calendar, MapPin, Trash2, Pencil, Upload, Camera, Shield, MoreVertical, ImageIcon, Film, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { motion } from 'framer-motion';
import { format, startOfDay } from 'date-fns';
import { parseLocalDate } from '@/lib/scoutUtils';
import { ptBR } from 'date-fns/locale';
import EventPermissionsDialog from '@/components/EventPermissionsDialog';
import { usePermissions } from '@/hooks/usePermissions';
import { getEventCoverImage } from '@/lib/eventImages';
import { useRenderDiagnostics } from '@/lib/useRenderDiagnostics';
import { useNoEffects } from '@/components/RenderDiagnosticsToolbar';

interface Branch {
  id: string;
  key: string;
  display_name: string;
  icon: string;
}

interface Event {
  id: string;
  name: string;
  description: string;
  event_date: string | null;
  location: string;
  branch_id: string | null;
  created_at: string;
}

interface EventMediaCount {
  photos: number;
  videos: number;
}

const Events = () => {
  const { user, isAdmin, isVoluntario } = useAuth();
  const navigate = useNavigate();
  const { canEditEvents, canManageEvents } = usePermissions();
  const [events, setEvents] = useState<Event[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [mediaCounts, setMediaCounts] = useState<Record<string, EventMediaCount>>({});
  const [eventsWithPerms, setEventsWithPerms] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Event | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [branchId, setBranchId] = useState('');
  const [scoutGroup, setScoutGroup] = useState('');
  const [permEvent, setPermEvent] = useState<{ id: string; name: string } | null>(null);
  const [deleteEvent, setDeleteEvent] = useState<{ id: string; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'oldest' | 'alpha'>('recent');
  const [filterBranch, setFilterBranch] = useState<string>('all');
  const [filterYear, setFilterYear] = useState<string>('all');

  const noEffects = useNoEffects();

  useRenderDiagnostics('Events', {
    user, events, branches, mediaCounts, eventsWithPerms, loading,
    dialogOpen, editDialogOpen, editingEvent, searchQuery, sortBy,
    filterBranch, filterYear,
  });


  const fetchEvents = async () => {
    const [{ data }, { data: permsData }] = await Promise.all([
      supabase.from('events').select('*').order('event_date', { ascending: false }),
      supabase.from('event_permissions').select('event_id'),
    ]);
    
    const fetchedEvents = data || [];
    setEvents(fetchedEvents);
    setEventsWithPerms(new Set((permsData || []).map(p => p.event_id)));
    
    // Otimização: Buscar imagens apenas para os eventos encontrados, divididos em lotes (segurança de URL)
    const eventIds = fetchedEvents.map(e => e.id);
    const BATCH_SIZE = 100;
    const imgPromises = [];
    
    for (let i = 0; i < eventIds.length; i += BATCH_SIZE) {
      const batch = eventIds.slice(i, i + BATCH_SIZE);
      imgPromises.push(supabase.from('images').select('event_id, media_type').in('event_id', batch));
    }
    
    const imgResults = await Promise.all(imgPromises);
    const imgData = imgResults.flatMap(r => r.data || []);

    // Count media by type per event
    const counts: Record<string, EventMediaCount> = {};
    imgData.forEach(img => {
      if (!img.event_id) return;

      if (!counts[img.event_id]) {
        counts[img.event_id] = { photos: 0, videos: 0 };
      }

      if (img.media_type === 'video') {
        counts[img.event_id].videos += 1;
      } else {
        counts[img.event_id].photos += 1;
      }
    });
    setMediaCounts(counts);
    
    setLoading(false);
  };

  useEffect(() => {
    supabase.from('branches').select('*').order('sort_order').then(({ data }) => {
      if (data) setBranches(data);
    });
    fetchEvents();
  }, []);

  const resetForm = () => {
    setName('');
    setDescription('');
    setEventDate('');
    setLocation('');
    setBranchId('');
    setScoutGroup('');
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const { error } = await supabase.from('events').insert({
      name,
      description,
      event_date: eventDate || null,
      location,
      branch_id: branchId && branchId !== 'all' ? branchId : null,
      scout_group: scoutGroup || '',
      created_by: user.id,
    });

    if (error) {
      toast.error('Erro ao criar evento: ' + error.message);
    } else {
      toast.success('Evento criado com sucesso!');
      setDialogOpen(false);
      resetForm();
      fetchEvents();
    }
  };

  const openEditDialog = (event: Event) => {
    setEditingEvent(event);
    setName(event.name);
    setDescription(event.description || '');
    setEventDate(event.event_date || '');
    setLocation(event.location || '');
    setBranchId(event.branch_id || '');
    setScoutGroup((event as any).scout_group || '');
    setEditDialogOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;

    const { error } = await supabase
      .from('events')
      .update({
        name,
        description,
        event_date: eventDate || null,
        location,
        branch_id: branchId && branchId !== 'all' ? branchId : null,
        scout_group: scoutGroup || '',
      })
      .eq('id', editingEvent.id);

    if (error) {
      toast.error('Erro ao editar evento: ' + error.message);
    } else {
      toast.success('Evento atualizado com sucesso!');
      setEditDialogOpen(false);
      setEditingEvent(null);
      resetForm();
      fetchEvents();
    }
  };

  const handleDeleteEvent = async (eventId: string) => {
    try {
      // Remove related records first to avoid FK constraint errors
      await Promise.all([
        supabase.from('images').delete().eq('event_id', eventId),
        supabase.from('event_permissions').delete().eq('event_id', eventId),
        supabase.from('event_share_links').delete().eq('event_id', eventId),
      ]);

      const { error } = await supabase.from('events').delete().eq('id', eventId);
      if (error) {
        toast.error('Erro ao excluir: ' + error.message);
      } else {
        toast.success('Evento excluído!');
        fetchEvents();
      }
    } catch (err: any) {
      toast.error('Erro ao excluir evento: ' + (err?.message || 'Erro desconhecido'));
    }
  };

  const getBranchInfo = (bId: string | null) => {
    if (!bId) return null;
    return branches.find(br => br.id === bId);
  };

  const renderForm = (onSubmit: (e: React.FormEvent) => Promise<void>, submitLabel: string) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>Nome do evento</Label>
        <Input value={name} onChange={e => setName(e.target.value)} required placeholder="Ex: Acampamento no Água Boa" className="h-11" />
      </div>
      <div className="space-y-2">
        <Label>Descrição</Label>
        <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalhes da atividade..." />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="eventDate">Data</Label>
          <div className="relative">
            <Input 
              id="eventDate"
              type="date" 
              value={eventDate} 
              onChange={e => setEventDate(e.target.value)} 
              className="h-11 pr-10 appearance-none" 
            />
            <Calendar 
              className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" 
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Local</Label>
          <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Ex: Serra Grande" className="h-11" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Ramo (opcional)</Label>
        <Select value={branchId} onValueChange={setBranchId}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Todos os ramos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os ramos</SelectItem>
            {branches.map(b => (
              <SelectItem key={b.id} value={b.id}>{b.icon} {b.display_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Grupo Escoteiro (opcional)</Label>
        <Input value={scoutGroup} onChange={e => setScoutGroup(e.target.value)} placeholder="Ex: GE 015" className="h-11" />
      </div>
      <Button type="submit" className="w-full h-11 font-semibold">{submitLabel}</Button>
    </form>
  );

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Eventos</h1>
          <p className="mt-1 text-muted-foreground">Gerencie atividades, acampamentos e encontros do seu grupo</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Buscar eventos..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 pl-9 pr-9"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-sm p-1 text-muted-foreground hover:text-foreground"
                aria-label="Limpar busca"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as 'recent' | 'oldest' | 'alpha')}>
            <SelectTrigger className="h-10 w-full sm:w-48">
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="recent">Mais recentes</SelectItem>
              <SelectItem value="oldest">Mais antigos</SelectItem>
              <SelectItem value="alpha">Alfabético (A–Z)</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterBranch} onValueChange={setFilterBranch}>
            <SelectTrigger className="h-10 w-full sm:w-44">
              <SelectValue placeholder="Ramo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os ramos</SelectItem>
              {branches.map(b => (
                <SelectItem key={b.id} value={b.id}>{b.icon} {b.display_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterYear} onValueChange={setFilterYear}>
            <SelectTrigger className="h-10 w-full sm:w-32">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os anos</SelectItem>
              {Array.from(new Set(events.map(e => e.event_date ? new Date(e.event_date).getUTCFullYear() : null).filter((y): y is number => y !== null)))
                .sort((a, b) => b - a)
                .map(year => (
                  <SelectItem key={year} value={String(year)}>{year}</SelectItem>
                ))}
            </SelectContent>
          </Select>
          {(canManageEvents || canEditEvents) && (
            <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
              <DialogTrigger asChild>
                <Button className="gap-2 shadow-sm">
                  <Plus className="h-4 w-4" />
                  Novo Evento
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Evento</DialogTitle>
                </DialogHeader>
                {renderForm(handleCreate, "Criar Evento")}
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col divide-y rounded-xl border bg-card shadow-sm overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3">
              <div className="h-16 w-24 sm:h-20 sm:w-32 flex-shrink-0 rounded-md bg-muted" />
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-4 w-2/3 rounded bg-muted" />
                <div className="h-3 w-1/3 rounded bg-muted" />
                <div className="flex gap-2 pt-1">
                  <div className="h-5 w-20 rounded bg-muted" />
                  <div className="h-5 w-24 rounded bg-muted" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
            <Calendar className="h-8 w-8" />
          </div>
          <p className="text-lg font-medium text-foreground">Nenhum evento cadastrado</p>
          <p className="mt-1 text-sm">Crie seu primeiro evento para começar</p>
        </div>
      ) : (() => {
        const q = searchQuery.trim().toLowerCase();
        const filteredEvents = events.filter(e => {
          if (q) {
            const matches =
              e.name.toLowerCase().includes(q) ||
              (e.location || '').toLowerCase().includes(q) ||
              (e.description || '').toLowerCase().includes(q);
            if (!matches) return false;
          }
          if (filterBranch !== 'all' && e.branch_id !== filterBranch) return false;
          if (filterYear !== 'all') {
            if (!e.event_date) return false;
            if (String(new Date(e.event_date).getUTCFullYear()) !== filterYear) return false;
          }
          return true;
        });

        const sortedEvents = [...filteredEvents].sort((a, b) => {
          if (sortBy === 'alpha') {
            return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' });
          }
          // Use event_date when available, fallback to created_at
          const aTime = new Date(a.event_date || a.created_at).getTime();
          const bTime = new Date(b.event_date || b.created_at).getTime();
          return sortBy === 'recent' ? bTime - aTime : aTime - bTime;
        });

        if (filteredEvents.length === 0) {
          return (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
                <Search className="h-8 w-8" />
              </div>
              <p className="text-lg font-medium text-foreground">Nenhum evento encontrado</p>
              <p className="mt-1 text-sm">Tente buscar por outro termo</p>
            </div>
          );
        }

        // Disable per-item animations when in "no effects" mode or when the
        // list is large enough that staggered animations cause flicker.
        const disableMotion = noEffects || sortedEvents.length > 20;

        return (
        <div className="flex flex-col divide-y rounded-xl border bg-card shadow-sm overflow-hidden">
          {sortedEvents.map((event, index) => {
            const branchInfo = getBranchInfo(event.branch_id);
            const isUpcoming = event.event_date && parseLocalDate(event.event_date) > startOfDay(new Date());
            const mediaCount = mediaCounts[event.id] || { photos: 0, videos: 0 };
            const hasPhotos = mediaCount.photos > 0;
            const hasVideos = mediaCount.videos > 0;

            const rowClass = `group flex items-center gap-4 px-4 py-3 cursor-pointer hover:bg-muted/40 ${disableMotion ? '' : 'transition-colors'}`;
            const Row: any = disableMotion ? 'div' : motion.div;
            const motionProps = disableMotion
              ? {}
              : {
                  initial: { opacity: 0, y: 4 },
                  animate: { opacity: 1, y: 0 },
                  transition: { delay: Math.min(index * 0.015, 0.15), duration: 0.2 },
                };

            return (
              <Row
                key={event.id}
                {...motionProps}
                className={rowClass}
                onClick={() => navigate(`/events/${event.id}`)}
              >
                <div className="relative h-16 w-24 sm:h-20 sm:w-32 flex-shrink-0 overflow-hidden rounded-md bg-muted">
                  <img
                    src={getEventCoverImage(event.name, event.id)}
                    alt={event.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {/* Debug indication of selected image */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 py-0.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                    <p className="text-[8px] text-white truncate text-center font-mono">
                      {event.name.toLowerCase().includes('acampamento') || 
                       event.name.toLowerCase().includes('trilha') ||
                       event.name.toLowerCase().includes('celebração') ||
                       event.name.toLowerCase().includes('reunião') ||
                       event.name.toLowerCase().includes('atividade') 
                       ? 'Keyword' : 'Random'}: {getEventCoverImage(event.name, event.id).split('/').pop()?.split('.')[0] || 'img'}
                    </p>
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="text-sm sm:text-base font-semibold text-foreground break-words">
                    {event.name}
                  </h3>
                  {event.description && (
                    <p className="mt-0.5 text-xs sm:text-sm text-muted-foreground line-clamp-1">
                      {event.description}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {event.event_date && (
                      <Badge
                        variant={isUpcoming ? 'default' : 'outline'}
                        className={`gap-1 font-normal text-xs ${isUpcoming ? 'bg-amber-500 hover:bg-amber-600 text-white border-amber-500' : 'text-muted-foreground'}`}
                      >
                        <Calendar className="h-3 w-3" />
                        {format(parseLocalDate(event.event_date), 'dd/MM/yyyy', { locale: ptBR })}
                      </Badge>
                    )}
                    {event.location && (
                      <Badge variant="outline" className="gap-1 font-normal text-xs">
                        <MapPin className="h-3 w-3" />
                        {event.location}
                      </Badge>
                    )}
                    {branchInfo && (
                      <Badge variant="secondary" className="font-normal text-xs">
                        {branchInfo.icon} {branchInfo.display_name}
                      </Badge>
                    )}
                    {hasPhotos && (
                      <Badge variant="outline" className="gap-1 font-normal text-xs">
                        <ImageIcon className="h-3 w-3" />
                        {mediaCount.photos}
                      </Badge>
                    )}
                    {hasVideos && (
                      <Badge variant="outline" className="gap-1 font-normal text-xs">
                        <Film className="h-3 w-3" />
                        {mediaCount.videos}
                      </Badge>
                    )}
                  </div>
                </div>

                {(canManageEvents || canEditEvents) && (
                  <div className="flex-shrink-0 flex items-center gap-1">
                    <div className="hidden sm:flex items-center gap-1">
                      {(canManageEvents || canEditEvents) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0"
                          title="Editar"
                          onClick={(e) => { e.stopPropagation(); openEditDialog(event); }}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canManageEvents && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          title="Excluir"
                          onClick={(e) => { e.stopPropagation(); setDeleteEvent({ id: event.id, name: event.name }); }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={e => e.stopPropagation()}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {canManageEvents && (
                          <>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setPermEvent({ id: event.id, name: event.name }); }}>
                              <Shield className="h-4 w-4 mr-2" />
                              Permissões
                              {eventsWithPerms.has(event.id) && (
                                <span className="ml-auto h-2 w-2 rounded-full bg-primary" />
                              )}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                          </>
                        )}
                        {(canManageEvents || canEditEvents) && (
                          <DropdownMenuItem onClick={(e) => { e.stopPropagation(); openEditDialog(event); }}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Editar
                          </DropdownMenuItem>
                        )}
                        {canManageEvents && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={(e) => { e.stopPropagation(); setDeleteEvent({ id: event.id, name: event.name }); }}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Excluir
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </Row>
            );
          })}
        </div>
        );
      })()}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) { setEditingEvent(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Evento</DialogTitle>
          </DialogHeader>
          {renderForm(handleEdit, "Salvar Alterações")}
        </DialogContent>
      </Dialog>

      {permEvent && (
        <EventPermissionsDialog
          open={!!permEvent}
          onOpenChange={(open) => !open && setPermEvent(null)}
          eventId={permEvent.id}
          eventName={permEvent.name}
        />
      )}

      <AlertDialog open={!!deleteEvent} onOpenChange={(open) => !open && setDeleteEvent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir evento "{deleteEvent?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if (deleteEvent) handleDeleteEvent(deleteEvent.id); setDeleteEvent(null); }}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Events;
