import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import {
  Upload, Search, FolderOpen, FileText, FileSpreadsheet, FileImage, FileArchive,
  File as FileIcon, Download, Trash2, Shield, Loader2, ChevronRight, Home,
  FolderPlus, Pencil,
} from 'lucide-react';
import { ROLE_LABELS } from '@/lib/userRoles';
import type { Database } from '@/integrations/supabase/types';

type AppRole = Database['public']['Enums']['app_role'];

interface Folder {
  id: string;
  parent_id: string | null;
  name: string;
  category: string | null;
  is_system: boolean;
}

interface Doc {
  id: string;
  folder_id: string | null;
  title: string;
  description: string | null;
  filename: string;
  extension: string | null;
  mime_type: string;
  size_bytes: number;
  storage_path: string;
  category: string | null;
  visibility: string;
  uploaded_by: string | null;
  download_count: number;
  created_at: string;
}

const MAX_SIZE = 25 * 1024 * 1024; // 25MB
const ALLOWED_MIME = /^(application\/(pdf|msword|vnd\.openxmlformats|vnd\.ms-|zip|x-zip|octet-stream)|text\/plain|image\/(jpeg|png|webp))/;

const ROLES_FOR_PERMS: AppRole[] = [
  'admin', 'diretor_presidente', 'diretor_administrativo', 'diretor_financeiro',
  'dirigente_gestor', 'chefe', 'dirigente', 'voluntario', 'assistente', 'parent', 'viewer',
];

const DEFAULT_ROLE_PRESETS: Record<AppRole, boolean> = {
  admin: true, diretor_presidente: true, diretor_administrativo: true, diretor_financeiro: true,
  dirigente_gestor: true, chefe: true, dirigente: true,
  voluntario: false, assistente: false, parent: false, viewer: false,
};

function iconFor(ext: string | null) {
  const e = (ext ?? '').toLowerCase();
  if (['pdf'].includes(e)) return FileText;
  if (['xls', 'xlsx', 'csv'].includes(e)) return FileSpreadsheet;
  if (['jpg', 'jpeg', 'png', 'webp', 'gif'].includes(e)) return FileImage;
  if (['zip', 'rar', '7z'].includes(e)) return FileArchive;
  if (['doc', 'docx', 'txt'].includes(e)) return FileText;
  return FileIcon;
}

function formatSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}

