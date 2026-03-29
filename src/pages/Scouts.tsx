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
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Search, Users, ArrowRightLeft, UserPlus, Trash2, Camera, ChevronDown, ChevronUp, Pencil, Download } from 'lucide-react';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getCurrentBranch,
  getNextBranchChange,
  formatAge,
  formatTimeLeft,
  calculateAge,
  SCOUT_BRANCHES,
  ALL_CATEGORIES,
} from '@/lib/scoutUtils';
import ImageCropper from '@/components/ImageCropper';
import CloudPhotoPickerDialog from '@/components/CloudPhotoPickerDialog';

interface Scout {
  id: string;
  name: string;
  photo_url: string | null;
  birth_date: string;
  scout_group: string;
  notes: string;
  created_at: string;
  manual_branch: string | null;
  subgroup_id: string | null;
}

interface Subgroup {
  id: string;
  name: string;
  branch_key: string;
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
  purple: 'bg-purple-100 text-purple-800 border-purple-200',
  blue: 'bg-blue-100 text-blue-800 border-blue-200',
};

const Scouts = () => {
  const { user, isAdmin, isChefe, isDirigente, canUpload } = useAuth();
  const [scouts, setScouts] = useState<Scout[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [subgroups, setSubgroups] = useState<Subgroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [guardianDialogOpen, setGuardianDialogOpen] = useState(false);
  const [selectedScout, setSelectedScout] = useState<Scout | null>(null);
  const [expandedScouts, setExpandedScouts] = useState<Set<string>>(new Set());
  const [viewingPhoto, setViewingPhoto] = useState<string | null>(null);
  const [viewingScout, setViewingScout] = useState<Scout | null>(null);

  // Edit state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingScout, setEditingScout] = useState<Scout | null>(null);
  const [editName, setEditName] = useState('');
  const [editBirth, setEditBirth] = useState('');
  const [editGroup, setEditGroup] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editBranch, setEditBranch] = useState('auto');
  const [editSubgroup, setEditSubgroup] = useState('none');
  const [editPhoto, setEditPhoto] = useState<File | null>(null);
  const [editPhotoPreview, setEditPhotoPreview] = useState<string | null>(null);
  const [editUploading, setEditUploading] = useState(false);

  // Scout form
  const [scoutName, setScoutName] = useState('');
  const [scoutBirth, setScoutBirth] = useState('');
  const [scoutGroup, setScoutGroup] = useState('');
  const [scoutNotes, setScoutNotes] = useState('');
  const [scoutBranch, setScoutBranch] = useState('auto');
  const [scoutSubgroup, setScoutSubgroup] = useState('none');
  const [scoutPhoto, setScoutPhoto] = useState<File | null>(null);
  const [scoutPhotoPreview, setScoutPhotoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Cropper state
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImage, setCropperImage] = useState('');
  const [cropperTarget, setCropperTarget] = useState<'new' | 'edit'>('new');

  // Cloud picker state
  const [cloudPickerOpen, setCloudPickerOpen] = useState(false);
  const [cloudPickerTarget, setCloudPickerTarget] = useState<'new' | 'edit'>('new');

  // Guardian form (separate dialog)
  const [guardianName, setGuardianName] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianAuth, setGuardianAuth] = useState(false);
  const [newSubgroupName, setNewSubgroupName] = useState('');
  const [creatingSubgroup, setCreatingSubgroup] = useState(false);

  // Inline guardian for new scout (minor)
  const [inlineGuardianName, setInlineGuardianName] = useState('');
  const [inlineGuardianEmail, setInlineGuardianEmail] = useState('');
  const [inlineGuardianPhone, setInlineGuardianPhone] = useState('');
  const [inlineGuardianAuth, setInlineGuardianAuth] = useState(false);


  const fetchData = async () => {
    const [{ data: scoutData }, { data: guardianData }, { data: subgroupData }] = await Promise.all([
      supabase.from('scouts').select('*').order('name'),
      supabase.from('guardians').select('*'),
      supabase.from('subgroups').select('*').order('name'),
    ]);
    setScouts(scoutData || []);
    setGuardians(guardianData || []);
    setSubgroups(subgroupData || []);
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
    const reader = new FileReader();
    reader.onloadend = () => {
      setCropperImage(reader.result as string);
      setCropperTarget('new');
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleEditPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      setCropperImage(reader.result as string);
      setCropperTarget('edit');
      setCropperOpen(true);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleCropComplete = (croppedFile: File) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (cropperTarget === 'new') {
        setScoutPhoto(croppedFile);
        setScoutPhotoPreview(reader.result as string);
      } else {
        setEditPhoto(croppedFile);
        setEditPhotoPreview(reader.result as string);
      }
    };
    reader.readAsDataURL(croppedFile);
    setCropperOpen(false);
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
      manual_branch: scoutBranch !== 'auto' ? scoutBranch : null,
      subgroup_id: scoutSubgroup !== 'none' ? scoutSubgroup : null,
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

    // Save inline guardian if minor and guardian name provided
    if (data && inlineGuardianName.trim()) {
      await supabase.from('guardians').insert({
        name: inlineGuardianName,
        email: inlineGuardianEmail,
        phone: inlineGuardianPhone,
        scout_id: data.id,
        image_authorization: inlineGuardianAuth,
        authorization_date: inlineGuardianAuth ? new Date().toISOString() : null,
        created_by: user.id,
      });
    }

    toast.success('Membro cadastrado com sucesso!');
    setDialogOpen(false);
    setScoutName(''); setScoutBirth(''); setScoutGroup(''); setScoutNotes(''); setScoutBranch('auto'); setScoutSubgroup('none');
    setScoutPhoto(null); setScoutPhotoPreview(null);
    setInlineGuardianName(''); setInlineGuardianEmail(''); setInlineGuardianPhone(''); setInlineGuardianAuth(false);
    setUploading(false);
    fetchData();
  };

  const openEditDialog = (scout: Scout) => {
    setEditingScout(scout);
    setEditName(scout.name);
    setEditBirth(scout.birth_date);
    setEditGroup(scout.scout_group);
    setEditNotes(scout.notes || '');
    setEditBranch(scout.manual_branch || 'auto');
    setEditSubgroup(scout.subgroup_id || 'none');
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
      manual_branch: editBranch !== 'auto' ? editBranch : null,
      subgroup_id: editSubgroup !== 'none' ? editSubgroup : null,
    }).eq('id', editingScout.id);

    if (error) {
      toast.error('Erro ao atualizar: ' + error.message);
    } else {
      toast.success('Membro atualizado com sucesso!');
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
      toast.success('Membro excluído!');
      fetchData();
    }
  };

  const getEffectiveBranch = (scout: Scout) => {
    if (scout.manual_branch) {
      return ALL_CATEGORIES.find(b => b.key === scout.manual_branch) || getCurrentBranch(new Date(scout.birth_date));
    }
    return getCurrentBranch(new Date(scout.birth_date));
  };

  const branchOrder = ALL_CATEGORIES.map(b => b.key);

  const filteredScouts = scouts.filter(s => {
    const matchSearch = s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.scout_group.toLowerCase().includes(search.toLowerCase());
    if (branchFilter === 'all') return matchSearch;
    const branch = getEffectiveBranch(s);
    return matchSearch && branch?.key === branchFilter;
  }).sort((a, b) => {
    if (branchFilter !== 'all') return 0;
    const branchA = getEffectiveBranch(a);
    const branchB = getEffectiveBranch(b);
    const idxA = branchA ? branchOrder.indexOf(branchA.key) : 999;
    const idxB = branchB ? branchOrder.indexOf(branchB.key) : 999;
    return idxA - idxB;
  });

  const branchCounts = scouts.reduce((acc, s) => {
    const branch = getEffectiveBranch(s);
    if (branch) acc[branch.key] = (acc[branch.key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const getGuardiansForScout = (scoutId: string) =>
    guardians.filter(g => g.scout_id === scoutId);

  const handleCreateSubgroup = async (branchKey: string) => {
    if (!user || !newSubgroupName.trim()) return null;
    setCreatingSubgroup(true);
    const name = newSubgroupName.trim();
    const { data, error } = await supabase.from('subgroups').insert({
      name,
      branch_key: branchKey,
      created_by: user.id,
    }).select('*').single();
    setCreatingSubgroup(false);
    if (error) {
      toast.error('Erro ao criar subgrupo: ' + error.message);
      return null;
    }
    if (data) {
      toast.success('Subgrupo criado!');
      setNewSubgroupName('');
      setSubgroups(prev => [...prev, data as Subgroup]);
      return data.id;
    }
    return null;
  };

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
    branchOverride: string, setBranchOverride: (v: string) => void,
    subgroupId: string, setSubgroupId: (v: string) => void,
    formTarget: 'new' | 'edit',
    guardianFields?: {
      name: string; setName: (v: string) => void;
      email: string; setEmail: (v: string) => void;
      phone: string; setPhone: (v: string) => void;
      auth: boolean; setAuth: (v: boolean) => void;
    },
  ) => {
    const detectedBranch = birth ? getCurrentBranch(new Date(birth)) : null;
    const effectiveBranch = branchOverride !== 'auto' 
      ? ALL_CATEGORIES.find(b => b.key === branchOverride) 
      : detectedBranch;
    const effectiveBranchKey = effectiveBranch?.key || '';
    const filteredSubgroups = subgroups.filter(sg => sg.branch_key === effectiveBranchKey);
    const isMinor = birth ? (calculateAge(new Date(birth)).years < 18) : false;

    return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex flex-col items-center gap-3">
        <label htmlFor={photoInputId} className="cursor-pointer">
          <div className="relative h-24 w-24 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden hover:border-primary transition-colors">
            {photoPreview ? (
              <img src={photoPreview} alt="Preview" className="h-full w-full object-cover rounded-full" />
            ) : (
              <Camera className="h-6 w-6 text-muted-foreground" />
            )}
          </div>
        </label>
        <input id={photoInputId} type="file" accept="image/*" className="hidden" onChange={onPhotoSelect} />
        <input id={`${photoInputId}-camera`} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhotoSelect} />
        <span className="text-xs text-muted-foreground">Toque para adicionar foto</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-2"
          onClick={() => document.getElementById(`${photoInputId}-camera`)?.click()}
        >
          <Camera className="h-4 w-4" />
          Tirar Foto com Câmera
        </Button>
      </div>

      <div className="space-y-2">
        <Label>Nome completo *</Label>
        <Input value={name} onChange={e => setName(e.target.value)} required placeholder="Nome completo" className="h-11" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Data de nascimento *</Label>
          <Input type="date" value={birth} onChange={e => setBirth(e.target.value)} required className="h-11" />
        </div>
        <div className="space-y-2">
          <Label>Grupo escoteiro</Label>
          <Input value={group} onChange={e => setGroup(e.target.value)} placeholder="Ex: 12º GEMC" className="h-11" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Ramo</Label>
        <Select value={branchOverride} onValueChange={setBranchOverride}>
          <SelectTrigger className="h-11">
            <SelectValue placeholder="Selecione o ramo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Automático (por idade)</SelectItem>
            {ALL_CATEGORIES.map(b => (
              <SelectItem key={b.key} value={b.key}>
                {b.icon} {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {effectiveBranchKey && (
        <div className="space-y-2">
          <Label>Patrulha / Matilha</Label>
          <Select value={subgroupId} onValueChange={setSubgroupId}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Selecione o subgrupo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Nenhum</SelectItem>
              {filteredSubgroups.map(sg => (
                <SelectItem key={sg.id} value={sg.id}>{sg.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Input
              value={newSubgroupName}
              onChange={e => setNewSubgroupName(e.target.value)}
              placeholder="Novo subgrupo..."
              className="h-9 text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!newSubgroupName.trim() || creatingSubgroup}
              onClick={async () => {
                const newId = await handleCreateSubgroup(effectiveBranchKey);
                if (newId) setSubgroupId(newId);
                setCreatingSubgroup(false);
              }}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
      {birth && (
        <div className="rounded-lg bg-muted/50 p-3 space-y-1">
          <p className="text-sm font-medium">Idade: {formatAge(new Date(birth))}</p>
          {effectiveBranch && (
            <p className="text-sm text-muted-foreground">
              Ramo: {effectiveBranch.icon} {effectiveBranch.name}
              {branchOverride === 'auto' && ' (automático)'}
            </p>
          )}
          {branchOverride === 'auto' && getNextBranchChange(new Date(birth)) && (
            <p className="text-sm text-muted-foreground">
              Mudança para {getNextBranchChange(new Date(birth))!.branch.name}: {formatTimeLeft(getNextBranchChange(new Date(birth))!.monthsLeft, getNextBranchChange(new Date(birth))!.daysLeft)}
            </p>
          )}
        </div>
      )}
      <div className="space-y-2">
        <Label>Observações</Label>
        <Textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notas adicionais..." />
      </div>
      {isMinor && guardianFields && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
          <div className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            <Label className="text-sm font-semibold text-primary">Responsável (menor de idade)</Label>
          </div>
          <div className="space-y-2">
            <Label className="text-xs">Nome do responsável *</Label>
            <Input value={guardianFields.name} onChange={e => guardianFields.setName(e.target.value)} placeholder="Nome completo do responsável" className="h-10" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">E-mail</Label>
              <Input type="email" value={guardianFields.email} onChange={e => guardianFields.setEmail(e.target.value)} placeholder="email@exemplo.com" className="h-10" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Telefone</Label>
              <Input value={guardianFields.phone} onChange={e => guardianFields.setPhone(e.target.value)} placeholder="(00) 00000-0000" className="h-10" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="inline-guardian-auth" checked={guardianFields.auth} onChange={e => guardianFields.setAuth(e.target.checked)} className="rounded border-input" />
            <Label htmlFor="inline-guardian-auth" className="text-xs cursor-pointer">Autorização de imagem concedida</Label>
          </div>
        </div>
      )}
      <Button type="submit" className="w-full h-11 font-semibold" disabled={isUploading}>
        {isUploading ? 'Salvando...' : submitLabel}
      </Button>
    </form>
  );};

  return (
    <AppLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrantes</h1>
          <p className="mt-1 text-muted-foreground">{scouts.length} cadastrados</p>
        </div>
        {(isAdmin || isChefe || isDirigente || canUpload) && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-sm">
                <Plus className="h-4 w-4" />
                Novo Integrante
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Cadastrar Membro</DialogTitle>
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
                scoutBranch, setScoutBranch,
                scoutSubgroup, setScoutSubgroup,
                {
                  name: inlineGuardianName, setName: setInlineGuardianName,
                  email: inlineGuardianEmail, setEmail: setInlineGuardianEmail,
                  phone: inlineGuardianPhone, setPhone: setInlineGuardianPhone,
                  auth: inlineGuardianAuth, setAuth: setInlineGuardianAuth,
                },
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
          {ALL_CATEGORIES.map(b => (
            <Button key={b.key} variant={branchFilter === b.key ? 'default' : 'outline'} size="sm" onClick={() => setBranchFilter(b.key)}>
              {b.icon} {b.name} {branchCounts[b.key] ? `(${branchCounts[b.key]})` : ''}
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
          <p className="text-lg font-medium text-foreground">Nenhum membro cadastrado</p>
          <p className="mt-1 text-sm">Cadastre o primeiro membro</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredScouts.map((scout, index) => {
            const branch = getEffectiveBranch(scout);
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
                          className="h-14 w-14 rounded-full object-cover ring-2 ring-muted flex-shrink-0 cursor-pointer hover:ring-primary transition-all"
                          onClick={(e) => { e.stopPropagation(); setViewingPhoto(scout.photo_url); }}
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-2xl ring-2 ring-muted flex-shrink-0">
                          {branch?.icon || '⚜️'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <h3
                          className="font-semibold tracking-tight truncate cursor-pointer hover:text-primary transition-colors"
                          onClick={(e) => { e.stopPropagation(); setViewingScout(scout); }}
                        >
                          {scout.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">{formatAge(new Date(scout.birth_date))}</p>
                        <div className="flex flex-wrap gap-1.5 mt-1">
                          {branch && (
                            <Badge className={`${branchColorMap[branch.color]} border font-normal text-xs`}>
                              {branch.icon} {branch.name}
                            </Badge>
                          )}
                          {scout.subgroup_id && (() => {
                            const sg = subgroups.find(s => s.id === scout.subgroup_id);
                            return sg ? <Badge variant="secondary" className="font-normal text-xs">{sg.name}</Badge> : null;
                          })()}
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
                                    <span className="font-medium text-foreground">{formatTimeLeft(nextChange.monthsLeft, nextChange.daysLeft)}</span>
                                  </span>
                                </div>
                              </div>
                            )}

                            {scout.notes && (
                              <div className="text-sm text-muted-foreground">
                                <span className="font-medium text-foreground">Obs:</span> {scout.notes}
                              </div>
                            )}

                            {/* Guardians - only show for minors (under 18) */}
                            {(() => {
                              const ageInYears = calculateAge(new Date(scout.birth_date)).years;
                              const isMinor = ageInYears < 18;
                              if (!isMinor && scoutGuardians.length === 0) return null;
                              return (
                                <div>
                                  <div className="flex items-center justify-between mb-1">
                                    <span className="text-xs font-medium text-muted-foreground">
                                      {scoutGuardians.length > 0
                                        ? `${scoutGuardians.length} responsável(is)`
                                        : isMinor
                                          ? <span className="text-amber-600">Sem responsável</span>
                                          : null}
                                    </span>
                                    {(isAdmin || isChefe || isDirigente) && isMinor && (
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
                              );
                            })()}

                            {/* Actions: Edit (admin/chefe) + Delete (admin only) */}
                            <div className="flex gap-2 pt-1">
                              {(isAdmin || isChefe || isDirigente) && (
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
            <DialogTitle>Editar Membro</DialogTitle>
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
            editBranch, setEditBranch,
            editSubgroup, setEditSubgroup,
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

      <ImageCropper
        open={cropperOpen}
        imageSrc={cropperImage}
        onClose={() => setCropperOpen(false)}
        onCropComplete={handleCropComplete}
      />

      {/* Scout detail viewer dialog */}
      <Dialog open={!!viewingScout} onOpenChange={() => setViewingScout(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dados do Integrante</DialogTitle>
          </DialogHeader>
          {viewingScout && (() => {
            const branch = getCurrentBranch(new Date(viewingScout.birth_date));
            const nextChange = getNextBranchChange(new Date(viewingScout.birth_date));
            const scoutGuardians = getGuardiansForScout(viewingScout.id);
            const ageInYears = calculateAge(new Date(viewingScout.birth_date)).years;
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  {viewingScout.photo_url ? (
                    <img
                      src={viewingScout.photo_url}
                      alt={viewingScout.name}
                      className="h-20 w-20 rounded-full object-cover ring-2 ring-muted cursor-pointer hover:ring-primary transition-all"
                      onClick={() => setViewingPhoto(viewingScout.photo_url)}
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-3xl ring-2 ring-muted">
                      {branch?.icon || '⚜️'}
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-semibold">{viewingScout.name}</h3>
                    <p className="text-sm text-muted-foreground">{formatAge(new Date(viewingScout.birth_date))}</p>
                    <div className="flex gap-1.5 mt-1">
                      {branch && (
                        <Badge className={`${branchColorMap[branch.color]} border font-normal text-xs`}>
                          {branch.icon} {branch.name}
                        </Badge>
                      )}
                      {viewingScout.scout_group && (
                        <Badge variant="outline" className="font-normal text-xs">{viewingScout.scout_group}</Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Data de nascimento</span>
                    <span className="font-medium">
                      {new Date(viewingScout.birth_date).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  {viewingScout.scout_group && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Grupo Escoteiro</span>
                      <span className="font-medium">{viewingScout.scout_group}</span>
                    </div>
                  )}
                  {nextChange && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Próximo ramo</span>
                      <span className="font-medium">
                        {nextChange.branch.icon} {nextChange.branch.name} em {formatTimeLeft(nextChange.monthsLeft, nextChange.daysLeft)}
                      </span>
                    </div>
                  )}
                  {viewingScout.notes && (
                    <div className="py-2 border-b">
                      <span className="text-muted-foreground">Observações</span>
                      <p className="mt-1 font-medium">{viewingScout.notes}</p>
                    </div>
                  )}
                </div>

                {scoutGuardians.length > 0 && (
                  <div>
                    <h4 className="text-sm font-medium mb-2">Responsáveis</h4>
                    <div className="space-y-2">
                      {scoutGuardians.map(g => (
                        <div key={g.id} className="rounded-lg border p-3 text-sm space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="font-medium">{g.name}</span>
                            <Badge variant={g.image_authorization ? 'default' : 'secondary'} className="text-[10px] h-5">
                              {g.image_authorization ? '✅ Autorizado' : '❌ Não autorizado'}
                            </Badge>
                          </div>
                          {g.email && <p className="text-muted-foreground">{g.email}</p>}
                          {g.phone && <p className="text-muted-foreground">{g.phone}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {ageInYears < 18 && scoutGuardians.length === 0 && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-800">
                    ⚠️ Nenhum responsável cadastrado para este menor de idade.
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Photo viewer dialog */}
      <Dialog open={!!viewingPhoto} onOpenChange={() => setViewingPhoto(null)}>
        <DialogContent className="max-w-lg p-2 bg-background/95 backdrop-blur">
          <DialogHeader className="sr-only">
            <DialogTitle>Foto do jovem</DialogTitle>
          </DialogHeader>
          {viewingPhoto && (
            <div className="relative">
              <img
                src={viewingPhoto}
                alt="Foto do jovem"
                className="w-full h-auto rounded-lg object-contain max-h-[75vh]"
              />
              <div className="flex justify-center mt-3 pb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const response = await fetch(viewingPhoto);
                      const blob = await response.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'foto-escoteiro.jpg';
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch {
                      toast.error('Erro ao baixar a foto');
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-1" /> Baixar foto
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Scouts;
