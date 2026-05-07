import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Award, Medal, Star, Trophy, Sparkles, Plus, Pencil, Trash2, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate } from '@/lib/scoutUtils';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

type AchievementType = 'especialidade' | 'insignia' | 'distintivo' | 'conquista' | 'outro';

interface Achievement {
  id: string;
  scout_id: string;
  type: AchievementType;
  name: string;
  achievement_date: string;
  description: string;
  created_by: string;
  created_at: string;
}

const TYPE_META: Record<AchievementType, { label: string; icon: typeof Award; color: string; bg: string; ring: string }> = {
  especialidade: { label: 'Especialidade', icon: Star,     color: 'text-amber-600',   bg: 'bg-amber-500/10',   ring: 'border-amber-500' },
  insignia:      { label: 'Insígnia',      icon: Medal,    color: 'text-indigo-600',  bg: 'bg-indigo-500/10',  ring: 'border-indigo-500' },
  distintivo:    { label: 'Distintivo',    icon: Award,    color: 'text-emerald-600', bg: 'bg-emerald-500/10', ring: 'border-emerald-500' },
  conquista:     { label: 'Conquista',     icon: Trophy,   color: 'text-rose-600',    bg: 'bg-rose-500/10',    ring: 'border-rose-500' },
  outro:         { label: 'Outro',         icon: Sparkles, color: 'text-muted-foreground', bg: 'bg-muted',     ring: 'border-border' },
};

const TYPES: AchievementType[] = ['especialidade', 'insignia', 'distintivo', 'conquista', 'outro'];

interface Props { scoutId: string }

const ScoutAchievements = ({ scoutId }: Props) => {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('manage_scouts');

  const [items, setItems] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Achievement | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [type, setType] = useState<AchievementType>('conquista');
  const [name, setName] = useState('');
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('scout_achievements')
      .select('*')
      .eq('scout_id', scoutId)
      .order('achievement_date', { ascending: false });
    if (error) {
      toast.error('Erro ao carregar conquistas');
    } else {
      setItems((data || []) as Achievement[]);
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, [scoutId]);

  const openNew = () => {
    setEditing(null);
    setType('conquista');
    setName('');
    setDate(new Date().toISOString().slice(0, 10));
    setDescription('');
    setOpen(true);
  };

  const openEdit = (a: Achievement) => {
    setEditing(a);
    setType(a.type);
    setName(a.name);
    setDate(a.achievement_date);
    setDescription(a.description || '');
    setOpen(true);
  };

  const handleSave = async () => {
    if (!user) return;
    if (!name.trim()) { toast.error('Informe o nome'); return; }
    setSaving(true);
    const payload = {
      scout_id: scoutId,
      type, name: name.trim(),
      achievement_date: date,
      description: description.trim(),
    };
    const { error } = editing
      ? await supabase.from('scout_achievements').update(payload).eq('id', editing.id)
      : await supabase.from('scout_achievements').insert({ ...payload, created_by: user.id });
    setSaving(false);
    if (error) {
      toast.error(editing ? 'Erro ao atualizar' : 'Erro ao adicionar');
      return;
    }
    toast.success(editing ? 'Conquista atualizada' : 'Conquista adicionada');
    setOpen(false);
    load();
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    const { error } = await supabase.from('scout_achievements').delete().eq('id', deletingId);
    if (error) toast.error('Erro ao excluir');
    else {
      toast.success('Conquista removida');
      load();
    }
    setDeletingId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={openNew}>
            <Plus className="h-4 w-4" /> Nova conquista
          </Button>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          <Trophy className="mx-auto mb-2 h-6 w-6 opacity-60" />
          Nenhuma conquista registrada ainda.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((a) => {
            const meta = TYPE_META[a.type];
            const Icon = meta.icon;
            return (
              <div key={a.id} className="rounded-lg border p-3 flex gap-3 items-start">
                <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2', meta.ring, meta.bg)}>
                  <Icon className={cn('h-5 w-5', meta.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{a.name}</span>
                    <Badge variant="outline" className="text-[10px] font-normal">{meta.label}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {format(parseLocalDate(a.achievement_date), "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                  </p>
                  {a.description && (
                    <p className="text-xs text-foreground/80 mt-1 whitespace-pre-wrap">{a.description}</p>
                  )}
                </div>
                {canManage && (
                  <div className="flex gap-1 shrink-0">
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(a)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeletingId(a.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar conquista' : 'Nova conquista'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as AchievementType)}>
                <SelectTrigger className="h-12 text-base"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{TYPE_META[t].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nome *</Label>
              <Input className="h-12 text-base" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Especialidade de Pioneirias" />
            </div>
            <div>
              <Label>Data *</Label>
              <Input className="h-12 text-base" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Detalhes (opcional)" rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {editing ? 'Salvar' : 'Adicionar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conquista?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ScoutAchievements;
