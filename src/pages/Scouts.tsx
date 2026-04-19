import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { getSignedPhotoUrl } from '@/lib/storageUtils';
import ScoutPhoto from '@/components/ScoutPhoto';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Plus, Search, Users, ArrowRightLeft, UserPlus, Trash2, Camera, ChevronDown, ChevronUp, Pencil, Download, Cloud, X, ImageIcon, FileDown, FileSpreadsheet, UserCheck, UserX, Power } from 'lucide-react';
import { logAudit } from '@/lib/auditLog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getCurrentBranch,
  getNextBranchChange,
  formatAge,
  formatTimeLeft,
  calculateAge,
  parseLocalDate,
  SCOUT_BRANCHES,
  ALL_CATEGORIES,
} from '@/lib/scoutUtils';
import ImageCropper from '@/components/ImageCropper';
import CloudPhotoPickerDialog from '@/components/CloudPhotoPickerDialog';
import { compressScoutPhoto } from '@/lib/imageCompression';
import { VOLUNTEER_SECTIONS, VOLUNTEER_CARGO_CATEGORIES, parseVolunteerSection, buildVolunteerSection } from '@/lib/sectionOptions';

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
  registration_id: string;
  phone: string;
  section: string;
  transition_date: string | null;
  is_active: boolean;
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
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isAdmin, isVoluntario, canUpload } = useAuth();
  const { canManageScouts, canEditScouts, canViewGuardians } = usePermissions();
  const [scouts, setScouts] = useState<Scout[]>([]);
  const [guardians, setGuardians] = useState<Guardian[]>([]);
  const [subgroups, setSubgroups] = useState<Subgroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [branchFilter, setBranchFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | 'all'>('active');
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
  const [editRegistrationId, setEditRegistrationId] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editSection, setEditSection] = useState('');
  const [editTransitionDate, setEditTransitionDate] = useState('');
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
  const [scoutRegistrationId, setScoutRegistrationId] = useState('');
  const [scoutPhone, setScoutPhone] = useState('');
  const [scoutSection, setScoutSection] = useState('');
  const [scoutTransitionDate, setScoutTransitionDate] = useState('');
  // Cropper state
  const [cropperOpen, setCropperOpen] = useState(false);
  const [cropperImage, setCropperImage] = useState('');
  const [cropperTarget, setCropperTarget] = useState<'new' | 'edit'>('new');
  // Tracks if a camera/file picker is currently in progress (prevents parent Dialog from closing on mobile remount)
  const photoPickInProgressRef = useRef(false);

  // Cloud picker state
  const [cloudPickerOpen, setCloudPickerOpen] = useState(false);
  const [cloudPickerTarget, setCloudPickerTarget] = useState<'new' | 'edit'>('new');

  // Guardian form (separate dialog)
  const [guardianName, setGuardianName] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianAuth, setGuardianAuth] = useState(true);
  const [newSubgroupName, setNewSubgroupName] = useState('');
  const [creatingSubgroup, setCreatingSubgroup] = useState(false);
  const [customSectionMode, setCustomSectionMode] = useState(false);
  const [newSectionName, setNewSectionName] = useState('');

  // Inline guardian for new scout (minor)
  const [inlineGuardianName, setInlineGuardianName] = useState('');
  const [inlineGuardianEmail, setInlineGuardianEmail] = useState('');
  const [inlineGuardianPhone, setInlineGuardianPhone] = useState('');
  const [inlineGuardianAuth, setInlineGuardianAuth] = useState(true);

  // Auto-clear broken photo URLs from the database
  const clearedPhotoIds = useRef(new Set<string>());
  const handleBrokenPhoto = async (scoutId: string, imgEl: HTMLImageElement) => {
    imgEl.style.display = 'none';
    const fallback = imgEl.nextElementSibling as HTMLElement;
    if (fallback) fallback.style.display = 'flex';
    if (clearedPhotoIds.current.has(scoutId)) return;
    clearedPhotoIds.current.add(scoutId);
    await supabase.from('scouts').update({ photo_url: null }).eq('id', scoutId);
    setScouts(prev => prev.map(s => s.id === scoutId ? { ...s, photo_url: null } : s));
  };

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

  // Auto-open edit dialog when navigated with ?edit=scoutId
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId && scouts.length > 0 && !editDialogOpen) {
      const scout = scouts.find(s => s.id === editId);
      if (scout) {
        openEditDialog(scout);
        setSearchParams({}, { replace: true });
      }
    }
  }, [scouts, searchParams]);

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
    if (!file) {
      photoPickInProgressRef.current = false;
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setCropperImage(reader.result as string);
      setCropperTarget('new');
      setCropperOpen(true);
      // keep flag true; cleared when cropper closes
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleEditPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      photoPickInProgressRef.current = false;
      return;
    }
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
    photoPickInProgressRef.current = false;
  };

  const uploadPhoto = async (scoutId: string, photo: File, scoutNameForFile?: string): Promise<string | null> => {
    const ext = photo.name.split('.').pop() || 'jpg';
    // Use scout name as filename: normalize accents, replace spaces with underscores
    const safeName = (scoutNameForFile || scoutId)
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_\-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    const path = `${safeName}_${scoutId.slice(0, 8)}.${ext}`;
    // Remove old file if exists (different name pattern)
    const { data: existingFiles } = await supabase.storage.from('scout-photos').list('', { search: scoutId.slice(0, 8) });
    if (existingFiles) {
      for (const f of existingFiles) {
        if (f.name.includes(scoutId.slice(0, 8)) && f.name !== path) {
          await supabase.storage.from('scout-photos').remove([f.name]);
        }
      }
    }
    const compressed = await compressScoutPhoto(photo);
    const { error } = await supabase.storage.from('scout-photos').upload(path, compressed, { upsert: true, contentType: compressed.type });
    if (error) { console.error('Upload error:', error); return null; }
    // Always store the storage path (not a signed URL) — signed URLs expire in 1h
    return path;
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
      registration_id: scoutRegistrationId,
      phone: scoutPhone,
      section: scoutSection,
      transition_date: scoutTransitionDate || null,
    }).select('id').single();

    if (error) {
      toast.error('Erro ao cadastrar: ' + error.message);
      setUploading(false);
      return;
    }

    if (scoutPhoto && data) {
      const photoUrl = await uploadPhoto(data.id, scoutPhoto, scoutName);
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
    setScoutRegistrationId(''); setScoutPhone(''); setScoutSection(''); setScoutTransitionDate('');
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
    setEditRegistrationId(scout.registration_id ? scout.registration_id.padStart(5, '0') : '');
    setEditPhone(scout.phone || '');
    setEditSection(scout.section || '');
    setEditTransitionDate(scout.transition_date || '');
    const branchKey = scout.manual_branch || '';
    const knownSections = branchKey ? [...new Set(scouts.filter(s => (s.manual_branch || '') === branchKey && s.section).map(s => s.section))] : [];
    setCustomSectionMode(!!scout.section && !knownSections.includes(scout.section));
    setEditPhoto(null);
    setEditDialogOpen(true);

    // Resolve signed URL for preview only — never auto-clear photo_url on transient failures
    if (scout.photo_url) {
      getSignedPhotoUrl(scout.photo_url).then(signedUrl => {
        setEditPhotoPreview(signedUrl);
      });
    } else {
      setEditPhotoPreview(null);
    }
  };

  const renamePhotoInStorage = async (scoutId: string, newName: string, currentPhotoUrl: string): Promise<string | null> => {
    try {
      const idPrefix = scoutId.slice(0, 8);
      // Build new filename
      const ext = currentPhotoUrl.split('.').pop()?.split('?')[0] || 'jpg';
      const safeName = newName
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_\-]/g, '_')
        .replace(/_+/g, '_')
        .replace(/^_|_$/g, '');
      const newPath = `${safeName}_${idPrefix}.${ext}`;

      // Find old file
      const { data: files } = await supabase.storage.from('scout-photos').list('', { search: idPrefix });
      const oldFile = files?.find(f => f.name.includes(idPrefix));
      if (!oldFile || oldFile.name === newPath) return null; // already correct or not found

      // Download old file, upload with new name, delete old
      const { data: downloaded } = await supabase.storage.from('scout-photos').download(oldFile.name);
      if (!downloaded) return null;

      await supabase.storage.from('scout-photos').upload(newPath, downloaded, { upsert: true });
      await supabase.storage.from('scout-photos').remove([oldFile.name]);

      // Store the storage path, not a signed URL
      return newPath;
    } catch (err) {
      console.error('Error renaming photo in storage:', err);
      return null;
    }
  };

  const handleEditScout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingScout) return;
    setEditUploading(true);

    let photoUrl = editingScout.photo_url;
    if (editPhoto) {
      const uploaded = await uploadPhoto(editingScout.id, editPhoto, editName);
      if (uploaded) photoUrl = uploaded;
    } else if (photoUrl && editName !== editingScout.name) {
      // Name changed but no new photo — rename file in storage
      const renamed = await renamePhotoInStorage(editingScout.id, editName, photoUrl);
      if (renamed) photoUrl = renamed;
    }

    const { error } = await supabase.from('scouts').update({
      name: editName,
      birth_date: editBirth,
      scout_group: editGroup,
      notes: editNotes,
      photo_url: photoUrl,
      manual_branch: editBranch !== 'auto' ? editBranch : null,
      subgroup_id: editSubgroup !== 'none' ? editSubgroup : null,
      registration_id: editRegistrationId,
      phone: editPhone,
      section: editSection,
      transition_date: editTransitionDate || null,
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
      return ALL_CATEGORIES.find(b => b.key === scout.manual_branch) || getCurrentBranch(parseLocalDate(scout.birth_date));
    }
    return getCurrentBranch(parseLocalDate(scout.birth_date));
  };

  const branchOrder = ALL_CATEGORIES.map(b => b.key);

  const filteredScouts = scouts.filter(s => {
    // Status filter
    if (statusFilter === 'active' && !s.is_active) return false;
    if (statusFilter === 'inactive' && s.is_active) return false;

    const term = search.toLowerCase();
    const subgroupName = s.subgroup_id ? subgroups.find(sg => sg.id === s.subgroup_id)?.name || '' : '';
    const matchSearch = s.name.toLowerCase().includes(term) ||
      (s.section || '').toLowerCase().includes(term) ||
      subgroupName.toLowerCase().includes(term);
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

  const activeScouts = scouts.filter(s => s.is_active);
  const inactiveScouts = scouts.filter(s => !s.is_active);

  const branchCounts = activeScouts.reduce((acc, s) => {
    const branch = getEffectiveBranch(s);
    if (branch) acc[branch.key] = (acc[branch.key] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleToggleActive = async (scout: Scout) => {
    const newStatus = !scout.is_active;
    const { error } = await supabase.from('scouts').update({ is_active: newStatus }).eq('id', scout.id);
    if (error) {
      toast.error('Erro ao alterar status: ' + error.message);
      return;
    }
    if (user) {
      await logAudit(user.id, 'status_change', undefined, {
        target_id: scout.id,
        target_name: scout.name,
      }, { is_active: scout.is_active }, { is_active: newStatus });
    }
    toast.success(newStatus ? `${scout.name} reativado!` : `${scout.name} desativado.`);
    fetchData();
  };

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
      toast.error('Erro ao criar equipe: ' + error.message);
      return null;
    }
    if (data) {
      toast.success('Equipe criada!');
      setNewSubgroupName('');
      setSubgroups(prev => [...prev, data as Subgroup]);
      return data.id;
    }
    return null;
  };

  const handleExportPDF = async () => {
    const jsPDFModule = await import('jspdf');
    const jsPDF = jsPDFModule.default;
    const autoTableModule = await import('jspdf-autotable');
    const autoTable = autoTableModule.default;

    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
    const filterLabel = branchFilter === 'all' ? 'Todos' : ALL_CATEGORIES.find(b => b.key === branchFilter)?.name || branchFilter;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Load logo
    let logoBase64: string | null = null;
    try {
      const logoResponse = await fetch('/images/logo-grupo.png');
      const logoBlob = await logoResponse.blob();
      logoBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(logoBlob);
      });
    } catch (e) {
      console.warn('Logo não carregado:', e);
    }

    const drawHeader = (pageDoc: any) => {
      if (logoBase64) {
        pageDoc.addImage(logoBase64, 'PNG', 14, 5, 20, 20);
      }
      pageDoc.setFontSize(18);
      pageDoc.setFont('helvetica', 'bold');
      pageDoc.setTextColor(30, 60, 35);
      pageDoc.text(`Integrantes - ${filterLabel} (${filteredScouts.length})`, 38, 14);
      pageDoc.setFontSize(11);
      pageDoc.setFont('helvetica', 'normal');
      pageDoc.setTextColor(60);
      pageDoc.text('12º Grupo Escoteiro Monte Caburaí - 12GEMC', 38, 20);
      pageDoc.setFontSize(9);
      pageDoc.setTextColor(120);
      pageDoc.text(`Exportado em ${new Date().toLocaleDateString('pt-BR')}`, 38, 25);
      pageDoc.setTextColor(0);
    };

    drawHeader(doc);

    const isVoluntario = branchFilter === 'voluntario';
    const headers = isVoluntario
      ? ['ID', 'Nome', 'Ramo', 'Seção', '1ª Função', '2ª Função', 'Celular', 'Data Nasc.', 'Idade']
      : ['ID', 'Nome', 'Ramo', 'Seção', 'Equipe', 'Celular', 'Data Nasc.', 'Idade', 'Responsável'];
    const rows = filteredScouts.map(scout => {
      const branch = getEffectiveBranch(scout);
      const sg = subgroups.find(s => s.id === scout.subgroup_id);
      const scoutGuards = getGuardiansForScout(scout.id);
      const responsavel = scoutGuards.map(g => g.name.toUpperCase()).join('; ') || '';
      if (isVoluntario) {
        const { secao, cargo1, cargo2 } = parseVolunteerSection(scout.section);
        return [
          scout.registration_id || '',
          scout.name.toUpperCase(),
          branch?.name || '',
          secao,
          cargo1,
          cargo2,
          scout.phone || '',
          parseLocalDate(scout.birth_date).toLocaleDateString('pt-BR'),
          formatAge(parseLocalDate(scout.birth_date)),
        ];
      }
      return [
        scout.registration_id || '',
        scout.name.toUpperCase(),
        branch?.name || '',
        scout.section || '',
        sg?.name || '',
        scout.phone || '',
        parseLocalDate(scout.birth_date).toLocaleDateString('pt-BR'),
        formatAge(parseLocalDate(scout.birth_date)),
        responsavel,
      ];
    });

    autoTable(doc, {
      head: [headers],
      body: rows,
      startY: 30,
      styles: { fontSize: 8, cellPadding: 2, textColor: [20, 20, 20] },
      headStyles: { fillColor: [45, 80, 50], textColor: 255, fontStyle: 'bold', fontSize: 8 },
      alternateRowStyles: { fillColor: [245, 245, 240] },
      margin: { top: 30 },
      didDrawPage: (data: any) => {
        // Draw header on every new page (except first, already drawn)
        if (data.pageNumber > 1) {
          drawHeader(doc);
        }
        // Page number footer
        const totalPages = doc.getNumberOfPages();
        doc.setFontSize(9);
        doc.setTextColor(120);
        doc.text(
          `Página ${data.pageNumber} de ${totalPages}`,
          pageWidth / 2,
          pageHeight - 8,
          { align: 'center' }
        );
      },
    });

    // Fix page numbers (totalPages is only accurate after all pages are drawn)
    const totalPages = doc.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(120);
      // White rect to clear previous footer text
      doc.setFillColor(255, 255, 255);
      doc.rect(0, pageHeight - 14, pageWidth, 14, 'F');
      doc.text(
        `Página ${i} de ${totalPages}`,
        pageWidth / 2,
        pageHeight - 8,
        { align: 'center' }
      );
    }

    doc.save(`integrantes_${filterLabel.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.pdf`);
    toast.success(`${filteredScouts.length} integrantes exportados em PDF!`);
  };

  const handleExportExcel = async () => {
    const XLSX = await import('xlsx');
    const filterLabel = branchFilter === 'all' ? 'Todos' : ALL_CATEGORIES.find(b => b.key === branchFilter)?.name || branchFilter;

    const isVoluntario = branchFilter === 'voluntario';
    const rows = filteredScouts.map(scout => {
      const branch = getEffectiveBranch(scout);
      const sg = subgroups.find(s => s.id === scout.subgroup_id);
      const scoutGuards = getGuardiansForScout(scout.id);
      const responsavel = scoutGuards.map(g => g.name.toUpperCase()).join('; ') || '';
      if (isVoluntario) {
        const { secao, cargo1, cargo2 } = parseVolunteerSection(scout.section);
        return {
          'ID': scout.registration_id || '',
          'Nome': scout.name.toUpperCase(),
          'Ramo': branch?.name || '',
          'Seção': secao,
          '1ª Função': cargo1,
          '2ª Função': cargo2,
          'Celular': scout.phone || '',
          'Data de Nascimento': parseLocalDate(scout.birth_date).toLocaleDateString('pt-BR'),
          'Idade': formatAge(parseLocalDate(scout.birth_date)),
        };
      }
      return {
        'ID': scout.registration_id || '',
        'Nome': scout.name.toUpperCase(),
        'Ramo': branch?.name || '',
        'Seção': scout.section || '',
        'Equipe': sg?.name || '',
        'Celular': scout.phone || '',
        'Data de Nascimento': parseLocalDate(scout.birth_date).toLocaleDateString('pt-BR'),
        'Idade': formatAge(parseLocalDate(scout.birth_date)),
        'Responsável': responsavel,
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const colWidths = isVoluntario
      ? [10, 30, 12, 14, 30, 30, 16, 16, 14]
      : [10, 30, 12, 18, 18, 16, 16, 14, 30];
    ws['!cols'] = colWidths.map(w => ({ wch: w }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, filterLabel);
    XLSX.writeFile(wb, `integrantes_${filterLabel.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(`${filteredScouts.length} integrantes exportados em Excel!`);
  };

  const renderScoutForm = (
    onSubmit: (e: React.FormEvent) => Promise<void>,
    name: string, setName: (v: string) => void,
    birth: string, setBirth: (v: string) => void,
    notes: string, setNotes: (v: string) => void,
    photoPreview: string | null,
    onPhotoSelect: (e: React.ChangeEvent<HTMLInputElement>) => void,
    isUploading: boolean,
    submitLabel: string,
    photoInputId: string,
    branchOverride: string, setBranchOverride: (v: string) => void,
    subgroupId: string, setSubgroupId: (v: string) => void,
    formTarget: 'new' | 'edit',
    registrationId: string, setRegistrationId: (v: string) => void,
    phoneVal: string, setPhoneVal: (v: string) => void,
    sectionVal: string, setSectionVal: (v: string) => void,
    transitionDate: string, setTransitionDate: (v: string) => void,
    guardianFields?: {
      name: string; setName: (v: string) => void;
      email: string; setEmail: (v: string) => void;
      phone: string; setPhone: (v: string) => void;
      auth: boolean; setAuth: (v: boolean) => void;
    },
  ) => {
    const detectedBranch = birth ? getCurrentBranch(parseLocalDate(birth)) : null;
    const effectiveBranch = branchOverride !== 'auto' 
      ? ALL_CATEGORIES.find(b => b.key === branchOverride) 
      : detectedBranch;
    const effectiveBranchKey = effectiveBranch?.key || '';
    const filteredSubgroups = subgroups.filter(sg => sg.branch_key === effectiveBranchKey);
    const sectionsForBranch = effectiveBranchKey
      ? [...new Set(scouts.filter(s => (s.manual_branch || '') === effectiveBranchKey && s.section).map(s => s.section))].sort()
      : [];
    const isMinor = birth ? (calculateAge(parseLocalDate(birth)).years < 18) : false;

    // Determine if transition date field should show
    const nextBranchChange = birth ? getNextBranchChange(parseLocalDate(birth)) : null;
    const ageBranch = birth ? getCurrentBranch(parseLocalDate(birth)) : null;
    const currentBranchIdx = effectiveBranch ? SCOUT_BRANCHES.findIndex(b => b.key === effectiveBranch.key) : -1;
    const ageBranchIdx = ageBranch ? SCOUT_BRANCHES.findIndex(b => b.key === ageBranch.key) : -1;
    const needsTransition = birth && effectiveBranchKey !== 'voluntario' && (
      (nextBranchChange && nextBranchChange.monthsLeft <= 0 && nextBranchChange.daysLeft <= 0) ||
      (ageBranchIdx > currentBranchIdx && currentBranchIdx >= 0)
    );
    // Also keep showing when transitionDate is already filled (branch was overridden)
    const showTransitionDate = needsTransition || (!!transitionDate && birth && effectiveBranchKey !== 'voluntario');

    const nextBranch = showTransitionDate
      ? (transitionDate && effectiveBranch ? effectiveBranch : (ageBranchIdx > currentBranchIdx ? ageBranch : (nextBranchChange ? nextBranchChange.branch : null)))
      : null;

    return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="flex flex-col items-center gap-3">
        <div className="relative">
          <label htmlFor={photoInputId} className="cursor-pointer">
            <div className="relative h-24 w-24 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center overflow-hidden hover:border-primary transition-colors">
              {photoPreview ? (
                <img src={photoPreview} alt="Preview" className="h-full w-full object-cover rounded-full" />
              ) : (
                <Camera className="h-6 w-6 text-muted-foreground" />
              )}
            </div>
          </label>
          {photoPreview && (
            <button
              type="button"
              className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shadow-sm hover:bg-destructive/90 transition-colors"
              onClick={() => {
                if (formTarget === 'new') {
                  setScoutPhoto(null);
                  setScoutPhotoPreview(null);
                } else {
                  setEditPhoto(null);
                  setEditPhotoPreview(null);
                  if (editingScout) {
                    setEditingScout({ ...editingScout, photo_url: null });
                  }
                }
              }}
              title="Remover foto"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <input id={photoInputId} type="file" accept="image/*" className="hidden" onChange={onPhotoSelect} />
        <input id={`${photoInputId}-camera`} type="file" accept="image/*" capture="environment" className="hidden" onChange={onPhotoSelect} />
        <span className="text-xs text-muted-foreground">Toque para adicionar foto</span>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => document.getElementById(`${photoInputId}-camera`)?.click()}
          >
            <Camera className="h-4 w-4" />
            Câmera
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              setCloudPickerTarget(formTarget);
              setCloudPickerOpen(true);
            }}
          >
            <Cloud className="h-4 w-4" />
            Galeria da Nuvem
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-[120px_1fr] gap-4">
        <div className="space-y-2">
          <Label>ID</Label>
          <Input value={registrationId} readOnly placeholder="Auto" className="h-11 bg-muted/50 font-mono text-center" />
        </div>
        <div className="space-y-2">
          <Label>Nome completo *</Label>
          <Input value={name} onChange={e => setName(e.target.value.toUpperCase())} required placeholder="Nome completo" className="h-11 uppercase" />
        </div>
      </div>
      <div className="space-y-2">
        <Label>Celular</Label>
        <Input value={phoneVal} onChange={e => {
          const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
          let formatted = digits;
          if (digits.length > 2) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
          if (digits.length > 7) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
          setPhoneVal(formatted);
        }} placeholder="(00) 00000-0000" className="h-11" inputMode="tel" />
      </div>
      <div className="space-y-2">
        <Label>Data de nascimento *</Label>
        <Input type="date" value={birth} onChange={e => setBirth(e.target.value)} required className="h-11" />
      </div>
      <div className="space-y-2">
        <Label>Ramo</Label>
        <Select value={branchOverride} onValueChange={v => { setBranchOverride(v); setCustomSectionMode(false); }}>
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
        {(() => {
          if (!birth || branchOverride === 'auto' || branchOverride === 'voluntario') return null;
          const selectedBranchInfo = SCOUT_BRANCHES.find(b => b.key === branchOverride);
          if (!selectedBranchInfo) return null;
          const ageInMonths = Math.floor((new Date().getTime() - parseLocalDate(birth).getTime()) / (1000 * 60 * 60 * 24 * 30.44));
          const expectedBranch = getCurrentBranch(parseLocalDate(birth));
          if (expectedBranch && expectedBranch.key === branchOverride) return null;
          const minYears = (selectedBranchInfo.minAge / 12).toFixed(1).replace('.0', '');
          const maxYears = (selectedBranchInfo.maxAge / 12).toFixed(1).replace('.0', '');
          return (
            <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-950/40 p-3 flex items-start gap-2">
              <span className="text-amber-600 dark:text-amber-400 mt-0.5">⚠️</span>
              <div className="text-xs text-amber-700 dark:text-amber-300">
                <p className="font-semibold">Idade não corresponde ao ramo selecionado</p>
                <p>A idade deste integrante ({formatAge(parseLocalDate(birth))}) não está na faixa etária do ramo {selectedBranchInfo.icon} {selectedBranchInfo.name} ({minYears} a {maxYears} anos).
                  {expectedBranch && <> O ramo esperado por idade é <strong>{expectedBranch.icon} {expectedBranch.name}</strong>.</>}
                  {!expectedBranch && <> Nenhum ramo juvenil corresponde a esta idade.</>}
                </p>
              </div>
            </div>
          );
        })()}
      </div>
      {showTransitionDate && nextBranch && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3 space-y-2">
          <div className="flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <Label className="text-sm font-semibold text-amber-700 dark:text-amber-300">
              Passagem para {nextBranch.icon} {nextBranch.name}
            </Label>
          </div>
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Integrante atingiu a idade para o próximo ramo. Informe a data da passagem para confirmar a transição.
          </p>
          <Input
            type="date"
            value={transitionDate}
            onChange={e => {
              setTransitionDate(e.target.value);
              if (e.target.value) {
                setBranchOverride(nextBranch.key);
              }
            }}
            className="h-11"
          />
          {transitionDate && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                setTransitionDate('');
                setBranchOverride('auto');
              }}
            >
              <X className="h-3 w-3 mr-1" /> Cancelar passagem
            </Button>
          )}
        </div>
      )}
      {effectiveBranchKey === 'voluntario' ? (() => {
        const parsed = parseVolunteerSection(sectionVal);
        const updateVolunteerSection = (secao: string, cargo1: string, cargo2: string) => {
          setSectionVal(buildVolunteerSection(secao, cargo1, cargo2));
        };
        const renderCargoSelect = (label: string, value: string, onChange: (v: string) => void) => (
          <div className="space-y-2">
            <Label>{label}</Label>
            <Select value={value || '__none__'} onValueChange={v => onChange(v === '__none__' ? '' : v)}>
              <SelectTrigger className="h-11">
                <SelectValue placeholder={`Selecione ${label.toLowerCase()}`} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nenhum</SelectItem>
                {Object.entries(VOLUNTEER_CARGO_CATEGORIES)
                  .filter(([, items]) => items.length > 0)
                  .map(([cat, items]) => (
                    <SelectGroup key={cat}>
                      <SelectLabel className="text-xs font-semibold text-muted-foreground px-2 py-1.5">{cat}</SelectLabel>
                      {items.map(c => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectGroup>
                  ))}
              </SelectContent>
            </Select>
          </div>
        );
        return (
          <>
            <div className="space-y-2">
              <Label>Seção</Label>
              <Select value={parsed.secao || '__none__'} onValueChange={v => {
                updateVolunteerSection(v === '__none__' ? '' : v, parsed.cargo1, parsed.cargo2);
              }}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Selecione a seção" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Nenhuma</SelectItem>
                  {VOLUNTEER_SECTIONS.map(s => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {renderCargoSelect('Cargo (1ª Função)', parsed.cargo1, (v) => {
              updateVolunteerSection(parsed.secao, v, parsed.cargo2);
            })}
            {renderCargoSelect('Cargo (2ª Função)', parsed.cargo2, (v) => {
              updateVolunteerSection(parsed.secao, parsed.cargo1, v);
            })}
          </>
        );
      })() : (
      <div className="space-y-2">
        <Label>Seção</Label>
        {sectionsForBranch.length > 0 && !customSectionMode ? (
          <Select value={sectionVal || '__none__'} onValueChange={v => {
            if (v === '__custom__') {
              setCustomSectionMode(true);
              setSectionVal('');
            } else {
              setSectionVal(v === '__none__' ? '' : v);
            }
          }}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Selecione a seção" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__none__">Nenhuma</SelectItem>
              {sectionsForBranch.map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
              <SelectItem value="__custom__">✏️ Digitar outra...</SelectItem>
            </SelectContent>
          </Select>
        ) : (
          <div className="flex gap-2">
            <Input value={sectionVal} onChange={e => setSectionVal(e.target.value)} placeholder="Digite o nome da seção" className="h-11 flex-1" autoFocus={customSectionMode} />
            {sectionsForBranch.length > 0 && (
              <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" onClick={() => { setCustomSectionMode(false); setSectionVal(''); }} title="Voltar para lista">
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        )}
        {effectiveBranchKey && (
          <div className="flex gap-2">
            <Input
              value={newSectionName}
              onChange={e => setNewSectionName(e.target.value)}
              placeholder="Nova seção..."
              className="h-9 text-sm"
            />
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-9 px-3 text-sm whitespace-nowrap"
              disabled={!newSectionName.trim()}
              onClick={() => {
                setSectionVal(newSectionName.trim());
                setNewSectionName('');
                setCustomSectionMode(false);
              }}
            >
              <Plus className="h-3 w-3 mr-1" /> Criar
            </Button>
          </div>
        )}
      </div>
      )}
      {effectiveBranchKey && (
        <div className="space-y-2">
          <Label>Equipe</Label>
          <Select value={subgroupId} onValueChange={setSubgroupId}>
            <SelectTrigger className="h-11">
              <SelectValue placeholder="Selecione a equipe" />
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
              placeholder="Nova equipe..."
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
          <p className="text-sm font-medium">Idade: {formatAge(parseLocalDate(birth))}</p>
          {effectiveBranch && (
            <p className="text-sm text-muted-foreground">
              Ramo: {effectiveBranch.icon} {effectiveBranch.name}
              {branchOverride === 'auto' && ' (automático)'}
            </p>
          )}
          {branchOverride === 'auto' && getNextBranchChange(parseLocalDate(birth)) && (
            <p className="text-sm text-muted-foreground">
              Mudança para {getNextBranchChange(parseLocalDate(birth))!.branch.name}: {formatTimeLeft(getNextBranchChange(parseLocalDate(birth))!.monthsLeft, getNextBranchChange(parseLocalDate(birth))!.daysLeft)}
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
            <Input value={guardianFields.name} onChange={e => guardianFields.setName(e.target.value.toUpperCase())} placeholder="Nome completo do responsável" className="h-10 uppercase" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label className="text-xs">E-mail</Label>
              <Input type="email" value={guardianFields.email} onChange={e => guardianFields.setEmail(e.target.value)} placeholder="email@exemplo.com" className="h-10" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs">Telefone</Label>
              <Input value={guardianFields.phone} onChange={e => {
                const digits = e.target.value.replace(/\D/g, '').slice(0, 11);
                let formatted = digits;
                if (digits.length > 2) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
                if (digits.length > 7) formatted = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
                guardianFields.setPhone(formatted);
              }} placeholder="(00) 00000-0000" className="h-10" inputMode="tel" />
            </div>
          </div>
          <div className="rounded-lg border bg-muted/50 p-2">
            <p className="text-xs leading-snug text-muted-foreground">
              Uso de imagem está de acordo com o "Termo de Autorização de Uso de Imagem (Paxtu)". Registro escoteiro (ficha de associado/Paxtu).
            </p>
          </div>
        </div>
      )}
      <Button type="submit" className="w-full h-11 font-semibold" disabled={isUploading}>
        {isUploading ? 'Salvando...' : submitLabel}
      </Button>
    </form>
  );};

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Integrantes</h1>
          <p className="mt-1 text-muted-foreground">
            {activeScouts.length} ativos
            {inactiveScouts.length > 0 && ` · ${inactiveScouts.length} inativos`}
          </p>
        </div>
        {(canManageScouts || canEditScouts) && (
          <Dialog open={dialogOpen} onOpenChange={v => {
              setDialogOpen(v);
              if (v) {
                setCustomSectionMode(false);
                // Auto-generate next registration_id
                const existingIds = scouts
                  .map(s => parseInt(s.registration_id, 10))
                  .filter(n => !isNaN(n));
                const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
                setScoutRegistrationId(String(nextId).padStart(5, '0'));
              }
            }}>
            <DialogTrigger asChild>
              <Button className="gap-2 shadow-sm">
                <Plus className="h-4 w-4" />
                Novo Integrante
              </Button>
            </DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Cadastrar Membro</DialogTitle>
              </DialogHeader>
              {renderScoutForm(
                handleCreateScout,
                scoutName, setScoutName,
                scoutBirth, setScoutBirth,
                scoutNotes, setScoutNotes,
                scoutPhotoPreview,
                handlePhotoSelect,
                uploading,
                'Cadastrar',
                'scout-photo-create',
                scoutBranch, setScoutBranch,
                scoutSubgroup, setScoutSubgroup,
                'new',
                scoutRegistrationId, setScoutRegistrationId,
                scoutPhone, setScoutPhone,
                scoutSection, setScoutSection,
                scoutTransitionDate, setScoutTransitionDate,
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

      {/* Status filter */}
      <div className="mb-4 flex gap-2 min-h-[36px]">
        <Button
          variant={statusFilter === 'active' ? 'default' : 'outline'}
          size="sm"
          className="gap-1.5"
          onClick={() => setStatusFilter('active')}
        >
          <UserCheck className="h-3.5 w-3.5" />
          Ativos ({activeScouts.length})
        </Button>
        <Button
          variant={statusFilter === 'inactive' ? 'default' : 'outline'}
          size="sm"
          className="gap-1.5"
          onClick={() => setStatusFilter('inactive')}
        >
          <UserX className="h-3.5 w-3.5" />
          Inativos ({inactiveScouts.length})
        </Button>
        <Button
          variant={statusFilter === 'all' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setStatusFilter('all')}
        >
          Todos ({scouts.length})
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row min-h-[76px] sm:min-h-[36px]">
        <div className="relative w-full sm:w-auto sm:min-w-[220px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Buscar por nome, seção ou equipe..." value={search} onChange={e => setSearch(e.target.value)} className="h-9 pl-10 text-sm" />
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
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5" disabled={filteredScouts.length === 0}>
                <FileDown className="h-4 w-4" />
                Exportar PDF ({filteredScouts.length})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Exportar PDF</AlertDialogTitle>
                <AlertDialogDescription>
                  Deseja exportar {filteredScouts.length} integrante{filteredScouts.length !== 1 ? 's' : ''} para PDF?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleExportPDF}>Exportar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5" disabled={filteredScouts.length === 0}>
                <FileSpreadsheet className="h-4 w-4" />
                Exportar Excel ({filteredScouts.length})
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Exportar Excel</AlertDialogTitle>
                <AlertDialogDescription>
                  Deseja exportar {filteredScouts.length} integrante{filteredScouts.length !== 1 ? 's' : ''} para Excel?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={handleExportExcel}>Exportar</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3 min-h-[200px]">
          {filteredScouts.map((scout, index) => {
            const branch = getEffectiveBranch(scout);
            const nextChange = getNextBranchChange(parseLocalDate(scout.birth_date));
            const scoutGuardians = getGuardiansForScout(scout.id);
            const isExpanded = expandedScouts.has(scout.id);

            return (
              <motion.div
                key={scout.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.04 }}
              >
                <Card className={`border bg-card shadow-sm hover:shadow-md transition-shadow overflow-hidden ${!scout.is_active ? 'opacity-60' : ''}`}>
                  <CardContent className="p-0">
                    {/* Main row: photo, branch, name, age */}
                    <div className="flex items-center gap-3 p-4">
                      {scout.photo_url ? (
                        <ScoutPhoto
                          photoUrl={scout.photo_url}
                          alt={scout.name}
                          className="h-14 w-14 rounded-full object-cover object-top ring-2 ring-muted flex-shrink-0 cursor-pointer hover:ring-primary transition-all"
                          onClick={async (e) => {
                            e.stopPropagation();
                            if (scout.photo_url) {
                              const signed = await getSignedPhotoUrl(scout.photo_url);
                              if (signed) setViewingPhoto(signed);
                              else toast.error('Foto não disponível');
                            }
                          }}
                          onBroken={() => handleBrokenPhoto(scout.id, document.createElement('img'))}
                          fallback={
                            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-2xl ring-2 ring-muted flex-shrink-0">
                              {branch?.icon || '⚜️'}
                            </div>
                          }
                        />
                      ) : (
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-2xl ring-2 ring-muted flex-shrink-0">
                          {branch?.icon || '⚜️'}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col items-start gap-0.5">
                          <h3
                            className="max-w-full whitespace-normal break-words font-semibold tracking-tight leading-tight cursor-pointer transition-colors hover:text-primary uppercase" style={{ overflowWrap: 'anywhere' }}
                            onClick={(e) => { e.stopPropagation(); setViewingScout(scout); }}
                          >
                            {scout.name}
                          </h3>
                          {scout.registration_id && (
                            <span className="text-xs font-mono text-muted-foreground">#{scout.registration_id}</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{formatAge(parseLocalDate(scout.birth_date))}</p>
                        <div className="mt-1.5 space-y-0.5 text-xs text-muted-foreground">
                          {branch && (
                            <div className="flex items-center gap-1.5">
                              <span className="font-medium text-foreground/70 w-[52px] shrink-0">Ramo:</span>
                              <Badge className={`${branchColorMap[branch.color]} border font-normal text-xs`}>
                                {branch.icon} {branch.name}
                              </Badge>
                            </div>
                          )}
                          {branch?.key === 'voluntario' ? (
                            <>
                              {(() => {
                                const { secao, cargo1, cargo2 } = parseVolunteerSection(scout.section);
                                return (
                                  <>
                                    {secao && (
                                      <div className="flex items-start gap-1.5">
                                        <span className="font-medium text-foreground/70 w-[52px] shrink-0">Seção:</span>
                                        <span>{secao}</span>
                                      </div>
                                    )}
                                    {cargo1 && (
                                      <div className="flex items-start gap-1.5">
                                        <span className="font-medium text-foreground/70 shrink-0 whitespace-nowrap">1ª Função:</span>
                                        <span className="break-words" style={{ overflowWrap: 'anywhere' }}>{cargo1}</span>
                                      </div>
                                    )}
                                    {cargo2 && (
                                      <div className="flex items-start gap-1.5">
                                        <span className="font-medium text-foreground/70 shrink-0 whitespace-nowrap">2ª Função:</span>
                                        <span className="break-words" style={{ overflowWrap: 'anywhere' }}>{cargo2}</span>
                                      </div>
                                    )}
                                  </>
                                );
                              })()}
                            </>
                          ) : (
                            <>
                              {scout.section && (
                                <div className="flex items-center gap-1.5">
                                  <span className="font-medium text-foreground/70 w-[52px] shrink-0">Seção:</span>
                                  <span>{scout.section}</span>
                                </div>
                              )}
                              {scout.subgroup_id && (() => {
                                const sg = subgroups.find(s => s.id === scout.subgroup_id);
                                return sg ? (
                                  <div className="flex items-center gap-1.5">
                                    <span className="font-medium text-foreground/70 w-[52px] shrink-0">Equipe:</span>
                                    <Badge variant="secondary" className="font-normal text-xs">{sg.name}</Badge>
                                  </div>
                                ) : null;
                              })()}
                            </>
                          )}
                          {!scout.is_active && (
                            <Badge variant="destructive" className="font-normal text-xs mt-1">Inativo</Badge>
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
                              const ageInYears = calculateAge(parseLocalDate(scout.birth_date)).years;
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
                                    {(canManageScouts || canEditScouts) && isMinor && (
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
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}

                            {/* Actions: Edit, Activate/Deactivate, Delete */}
                            <div className="flex gap-2 pt-1 flex-wrap">
                              {(canManageScouts || canEditScouts) && (
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
                              {canManageScouts && (
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant={scout.is_active ? 'outline' : 'default'}
                                      size="sm"
                                      className="gap-1.5"
                                    >
                                      <Power className="h-3.5 w-3.5" />
                                      {scout.is_active ? 'Desativar' : 'Reativar'}
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>
                                        {scout.is_active ? `Desativar "${scout.name}"?` : `Reativar "${scout.name}"?`}
                                      </AlertDialogTitle>
                                      <AlertDialogDescription>
                                        {scout.is_active
                                          ? 'O integrante ficará inativo e não aparecerá nas listagens padrão. Dados e histórico serão mantidos.'
                                          : 'O integrante voltará a aparecer nas listagens operacionais.'}
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleToggleActive(scout)}>
                                        {scout.is_active ? 'Desativar' : 'Reativar'}
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              )}
                              {canManageScouts && (
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
                                      <AlertDialogDescription>
                                        Esta ação é irreversível. Considere desativar o integrante ao invés de excluí-lo para manter o histórico.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => handleDeleteScout(scout.id)}>Excluir permanentemente</AlertDialogAction>
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
      <Dialog open={editDialogOpen} onOpenChange={(v) => { if (!v && cropperOpen) return; setEditDialogOpen(v); }}>
        <DialogContent
          className="max-h-[90vh] overflow-y-auto"
          onInteractOutside={(e) => { if (cropperOpen) e.preventDefault(); }}
          onPointerDownOutside={(e) => { if (cropperOpen) e.preventDefault(); }}
          onEscapeKeyDown={(e) => { if (cropperOpen) e.preventDefault(); }}
        >
          <DialogHeader>
            <DialogTitle>Editar Membro</DialogTitle>
          </DialogHeader>
          {renderScoutForm(
            handleEditScout,
            editName, setEditName,
            editBirth, setEditBirth,
            editNotes, setEditNotes,
            editPhotoPreview,
            handleEditPhotoSelect,
            editUploading,
            'Salvar Alterações',
            'scout-photo-edit',
            editBranch, setEditBranch,
            editSubgroup, setEditSubgroup,
            'edit',
            editRegistrationId, setEditRegistrationId,
            editPhone, setEditPhone,
            editSection, setEditSection,
            editTransitionDate, setEditTransitionDate,
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
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-xs leading-snug text-muted-foreground">
                Uso de imagem está de acordo com o "Termo de Autorização de Uso de Imagem (Paxtu)". Registro escoteiro (ficha de associado/Paxtu).
              </p>
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

      <CloudPhotoPickerDialog
        open={cloudPickerOpen}
        onClose={() => setCloudPickerOpen(false)}
        onSelect={(file) => {
          setCropperImage(URL.createObjectURL(file));
          setCropperTarget(cloudPickerTarget);
          setCropperOpen(true);
          setCloudPickerOpen(false);
        }}
      />

      {/* Scout detail viewer dialog */}
      <Dialog open={!!viewingScout} onOpenChange={() => setViewingScout(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Dados do Integrante</DialogTitle>
          </DialogHeader>
          {viewingScout && (() => {
            const branch = getCurrentBranch(parseLocalDate(viewingScout.birth_date));
            const nextChange = getNextBranchChange(parseLocalDate(viewingScout.birth_date));
            const scoutGuardians = getGuardiansForScout(viewingScout.id);
            const ageInYears = calculateAge(parseLocalDate(viewingScout.birth_date)).years;
            return (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  {viewingScout.photo_url ? (
                    <ScoutPhoto
                      photoUrl={viewingScout.photo_url}
                      alt={viewingScout.name}
                      className="h-20 w-20 rounded-full object-cover object-top ring-2 ring-muted cursor-pointer hover:ring-primary transition-all"
                      onBroken={() => handleBrokenPhoto(viewingScout.id, document.createElement('img'))}
                      fallback={
                        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-3xl ring-2 ring-muted">
                          {branch?.icon || '⚜️'}
                        </div>
                      }
                    />
                  ) : (
                    <div className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-3xl ring-2 ring-muted">
                      {branch?.icon || '⚜️'}
                    </div>
                  )}
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold uppercase">{viewingScout.name}</h3>
                      {viewingScout.registration_id && (
                        <span className="text-xs text-muted-foreground font-mono">#{viewingScout.registration_id}</span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{formatAge(parseLocalDate(viewingScout.birth_date))}</p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {branch && (
                        <Badge className={`${branchColorMap[branch.color]} border font-normal text-xs`}>
                          {branch.icon} {branch.name}
                        </Badge>
                      )}
                      {viewingScout.section && (
                        <Badge variant="outline" className="font-normal text-xs">{viewingScout.section}</Badge>
                      )}
                      {viewingScout.scout_group && (
                        <Badge variant="outline" className="font-normal text-xs">{viewingScout.scout_group}</Badge>
                      )}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 text-sm">
                  {viewingScout.registration_id && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">ID do Associado</span>
                      <span className="font-medium font-mono">{viewingScout.registration_id}</span>
                    </div>
                  )}
                  {viewingScout.phone && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Celular</span>
                      <span className="font-medium">{viewingScout.phone}</span>
                    </div>
                  )}
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Data de nascimento</span>
                    <span className="font-medium">
                      {parseLocalDate(viewingScout.birth_date).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  {viewingScout.scout_group && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Grupo Escoteiro</span>
                      <span className="font-medium">{viewingScout.scout_group}</span>
                    </div>
                  )}
                  {viewingScout.section && (
                    <div className="flex justify-between py-2 border-b">
                      <span className="text-muted-foreground">Seção</span>
                      <span className="font-medium">{viewingScout.section}</span>
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
                alt="Foto do integrante"
                className="w-full h-auto rounded-lg object-contain max-h-[75vh]"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.style.display = 'none';
                  const fallback = target.nextElementSibling as HTMLElement;
                  if (fallback) fallback.style.display = 'flex';
                }}
              />
              <div className="hidden flex-col items-center justify-center py-16 text-muted-foreground">
                <ImageIcon className="h-16 w-16 mb-3 opacity-40" />
                <p className="text-sm font-medium">Foto não disponível</p>
                <p className="text-xs mt-1">A imagem foi removida do armazenamento</p>
              </div>
              <div className="flex justify-center mt-3 pb-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const response = await fetch(viewingPhoto);
                      if (!response.ok) throw new Error('Not found');
                      const blob = await response.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = 'foto-escoteiro.jpg';
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch {
                      toast.error('Foto não disponível para download');
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
    </>
  );
};

export default Scouts;
