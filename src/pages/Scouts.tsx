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
import { Plus, Search, Users, ArrowRightLeft, UserPlus, Trash2, Camera, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getCurrentBranch,
  getNextBranchChange,
  formatAge,
  formatMonthsLeft,
  SCOUT_BRANCHES,
} from '@/lib/scoutUtils';
import ImageCropper from '@/components/ImageCropper';

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
  const [expandedScouts, setExpandedScouts] = useState<Set<string>>(new Set());

  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingScout, setEditingScout] = useState<Scout | null>(null);
  const [editName, setEditName] = useState('');
  const [editBirth, setEditBirth] = useState('');
  const [editGroup, setEditGroup] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editPhoto, setEditPhoto] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [editUploading, setEditUploading] = useState(false);

  // Scout form
  const [scoutName, setScoutName] = useState('');
  const [scoutBirth, setScoutBirth] = useState('');
  const [scoutGroup, setScoutGroup] = useState('');
  const [scoutNotes, setScoutNotes] = useState('');
  const [scoutPhoto, setScoutPhoto] = useState<File | null>(null);
  const [scoutPhotoPreview, setScoutPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

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

  const toggleExpand = (id: string) => {
    setExpandedScouts(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setScoutPhoto(file);
    const reader = new FileReader();
    reader.onloadend = () => setScoutPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleEditPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEditPhoto(file);
    const reader = new FileReader();
    reader.onloadend = () => setEditPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const uploadPhoto = async (scoutId: string, photo: File): Promise<string | null> => {
    const ext = photo.name.split('.').pop();
    const path = `${scoutId}.${ext}`;
    const { error } = await supabase.storage.from('scout-photos').upload(path, photo, { upsert: true });
    if (error) { console.error('Upload error:', error); return null; }
    const { data: { publicUrl } } = supabase.storage.from('scout-photos').getPublicUrl(path);
    return `${publicUrl}?t=${Date.now()}`;
  };

  const handleCreateScout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setUploading(true);

    const { data, error } = await supabase.from('scouts').insert({
      name: scoutName,
      birth_date: scoutBirth,
      scout_group: scoutGroup,
      notes: scoutNotes,
      created_by: user.id,
    }).select('id').single();

    if (error) {
      toast.error('Erro ao cadastrar: ' + error.message);
      setUploading(false);
      return;
    }

    if (scoutPhoto && data) {
      const photoUrl = await uploadPhoto(data.id, scoutPhoto);
      if (photoUrl) {
        await supabase.from('scouts').update({ photo_url: photoUrl }).eq('id', data.id);
      }
    }

    toast.success('Jovem cadastrado com sucesso!');
    setDialogOpen(false);
    setScoutName(''); setScoutBirth(''); setScoutGroup(''); setScoutNotes('');
    setScoutPhoto(null); setScoutPhotoPreview(null);
    setUploading(false);
    fetchData();
  };

  const openEditDialog = (scout: Scout) => {
    setEditingScout(scout);
    setEditName(scout.name);
    setEditBirth(scout.birth_date);
    setEditGroup(scout.scout_group);
    setEditNotes(scout.notes || '');
    setEditPhoto(null);
    setEditPhotoPreview(scout.photo_url);
    setEditDialogOpen(true);
  };

  const handleEditScout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingScout) return;
    setEditUploading(true);

    let photoUrl = editingScout.photo_url;
    if (editPhoto) {
      const uploaded = await uploadPhoto(editingScout.id, editPhoto);
      if (uploaded) photoUrl = uploaded;
    }

    const { error } = await supabase.from('scouts').update({
      name: editName,
      birth_date: editBirth,
      scout_group: editGroup,
      notes: editNotes,
      photo_url: photoUrl,
    }).eq('id', editingScout.id);

    if (error) {
      toast.error('Erro ao atualizar: ' + error.message);
    } else {
      toast.success('Jovem atualizado com sucesso!');
      setEditDialogOpen(false);
      fetchData();
    }
    setEditUploading(false);
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

  const handleDeleteScout = async (scoutId: string) => {
    const { error } = await supabase.from('scouts').delete().eq('id', scoutId);
    if (error) {
      toast.error('Erro ao excluir: ' + error.message);
    } else {
      toast.success('Jovem excluído!');
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

  const renderScoutForm = (
    onSubmit: (e: React.FormEvent) => Promise<void>,
    name: string, setName: (v: string) => void,
    birth: string, setBirth: (v: string) => void,
    group: string, setGroup: (v: string) => void,
    notes: string, setNotes: (v: string) => void,
    photoPreview: string | null,
    onPhotoSelect: (e: React.ChangeEvent<HTMLInputElement>) => void,
    isUploading: boolean,
    submitLabel: string,
    photoInputId: string,
  ) => (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex flex-col items-center gap-3">
        <label htmlFor={photoInputId} className="cursor-pointer">
          <div className="relative h-20 w-20 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden hover:border-primary transition-colors">
            {photoPreview ? (
              <img src={photoPreview} alt="Preview" className="h-full w-full object-cover" />
            ) : (
              <Camera className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
        </label>
        <input id={photoInputId} type="file" accept="image/*" className="hidden" onChange={onPhotoSelect} />
        <span className="text-xs text-muted-foreground">Toque para adicionar foto</span>
      </div>

      <div className="space-y-2">
        <Label>Nome completo *</Label>
        <Input value={name} onChange={e => setName(e.target.value)} required placeholder="Nome do jovem" className="h-11" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Data de nascimento *</Label>
          <Input type="date" value={birth} onChange={e => setBirth(e.target.value)} required className="h-11" />
        </div>
        <div className="space-y-2">
          <Label>Grupo escoteiro</Label>
          <Input value={group} onChange={e => setGroup(e.target.value)} placeholder="Ex: 123º GE SP" className="h-11" />
        </div>
      </div>
      {birth && (
        <div className="rounded-lg bg-muted/50 p-3 space-y-1">
          <p className="text-sm font-medium">Idade: {formatAge(new Date(birth))}</p>
          {getCurrentBranch(new Date(birth)) && (
            <p className="text-sm text-muted-foreground">
              Ramo atual: {getCurrentBranch(new Date(birth))!.icon} {getCurrentBranch(new Date(birth))!.name}
            </p>
          )}
          {getNextBranchChange(new Date(birth)) && (
            <p className="text-sm text-muted-foreground">
              Mudança para {getNextBranchChange(new Date(birth))!.branch.name}: {formatMonthsLeft(getNextBranchChange(new Date(birth))!.monthsLeft)}
            </p>
          )}
        </div>
      )}
      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas adicionais..." />
      </div>
      <Button type="submit" className="w-full h-11 font-semibold" disabled={isUploading}>
        {isUploading ? 'Salvando...' : submitLabel}
      </Button>
    </form>
  );

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Jovens Escoteiros</h1>
          <p className="mt-1 text-muted-foreground">{scouts.length} jovens cadastrados</p>
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
              {renderScoutForm(
                handleCreateScout,
                scoutName, setScoutName,
                scoutBirth, setScoutBirth,
                scoutGroup, setScoutGroup,
                scoutNotes, setScoutNotes,
                scoutPhotoPreview,
                handlePhotoSelect,
                uploading,
                'Cadastrar',
                'scout-photo-create',
              )}
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
          {[...Array(6)].map((_, i) => <div key={i} className="h-32 animate-pulse rounded-xl bg-muted" />)}
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
            const isExpanded = expandedScouts.has(scout.id);

            return (
              <motion.div
                key={scout.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <Card className="border bg-card shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                  <CardContent className="p-0">
                    {/* Main row: photo, branch, name, age */}
                    <div className="flex items-center gap-3 p-4">
                      {scout.photo_url ? (
                        <img
                          src={scout.photo_url}
                          alt={scout.name}
                          className="h-14 w-14 rounded-full object-cover ring-2 ring-muted flex-shrink-0"
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-2xl ring-2 ring-muted flex-shrink-0">
                          {branch?.icon || '⚜️'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold tracking-tight truncate">{scout.name}</h3>
                        <p className="text-sm text-muted-foreground">{formatAge(new Date(scout.birth_date))}</p>
                        <div className="flex gap-1.5 mt-1">
                          {branch && (
                            <Badge className={`${branchColorMap[branch.color]} border font-normal text-xs`}>
                              {branch.icon} {branch.name}
                            </Badge>
                          )}
                          {scout.scout_group && (
                            <Badge variant="outline" className="font-normal text-xs">{scout.scout_group}</Badge>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0"
                        onClick={() => toggleExpand(scout.id)}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                    </div>

                    {/* Expandable details */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 space-y-3 border-t pt-3">
                            {nextChange && (
                              <div className="rounded-lg bg-muted/50 p-2.5">
                                <div className="flex items-center gap-2 text-sm">
                                  <ArrowRightLeft className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-muted-foreground">
                                    {nextChange.branch.icon} {nextChange.branch.name} em{' '}
                                    <span className="font-medium text-foreground">{formatMonthsLeft(nextChange.monthsLeft)}</span>
                                  </span>
                                </div>
                              </div>
                            )}

                            {scout.notes && (
                              <div className="text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">Obs:</span> {scout.notes}
                              </div>
                            )}

                            {/* Guardians */}
                            <div>
                              <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-muted-foreground">
                                  {scoutGuardians.length > 0
                                    ? `${scoutGuardians.length} responsável(is)`
                                    : <span className="text-amber-600">Sem responsável</span>}
                                </span>
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
                                <div className="space-y-1">
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
                            </div>

                            {/* Actions: Edit (admin/chefe) + Delete (admin only) */}
                            <div className="flex gap-2 pt-1">
                              {(isAdmin || isChefe) && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="gap-1.5 flex-1"
                                  onClick={() => openEditDialog(scout)}
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                  Editar
                                </Button>
                              )}
                              {isAdmin && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm" className="gap-1.5">
                                      <Trash2 className="h-3.5 w-3.5" />
                                      Excluir
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>Excluir "{scout.name}"?</AlertDialogTitle>
                                      <AlertDialogDescription>Esta ação excluirá o jovem e todos os responsáveis associados.</AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDeleteScout(scout.id)}>Excluir</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Jovem Escoteiro</DialogTitle>
          </DialogHeader>
          {renderScoutForm(
            handleEditScout,
            editName, setEditName,
            editBirth, setEditBirth,
            editGroup, setEditGroup,
            editNotes, setEditNotes,
            editPhotoPreview,
            handleEditPhotoSelect,
            editUploading,
            'Salvar Alterações',
            'scout-photo-edit',
          )}
        </DialogContent>
      </Dialog>

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