export default function Library() {
  const { user, roles } = useAuth();
  const [folders, setFolders] = useState<Folder[]>([]);
  const [docs, setDocs] = useState<Doc[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadingFile, setUploadingFile] = useState<File | null>(null);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDesc, setUploadDesc] = useState('');
  const [uploadVisibility, setUploadVisibility] = useState<'public' | 'roles' | 'private'>('roles');
  const [uploadRoles, setUploadRoles] = useState<Record<AppRole, boolean>>(DEFAULT_ROLE_PRESETS);
  const [uploading, setUploading] = useState(false);
  const [permsDoc, setPermsDoc] = useState<Doc | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [folderDialogOpen, setFolderDialogOpen] = useState(false);
  const [folderEditing, setFolderEditing] = useState<Folder | null>(null);
  const [folderName, setFolderName] = useState('');
  const [savingFolder, setSavingFolder] = useState(false);

  const canUpload = useMemo(() => {
    if (!roles) return false;
    return roles.some(r => ['admin', 'diretor_presidente', 'diretor_administrativo',
      'diretor_financeiro', 'dirigente_gestor', 'chefe', 'dirigente'].includes(r));
  }, [roles]);

  const isAdmin = roles?.includes('admin') ?? false;

  const load = useCallback(async () => {
    setLoading(true);
    const [fRes, dRes] = await Promise.all([
      supabase.from('document_folders').select('*').order('name'),
      supabase.from('documents').select('*').eq('is_archived', false).order('created_at', { ascending: false }),
    ]);
    if (fRes.error) toast.error('Erro ao carregar pastas');
    if (dRes.error) toast.error('Erro ao carregar documentos');
    setFolders((fRes.data ?? []) as Folder[]);
    setDocs((dRes.data ?? []) as Doc[]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const currentFolder = folders.find(f => f.id === currentFolderId) ?? null;
  const breadcrumb = useMemo(() => {
    const arr: Folder[] = [];
    let cur = currentFolder;
    while (cur) {
      arr.unshift(cur);
      cur = folders.find(f => f.id === cur!.parent_id) ?? null;
    }
    return arr;
  }, [currentFolder, folders]);

  const visibleFolders = folders.filter(f => f.parent_id === currentFolderId);
  const visibleDocs = docs.filter(d => {
    if (d.folder_id !== currentFolderId) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return d.title.toLowerCase().includes(q) || d.filename.toLowerCase().includes(q)
      || (d.description ?? '').toLowerCase().includes(q);
  });

  const onPickFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > MAX_SIZE) {
      toast.error('Arquivo maior que 25 MB');
      return;
    }
    if (!ALLOWED_MIME.test(f.type) && !/\.(pdf|docx?|xlsx?|pptx?|txt|zip|jpg|jpeg|png|webp)$/i.test(f.name)) {
      toast.error('Tipo de arquivo não permitido');
      return;
    }
    setUploadingFile(f);
    setUploadTitle(f.name.replace(/\.[^.]+$/, ''));
    setUploadOpen(true);
  };

  const doUpload = async () => {
    if (!uploadingFile || !user) return;
    setUploading(true);
    try {
      const ext = uploadingFile.name.split('.').pop()?.toLowerCase() ?? '';
      const path = `${user.id}/${Date.now()}_${uploadingFile.name.replace(/[^\w.\-]/g, '_')}`;

      const { error: upErr } = await supabase.storage
        .from('documents')
        .upload(path, uploadingFile, { upsert: false, contentType: uploadingFile.type });
      if (upErr) throw upErr;

      const { data: doc, error: dbErr } = await supabase.from('documents').insert({
        folder_id: currentFolderId,
        title: uploadTitle.trim() || uploadingFile.name,
        description: uploadDesc.trim() || null,
        filename: uploadingFile.name,
        extension: ext,
        mime_type: uploadingFile.type || 'application/octet-stream',
        size_bytes: uploadingFile.size,
        storage_path: path,
        category: currentFolder?.category ?? null,
        visibility: uploadVisibility,
        uploaded_by: user.id,
      }).select().single();
      if (dbErr) throw dbErr;

      if (uploadVisibility === 'roles' && doc) {
        const rows = ROLES_FOR_PERMS
          .filter(r => uploadRoles[r])
          .map(role => ({
            document_id: doc.id,
            role,
            can_view: true,
            can_download: true,
            can_edit: role === 'admin',
            can_delete: role === 'admin',
            can_share: ['admin', 'diretor_presidente', 'chefe'].includes(role),
          }));
        if (rows.length) await supabase.from('document_role_permissions').insert(rows);
      }

      toast.success('Documento enviado');
      setUploadOpen(false);
      setUploadingFile(null);
      setUploadTitle('');
      setUploadDesc('');
      setUploadRoles(DEFAULT_ROLE_PRESETS);
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
    } catch (e: any) {
      toast.error(e.message ?? 'Falha no upload');
    } finally {
      setUploading(false);
    }
  };

  const download = async (d: Doc) => {
    const { data, error } = await supabase.storage.from('documents').createSignedUrl(d.storage_path, 60);
    if (error || !data?.signedUrl) {
      toast.error('Sem permissão para baixar');
      return;
    }
    // Log access
    await supabase.from('document_access_logs').insert({
      document_id: d.id, user_id: user?.id ?? null, action: 'download',
    });
    await supabase.from('documents').update({ download_count: d.download_count + 1 }).eq('id', d.id);
    window.open(data.signedUrl, '_blank');
  };

  const removeDoc = async (d: Doc) => {
    if (!confirm(`Excluir "${d.title}"?`)) return;
    const { error } = await supabase.from('documents').delete().eq('id', d.id);
    if (error) { toast.error('Sem permissão para excluir'); return; }
    await supabase.storage.from('documents').remove([d.storage_path]);
    toast.success('Documento excluído');
    load();
  };

  const openNewFolder = () => { setFolderEditing(null); setFolderName(''); setFolderDialogOpen(true); };
  const openRenameFolder = (f: Folder) => { setFolderEditing(f); setFolderName(f.name); setFolderDialogOpen(true); };

  const saveFolder = async () => {
    const name = folderName.trim();
    if (!name) return;
    setSavingFolder(true);
    try {
      if (folderEditing) {
        const { error } = await supabase.from('document_folders')
          .update({ name }).eq('id', folderEditing.id);
        if (error) throw error;
        toast.success('Pasta renomeada');
      } else {
        const { error } = await supabase.from('document_folders').insert({
          name, parent_id: currentFolderId,
          category: currentFolder?.category ?? null,
          created_by: user?.id ?? null,
        });
        if (error) throw error;
        toast.success('Pasta criada');
      }
      setFolderDialogOpen(false);
      load();
    } catch (e: any) {
      toast.error(e.message ?? 'Sem permissão para salvar a pasta');
    } finally {
      setSavingFolder(false);
    }
  };

  const removeFolder = async (f: Folder) => {
    const hasChildren = folders.some(x => x.parent_id === f.id) || docs.some(d => d.folder_id === f.id);
    if (hasChildren) { toast.error('A pasta não está vazia'); return; }
    if (!confirm(`Excluir a pasta "${f.name}"?`)) return;
    const { error } = await supabase.from('document_folders').delete().eq('id', f.id);
    if (error) { toast.error('Sem permissão para excluir'); return; }
    toast.success('Pasta excluída');
    load();
  };


  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Biblioteca Digital</h1>
          <p className="text-sm text-muted-foreground">Documentos, formulários e materiais escoteiros.</p>
        </div>
        <div className="flex items-center gap-2">
          {canUpload && (
            <Button variant="outline" onClick={openNewFolder}>
              <FolderPlus className="h-4 w-4 mr-2" /> Nova pasta
            </Button>
          )}
          {canUpload && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,.jpg,.jpeg,.png,.webp"
                onChange={(e) => onPickFile(e.target.files?.[0])}
              />
              <Button onClick={() => fileInputRef.current?.click()}>
                <Upload className="h-4 w-4 mr-2" /> Enviar documento
              </Button>
            </>
          )}
        </div>
      </div>


      {/* Breadcrumb */}
      <div className="flex items-center gap-1 text-sm flex-wrap">
        <button className="flex items-center gap-1 hover:underline" onClick={() => setCurrentFolderId(null)}>
          <Home className="h-4 w-4" /> Raiz
        </button>
        {breadcrumb.map(f => (
          <div key={f.id} className="flex items-center gap-1">
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
            <button className="hover:underline" onClick={() => setCurrentFolderId(f.id)}>{f.name}</button>
          </div>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9 h-9"
          placeholder="Buscar por título, arquivo ou descrição..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="space-y-6">
          {visibleFolders.length > 0 && (
            <div>
              <h2 className="text-sm font-semibold mb-2 text-muted-foreground">Pastas</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {visibleFolders.map(f => (
                  <Card
                    key={f.id}
                    className="p-3 cursor-pointer hover:bg-accent transition-colors flex items-center gap-2"
                    onClick={() => setCurrentFolderId(f.id)}
                  >
                    <FolderOpen className="h-5 w-5 text-primary shrink-0" />
                    <span className="font-medium flex-1 min-w-0 truncate" title={f.name}>{f.name}</span>

                    {isAdmin && (
                      <div className="flex items-center shrink-0" onClick={e => e.stopPropagation()}>
                        <Button size="icon" variant="ghost" className="h-8 w-8" title="Renomear"
                          onClick={() => openRenameFolder(f)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {!f.is_system && (
                          <Button size="icon" variant="ghost" className="h-8 w-8" title="Excluir"
                            onClick={() => removeFolder(f)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    )}
                  </Card>

                ))}
              </div>
            </div>
          )}

          <div>
            <h2 className="text-sm font-semibold mb-2 text-muted-foreground">
              Documentos {visibleDocs.length > 0 && `(${visibleDocs.length})`}
            </h2>
            {visibleDocs.length === 0 ? (
              <Card className="p-8 text-center text-muted-foreground">
                Nenhum documento nesta pasta.
              </Card>
            ) : (
              <div className="space-y-2">
                {visibleDocs.map(d => {
                  const Icon = iconFor(d.extension);
                  const canEdit = isAdmin || d.uploaded_by === user?.id;
                  return (
                    <Card key={d.id} className="p-3 flex items-center gap-3">
                      <Icon className="h-8 w-8 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{d.title}</div>
                        <div className="text-xs text-muted-foreground flex flex-wrap gap-2">
                          <span>{d.filename}</span>
                          <span>•</span>
                          <span>{formatSize(d.size_bytes)}</span>
                          <span>•</span>
                          <span>{new Date(d.created_at).toLocaleDateString('pt-BR')}</span>
                          {d.download_count > 0 && (
                            <><span>•</span><span>{d.download_count} downloads</span></>
                          )}
                        </div>
                        {d.description && (
                          <div className="text-xs text-muted-foreground mt-1 line-clamp-2">{d.description}</div>
                        )}
                      </div>
                      <Badge variant="outline" className="hidden sm:inline-flex">
                        {d.visibility === 'public' ? 'Público' : d.visibility === 'private' ? 'Privado' : 'Restrito'}
                      </Badge>
                      <Button size="sm" variant="ghost" onClick={() => download(d)} title="Baixar">
                        <Download className="h-4 w-4" />
                      </Button>
                      {canEdit && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => setPermsDoc(d)} title="Permissões">
                            <Shield className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => removeDoc(d)} title="Excluir">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Upload dialog */}
      <Dialog open={uploadOpen} onOpenChange={(o) => !uploading && setUploadOpen(o)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Enviar documento</DialogTitle>
            <DialogDescription>{uploadingFile?.name} — {uploadingFile && formatSize(uploadingFile.size)}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} className="h-12 text-base" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={uploadDesc} onChange={e => setUploadDesc(e.target.value)} rows={3} />
            </div>
            <div>
              <Label>Visibilidade</Label>
              <Select value={uploadVisibility} onValueChange={(v: any) => setUploadVisibility(v)}>
                <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Público (todos autenticados)</SelectItem>
                  <SelectItem value="roles">Restrito por papel</SelectItem>
                  <SelectItem value="private">Privado (só eu e admins)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {uploadVisibility === 'roles' && (
              <div>
                <Label>Papéis com acesso</Label>
                <div className="grid grid-cols-2 gap-2 mt-2 border rounded p-3 max-h-64 overflow-y-auto">
                  {ROLES_FOR_PERMS.map(role => (
                    <label key={role} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox
                        checked={uploadRoles[role]}
                        onCheckedChange={(c) => setUploadRoles(p => ({ ...p, [role]: !!c }))}
                      />
                      <span>{ROLE_LABELS[role]}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadOpen(false)} disabled={uploading}>Cancelar</Button>
            <Button onClick={doUpload} disabled={uploading || !uploadTitle.trim()}>
              {uploading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Enviando...</> : 'Enviar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder dialog */}
      <Dialog open={folderDialogOpen} onOpenChange={(o) => !savingFolder && setFolderDialogOpen(o)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{folderEditing ? 'Renomear pasta' : 'Nova pasta'}</DialogTitle>
            <DialogDescription>
              {folderEditing ? 'Altere o nome da pasta.' : `Criar em: ${currentFolder?.name ?? 'Raiz'}`}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Nome *</Label>
            <Input
              className="h-12 text-base"
              value={folderName}
              onChange={e => setFolderName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveFolder(); }}
              placeholder="Ex.: Atas 2026"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFolderDialogOpen(false)} disabled={savingFolder}>Cancelar</Button>
            <Button onClick={saveFolder} disabled={savingFolder || !folderName.trim()}>
              {savingFolder ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando...</> : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* Permissions dialog */}
      <DocumentPermissionsDialog
        doc={permsDoc}
        onClose={() => setPermsDoc(null)}
        onSaved={load}
      />
    </div>
  );
}

function DocumentPermissionsDialog({
  doc, onClose, onSaved,
}: { doc: Doc | null; onClose: () => void; onSaved: () => void }) {
  const [rows, setRows] = useState<Array<{ role: AppRole; can_view: boolean; can_download: boolean; can_edit: boolean; can_delete: boolean; can_share: boolean }>>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!doc) return;
    (async () => {
      const { data } = await supabase.from('document_role_permissions').select('*').eq('document_id', doc.id);
      const existing = new Map((data ?? []).map(r => [r.role as AppRole, r]));
      setRows(ROLES_FOR_PERMS.map(role => {
        const r = existing.get(role);
        return {
          role,
          can_view: r?.can_view ?? false,
          can_download: r?.can_download ?? false,
          can_edit: r?.can_edit ?? false,
          can_delete: r?.can_delete ?? false,
          can_share: r?.can_share ?? false,
        };
      }));
    })();
  }, [doc]);

  const save = async () => {
    if (!doc) return;
    setSaving(true);
    try {
      await supabase.from('document_role_permissions').delete().eq('document_id', doc.id);
      const toInsert = rows
        .filter(r => r.can_view || r.can_download || r.can_edit || r.can_delete || r.can_share)
        .map(r => ({ document_id: doc.id, ...r }));
      if (toInsert.length) {
        const { error } = await supabase.from('document_role_permissions').insert(toInsert);
        if (error) throw error;
      }
      toast.success('Permissões atualizadas');
      onSaved();
      onClose();
    } catch (e: any) {
      toast.error(e.message ?? 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={!!doc} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto max-w-2xl">
        <DialogHeader>
          <DialogTitle>Permissões — {doc?.title}</DialogTitle>
          <DialogDescription>Defina quais papéis podem ver, baixar, editar, excluir ou compartilhar.</DialogDescription>
        </DialogHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="text-left py-2">Papel</th>
                <th>Ver</th><th>Baixar</th><th>Editar</th><th>Excluir</th><th>Compartilhar</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.role} className="border-b">
                  <td className="py-2 pr-2">{ROLE_LABELS[r.role]}</td>
                  {(['can_view', 'can_download', 'can_edit', 'can_delete', 'can_share'] as const).map(k => (
                    <td key={k} className="text-center">
                      <Checkbox
                        checked={r[k]}
                        onCheckedChange={(c) => setRows(prev => prev.map((x, idx) => idx === i ? { ...x, [k]: !!c } : x))}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
