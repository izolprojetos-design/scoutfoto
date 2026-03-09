import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import AppLayout from '@/components/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Search, Users, Calendar, ArrowRightLeft, UserPlus, Trash2 } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import {
  getCurrentBranch,
  getNextBranchChange,
  formatAge,
  formatMonthsLeft,
  SCOUT_BRANCHES,
} from '@/lib/scoutUtils';

interface Scout {
  id: string;
  name: string;
  photo_url: string | null;
  birth_date: string;
  scout_group: string;
  notes: string;
  created_at: string;
}

interface Guardian {
  id: string;
  name: string;
  email: string;
  phone: string;
  scout_id: string;
  image_authorization: boolean;
  authorization_date: string | null;
}

const branchColorMap: Record<string, string> = {
  amber: 'bg-amber-100 text-amber-800 border-amber-200',
  emerald: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  red: 'bg-red-100 text-red-800 border-red-200',
  orange: 'bg-orange-100 text-orange-800 border-orange-200',
};

const Scouts = () => {
  const { user, isAdmin, isChefe, canUpload } = useAuth();
  const [scouts, setScouts] = useState<Scout[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [guardianDialogOpen, setGuardianDialogOpen] = useState(false);
  const [selectedScout, setSelectedScout] = useState<Scout | null>(null);

  // Scout form
  const [scoutName, setScoutName] = useState('');
  const [scoutBirth, setScoutBirth] = useState('');
  const [scoutGroup, setScoutGroup] = useState('');
  const [scoutNotes, setScoutNotes] = useState('');

  // Guardian form
  const [guardianName, setGuardianName] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianAuth, setGuardianAuth] = useState(false);

  const fetchData = async () => {
    const [{ data: scoutData }, { data: guardianData }] = await Promise.all([
      supabase.from('scouts').select('*').order('name'),
      supabase.from('guardians').select('*'),
    ]);
    setScouts(scoutData || []);
    setGuardians(guardianData || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreateScout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    const { error } = await supabase.from('scouts').insert({
      name: scoutName,
      birth_date: scoutBirth,
      scout_group: scoutGroup,
      notes: scoutNotes,
      created_by: user.id,
    });

    if (error) {
      toast.error('Erro ao cadastrar: ' + error.message);
    } else {
      toast.success('Jovem cadastrado com sucesso!');
      setDialogOpen(false);
      setScoutName(''); setScoutBirth(''); setScoutGroup(''); setScoutNotes('');
      fetchData();
    }
  };

  const handleAddGuardian = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedScout) return;

    const { error } = await supabase.from('guardians').insert({
      name: guardianName,
      email: guardianEmail,
      phone: guardianPhone,
      scout_id: selectedScout.id,
      image_authorization: guardianAuth,
      authorization_date: guardianAuth ? new Date().toISOString() : null,
      created_by: user.id,
    });

    if (error) {
      toast.error('Erro: ' + error.message);
    } else {
      toast.success('Responsável adicionado!');
      setGuardianDialogOpen(false);
      setGuardianName(''); setGuardianEmail(''); setGuardianPhone(''); setGuardianAuth(false);
      fetchData();
    }
  };

  const filteredScouts = scouts.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.scout_group.toLowerCase().includes(search.toLowerCase());
    if (branchFilter === 'all') return matchSearch;
    const branch = getCurrentBranch(new Date(s.birth_date));
    return matchSearch && branch?.key === branchFilter;
  });

  const getGuardiansForScout = (scoutId: string) =>
    guardians.filter(g => g.scout_id === scoutId);

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jovens Escoteiros</h1>
          <p className="mt-1 text-muted-foreground">
            {scouts.length} jovens cadastrados
          </p>
        </div>
        {(isAdmin || isChefe || canUpload) && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-sm">
                <Plus className="h-4 w-4" />
                Novo Jovem
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar Jovem Escoteiro</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreateScout} className="space-y-4">
                <div className="space-y-2">
                  <Label>Nome completo *</Label>
                  <Input value={scoutName} onChange={e => setScoutName(e.target.value)} required placeholder="Nome do jovem" className="h-11" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Data de nascimento *</Label>
                    <Input type="date" value={scoutBirth} onChange={e => setScoutBirth(e.target.value)} required className="h-11" />
                  </div>
                  <div className="space-y-2">
                    <Label>Grupo escoteiro</Label>
                    <Input value={scoutGroup} onChange={e => setScoutGroup(e.target.value)} placeholder="Ex: 123º GE SP" className="h-11" />
                  </div>
                </div>
                {scoutBirth && (
                  <div className="rounded-lg bg-muted/50 p-3 space-y-1">
                    <p className="text-sm font-medium">
                      Idade: {formatAge(new Date(scoutBirth))}
                    </p>
                    {getCurrentBranch(new Date(scoutBirth)) && (
                      <p className="text-sm text-muted-foreground">
                        Ramo atual: {getCurrentBranch(new Date(scoutBirth))!.icon} {getCurrentBranch(new Date(scoutBirth))!.name}
                      </p>
                    )}
                    {getNextBranchChange(new Date(scoutBirth)) && (
                      <p className="text-sm text-muted-foreground">
                        Mudança para {getNextBranchChange(new Date(scoutBirth))!.branch.name}: {formatMonthsLeft(getNextBranchChange(new Date(scoutBirth))!.monthsLeft)}
                      </p>
                    )}
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea value={scoutNotes} onChange={e => setScoutNotes(e.target.value)} placeholder="Notas adicionais..." />
                </div>
                <Button type="submit" className="w-full h-11 font-semibold">Cadastrar</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou grupo..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button variant={branchFilter === 'all' ? 'default' : 'outline'} size="sm" onClick={() => setBranchFilter('all')}>
            Todos
          </Button>
          {SCOUT_BRANCHES.map(b => (
            <Button key={b.key} variant={branchFilter === b.key ? 'default' : 'outline'} size="sm" onClick={() => setBranchFilter(b.key)}>
              {b.icon} {b.name}
            </Button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-48 animate-pulse rounded-xl bg-muted" />)}
        </div>
      ) : filteredScouts.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-muted-foreground">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
            <Users className="h-8 w-8" />
          </div>
          <p className="text-lg font-medium text-foreground">Nenhum jovem cadastrado</p>
          <p className="mt-1 text-sm">Cadastre o primeiro jovem escoteiro</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredScouts.map((scout, index) => {
            const branch = getCurrentBranch(new Date(scout.birth_date));
            const nextChange = getNextBranchChange(new Date(scout.birth_date));
            const scoutGuardians = getGuardiansForScout(scout.id);

            return (
              <motion.div
                key={scout.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <Card className="border bg-card shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-2xl">
                          {branch?.icon || '⚜️'}
                        </div>
                        <div>
                          <h3 className="font-semibold tracking-tight">{scout.name}</h3>
                          <p className="text-sm text-muted-foreground">{formatAge(new Date(scout.birth_date))}</p>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {branch && (
                        <Badge className={`${branchColorMap[branch.color]} border font-normal`}>
                          {branch.icon} {branch.name}
                        </Badge>
                      )}
                      {scout.scout_group && (
                        <Badge variant="outline" className="font-normal">{scout.scout_group}</Badge>
                      )}
                    </div>

                    {nextChange && (
                      <div className="rounded-lg bg-muted/50 p-2.5 mb-3">
                        <div className="flex items-center gap-2 text-sm">
                          <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                          <span className="text-muted-foreground">
                            {nextChange.branch.icon} {nextChange.branch.name} em{' '}
                            <span className="font-medium text-foreground">{formatMonthsLeft(nextChange.monthsLeft)}</span>
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Guardians */}
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">
                        {scoutGuardians.length > 0 ? (
                          <span>{scoutGuardians.length} responsável(is)</span>
                        ) : (
                          <span className="text-amber-600">Sem responsável</span>
                        )}
                      </div>
                      {(isAdmin || isChefe) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-xs"
                          onClick={() => { setSelectedScout(scout); setGuardianDialogOpen(true); }}
                        >
                          <UserPlus className="h-3 w-3" />
                          Responsável
                        </Button>
                      )}
                    </div>

                    {scoutGuardians.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {scoutGuardians.map(g => (
                          <div key={g.id} className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{g.name}</span>
                            <Badge variant={g.image_authorization ? 'default' : 'secondary'} className="text-[10px] h-5">
                              {g.image_authorization ? '✅ Autorizado' : '❌ Não autorizado'}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Guardian Dialog */}
      <Dialog open={guardianDialogOpen} onOpenChange={setGuardianDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adicionar Responsável — {selectedScout?.name}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleAddGuardian} className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do responsável *</Label>
              <Input value={guardianName} onChange={e => setGuardianName(e.target.value)} required placeholder="Nome completo" className="h-11" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Email</Label>
                <Input type="email" value={guardianEmail} onChange={e => setGuardianEmail(e.target.value)} placeholder="email@exemplo.com" className="h-11" />
              </div>
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input value={guardianPhone} onChange={e => setGuardianPhone(e.target.value)} placeholder="(11) 99999-9999" className="h-11" />
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border bg-muted/50 p-4">
              <input
                type="checkbox"
                id="img-auth"
                checked={guardianAuth}
                onChange={e => setGuardianAuth(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              <Label htmlFor="img-auth" className="text-sm leading-snug">
                Autorizo o uso de imagem do jovem em atividades escoteiras
              </Label>
            </div>
            <Button type="submit" className="w-full h-11 font-semibold">Adicionar Responsável</Button>
          </form>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Scouts;
