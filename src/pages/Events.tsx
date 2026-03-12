import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
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
import { Plus, Calendar, MapPin, Share2, Trash2, Pencil, Upload, Camera, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ShareLinkDialog from '@/components/ShareLinkDialog';
import EventPermissionsDialog from '@/components/EventPermissionsDialog';

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

const Events = () => {
  const { user, isAdmin, isChefe, isDirigente, canUpload } = useAuth();
  const navigate = useNavigate();
  const [events, setEvents] = useState<Event[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
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
  const [shareEvent, setShareEvent] = useState<{ id: string; name: string } | null>(null);
  const [permEvent, setPermEvent] = useState<{ id: string; name: string } | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());

  const toggleSelectEvent = (eventId: string) => {
    setSelectedEvents(prev => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  const fetchEvents = async () => {
    const [{ data }, { data: permsData }] = await Promise.all([
      supabase.from('events').select('*').order('event_date', { ascending: false }),
      supabase.from('event_permissions').select('event_id'),
    ]);
    setEvents(data || []);
    setEventsWithPerms(new Set((permsData || []).map(p => p.event_id)));
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
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const { error } = await supabase.from('events').insert({
      name,
      description,
      event_date: eventDate || null,
      location,
      branch_id: branchId || null,
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
        branch_id: branchId || null,
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
    const { error } = await supabase.from('events').delete().eq('id', eventId);
    if (error) {
      toast.error('Erro ao excluir: ' + error.message);
    } else {
      toast.success('Evento excluído!');
      fetchEvents();
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
          <Label>Data</Label>
          <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} className="h-11" />
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
      <Button type="submit" className="w-full h-11 font-semibold">{submitLabel}</Button>
    </form>
  );

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Eventos</h1>
          <p className="mt-1 text-muted-foreground">Atividades e acampamentos escoteiros</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {canUpload && (
            <>
              <Button variant="outline" className="gap-2 shadow-sm" onClick={() => navigate('/upload')}>
                <Upload className="h-4 w-4" />
                Upload
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2 shadow-sm">
                    <Camera className="h-4 w-4" />
                    Tirar Foto
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="max-h-64 overflow-y-auto">
                  <DropdownMenuItem onClick={() => navigate('/upload?camera=true')}>
                    📷 Sem evento específico
                  </DropdownMenuItem>
                  {events.length > 0 && <DropdownMenuSeparator />}
                  {events.map(ev => (
                    <DropdownMenuItem key={ev.id} onClick={() => navigate(`/upload?camera=true&eventId=${ev.id}`)}>
                      📅 {ev.name}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          {(isAdmin || isChefe || isDirigente) && (
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-44 animate-pulse rounded-xl bg-muted" />
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
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event, index) => {
            const branchInfo = getBranchInfo(event.branch_id);
            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <Card className={`group border bg-card shadow-sm transition-all hover:shadow-md ${selectedEvents.has(event.id) ? 'ring-2 ring-primary' : ''}`}>
                  <CardContent className="p-5">
                    <div className="mb-3 flex items-start gap-3">
                      <Checkbox
                        checked={selectedEvents.has(event.id)}
                        onCheckedChange={() => toggleSelectEvent(event.id)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold tracking-tight group-hover:text-primary transition-colors">
                          {event.name}
                        </h3>
                        {event.description && (
                          <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{event.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {event.event_date && (
                        <Badge variant="secondary" className="gap-1 font-normal">
                          <Calendar className="h-3 w-3" />
                          {format(new Date(event.event_date), "dd/MM/yyyy", { locale: ptBR })}
                        </Badge>
                      )}
                      {event.location && (
                        <Badge variant="outline" className="gap-1 font-normal">
                          <MapPin className="h-3 w-3" />
                          {event.location}
                        </Badge>
                      )}
                      {branchInfo && (
                        <Badge variant="secondary" className="font-normal">
                          {branchInfo.icon} {branchInfo.display_name}
                        </Badge>
                      )}
                    </div>
                    {(isAdmin || isChefe || isDirigente) && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 gap-2"
                          onClick={(e) => { e.stopPropagation(); setShareEvent({ id: event.id, name: event.name }); }}
                        >
                          <Share2 className="h-3.5 w-3.5" />
                          Compartilhar
                        </Button>
                        <Button
                          variant="default"
                          size="sm"
                          className="relative bg-amber-600 hover:bg-amber-700 text-white shadow-sm px-2.5"
                          onClick={(e) => { e.stopPropagation(); setPermEvent({ id: event.id, name: event.name }); }}
                          title="Permissões do Evento"
                        >
                          <Shield className="h-4 w-4" />
                          {eventsWithPerms.has(event.id) && (
                            <span className="absolute -top-1 -right-1 flex h-3 w-3">
                              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                              <span className="relative inline-flex h-3 w-3 rounded-full bg-primary" />
                            </span>
                          )}
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={(e) => { e.stopPropagation(); openEditDialog(event); }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm" className="gap-2" onClick={e => e.stopPropagation()}>
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir evento "{event.name}"?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDeleteEvent(event.id)}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={(open) => { setEditDialogOpen(open); if (!open) { setEditingEvent(null); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Evento</DialogTitle>
          </DialogHeader>
          {renderForm(handleEdit, "Salvar Alterações")}
        </DialogContent>
      </Dialog>

      {shareEvent && (
        <ShareLinkDialog
          open={!!shareEvent}
          onOpenChange={(open) => !open && setShareEvent(null)}
          eventId={shareEvent.id}
          eventName={shareEvent.name}
        />
      )}

      {permEvent && (
        <EventPermissionsDialog
          open={!!permEvent}
          onOpenChange={(open) => !open && setPermEvent(null)}
          eventId={permEvent.id}
          eventName={permEvent.name}
        />
      )}
    </AppLayout>
  );
};

export default Events;
