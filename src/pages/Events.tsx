import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Calendar, MapPin, Share2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import ShareLinkDialog from '@/components/ShareLinkDialog';

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
  const { user, isAdmin, isChefe } = useAuth();
  const [events, setEvents] = useState<Event[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [location, setLocation] = useState('');
  const [branchId, setBranchId] = useState('');
  const [shareEvent, setShareEvent] = useState<{ id: string; name: string } | null>(null);

  const fetchEvents = async () => {
    const { data } = await supabase
      .from('events')
      .select('*')
      .order('event_date', { ascending: false });
    setEvents(data || []);
    setLoading(false);
  };

  useEffect(() => {
    supabase.from('branches').select('*').order('sort_order').then(({ data }) => {
      if (data) setBranches(data);
    });
    fetchEvents();
  }, []);

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
      toast.success('Evento criado!');
      setDialogOpen(false);
      setName('');
      setDescription('');
      setEventDate('');
      setLocation('');
      setBranchId('');
      fetchEvents();
    }
  };

  const getBranchName = (bId: string | null) => {
    if (!bId) return null;
    const b = branches.find(br => br.id === bId);
    return b ? `${b.icon} ${b.display_name}` : null;
  };

  return (
    <AppLayout>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold" style={{ fontFamily: 'Space Grotesk' }}>
            <Calendar className="mr-2 inline h-7 w-7" />
            Eventos
          </h1>
          <p className="mt-1 text-muted-foreground">Gerencie atividades escoteiras</p>
        </div>

        {(isAdmin || isChefe) && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Novo Evento
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Criar Evento</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome do evento</Label>
                  <Input value={name} onChange={e => setName(e.target.value)} required placeholder="Ex: Acampamento de Inverno" />
                </div>
                <div className="space-y-2">
                  <Label>Descrição</Label>
                  <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Detalhes da atividade..." />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label>Local</Label>
                    <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="Ex: Serra da Mantiqueira" />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Ramo (opcional)</Label>
                  <Select value={branchId} onValueChange={setBranchId}>
                    <SelectTrigger>
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
                <Button type="submit" className="w-full">Criar Evento</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
          <Calendar className="mb-2 h-10 w-10" />
          <p>Nenhum evento cadastrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {events.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="border-0 shadow-md transition-shadow hover:shadow-lg">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{event.name}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {event.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">{event.description}</p>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {event.event_date && (
                      <Badge variant="secondary" className="gap-1">
                        <Calendar className="h-3 w-3" />
                        {format(new Date(event.event_date), "dd/MM/yyyy", { locale: ptBR })}
                      </Badge>
                    )}
                    {event.location && (
                      <Badge variant="outline" className="gap-1">
                        <MapPin className="h-3 w-3" />
                        {event.location}
                      </Badge>
                    )}
                    {getBranchName(event.branch_id) && (
                      <Badge variant="secondary">{getBranchName(event.branch_id)}</Badge>
                    )}
                  </div>
                  {(isAdmin || isChefe) && (
                    <div className="mt-3 pt-3 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2 w-full"
                        onClick={(e) => { e.stopPropagation(); setShareEvent({ id: event.id, name: event.name }); }}
                      >
                        <Share2 className="h-3.5 w-3.5" />
                        Compartilhar com pais
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {shareEvent && (
        <ShareLinkDialog
          open={!!shareEvent}
          onOpenChange={(open) => !open && setShareEvent(null)}
          eventId={shareEvent.id}
          eventName={shareEvent.name}
        />
      )}
    </AppLayout>
  );
};

export default Events;
