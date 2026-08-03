import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Search, Plus, Pencil, Trash2, Sparkles, Loader2 } from 'lucide-react';

interface Message {
  id: string;
  text: string;
  author: string;
  category: string;
  is_active: boolean;
  created_at: string;
}

const CATEGORIES = [
  { value: 'bp', label: 'Baden-Powell' },
  { value: 'lei', label: 'Lei Escoteira' },
  { value: 'promessa', label: 'Promessa' },
  { value: 'valores', label: 'Valores' },
  { value: 'lideranca', label: 'Liderança' },
  { value: 'servico', label: 'Serviço' },
  { value: 'natureza', label: 'Natureza' },
  { value: 'amizade', label: 'Amizade' },
  { value: 'equipe', label: 'Trabalho em Equipe' },
  { value: 'cidadania', label: 'Cidadania' },
];

const catLabel = (v: string) => CATEGORIES.find(c => c.value === v)?.label || v;

const MotivationalMessagesManager = () => {
  const [rows, setRows] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Message | null>(null);
  const [form, setForm] = useState({ text: '', author: 'Anônimo', category: 'valores', is_active: true });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('motivational_messages')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) toast.error('Erro ao carregar: ' + error.message);
    setRows((data as Message[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (categoryFilter !== 'all' && r.category !== categoryFilter) return false;
      if (q && !r.text.toLowerCase().includes(q) && !r.author.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [rows, search, categoryFilter]);

  const openCreate = () => {
    setEditing(null);
    setForm({ text: '', author: 'Anônimo', category: 'valores', is_active: true });
    setDialogOpen(true);
  };

  const openEdit = (m: Message) => {
    setEditing(m);
    setForm({ text: m.text, author: m.author, category: m.category, is_active: m.is_active });
    setDialogOpen(true);
  };

  const save = async () => {
    if (!form.text.trim()) return toast.error('Digite a mensagem.');
    setSaving(true);
    if (editing) {
      const { error } = await supabase
        .from('motivational_messages')
        .update({ text: form.text.trim(), author: form.author.trim() || 'Anônimo', category: form.category, is_active: form.is_active })
        .eq('id', editing.id);
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success('Mensagem atualizada.');
    } else {
      const { error } = await supabase
        .from('motivational_messages')
        .insert({ text: form.text.trim(), author: form.author.trim() || 'Anônimo', category: form.category, is_active: form.is_active });
      if (error) { toast.error(error.message); setSaving(false); return; }
      toast.success('Mensagem criada.');
    }
    setSaving(false);
    setDialogOpen(false);
    load();
  };

  const toggleActive = async (m: Message) => {
    const { error } = await supabase
      .from('motivational_messages')
      .update({ is_active: !m.is_active })
      .eq('id', m.id);
    if (error) return toast.error(error.message);
    setRows(prev => prev.map(r => r.id === m.id ? { ...r, is_active: !m.is_active } : r));
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('motivational_messages').delete().eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Removida.');
    setRows(prev => prev.filter(r => r.id !== id));
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2 font-bold">
            <Sparkles className="h-5 w-5" /> Mensagens Motivacionais
          </CardTitle>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Nova Mensagem
          </Button>
        </div>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Pesquisar por texto ou autor..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-full sm:w-56 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <p className="text-xs text-muted-foreground mt-2">{filtered.length} mensagem(ns)</p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mensagem</TableHead>
                  <TableHead>Autor</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Ativa</TableHead>
                  <TableHead className="w-[100px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="max-w-[420px]">
                      <p className="italic text-sm">“{m.text}”</p>
                    </TableCell>
                    <TableCell className="text-sm">{m.author}</TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{catLabel(m.category)}</Badge></TableCell>
                    <TableCell><Switch checked={m.is_active} onCheckedChange={() => toggleActive(m)} /></TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(m)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir mensagem?</AlertDialogTitle>
                              <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => remove(m.id)}>Excluir</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Nenhuma mensagem encontrada.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Editar Mensagem' : 'Nova Mensagem'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div>
              <Label>Texto</Label>
              <Textarea rows={3} value={form.text} onChange={e => setForm({ ...form, text: e.target.value })} />
            </div>
            <div>
              <Label>Autor</Label>
              <Input value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} className="h-12 text-base" />
            </div>
            <div>
              <Label>Categoria</Label>
              <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
                <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <Label className="mb-0">Ativa</Label>
              <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default MotivationalMessagesManager;
