import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { Link2, Copy, Mail, Loader2, Trash2, Clock, CheckCircle2, XCircle, MessageCircle } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SECTION_OPTIONS } from '@/lib/sectionOptions';
import { formatPhoneBR } from '@/lib/formatting';
import type { Database } from '@/integrations/supabase/types';
import { useAvailableRoles } from '@/hooks/useAvailableRoles';
import { ROLE_LABELS } from '@/lib/userRoles';

type AppRole = Database['public']['Enums']['app_role'];

interface InviteLink {
  id: string;
  token: string;
  role: string;
  section: string;
  expires_at: string;
  used_at: string | null;
  used_by: string | null;
  created_at: string;
}

const InviteLinkPanel = () => {
  const { user } = useAuth();
  const { roles: availableRoles } = useAvailableRoles({ excludeAdmin: true });
  const [links, setLinks] = useState<InviteLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [waPhone, setWaPhone] = useState('');

  // Form state
  const [role, setRole] = useState<string>('voluntario');
  const [section, setSection] = useState<string>('');

  const fetchLinks = async () => {
    const { data } = await supabase
      .from('invite_links')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    setLinks((data as InviteLink[]) || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchLinks();
  }, []);

  const getInviteUrl = (token: string) => {
    return `${window.location.origin}/register?token=${token}`;
  };

  const handleCreate = async () => {
    if (!user) return;
    setCreating(true);

    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 6);

    const { data, error } = await supabase
      .from('invite_links')
      .insert({
        role,
        section: section || '',
        expires_at: expiresAt.toISOString(),
        created_by: user.id,
      } as any)
      .select('token')
      .single();

    if (error) {
      toast.error('Erro ao criar link: ' + error.message);
    } else {
      toast.success('Link de convite criado com sucesso!');
      setGeneratedToken((data as any)?.token ?? null);
      fetchLinks();
    }
    setCreating(false);
  };

  const resetDialog = () => {
    setGeneratedToken(null);
    setRole('voluntario');
    setSection('');
    setWaPhone('');
  };

  const handleDialogOpenChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) resetDialog();
  };

  const handleCopy = async (token: string) => {
    const url = getInviteUrl(token);
    await navigator.clipboard.writeText(url);
    toast.success('Link copiado!');
  };

  // Normaliza telefone: remove tudo que não é dígito. Se começar com 0, remove.
  // Se tiver 10-11 dígitos (formato BR sem DDI), prefixa com 55.
  const normalizePhone = (raw: string): string | null => {
    const digits = (raw || '').replace(/\D/g, '').replace(/^0+/, '');
    if (!digits) return null;
    if (digits.length < 8 || digits.length > 15) return null;
    if (digits.length === 10 || digits.length === 11) return `55${digits}`;
    return digits;
  };

  const handleWhatsApp = (token: string, phoneRaw?: string) => {
    const url = getInviteUrl(token);
    const text = encodeURIComponent(
      `Olá! Você foi convidado para acessar o ScoutFoto. Crie sua conta através do link abaixo (válido por 6 horas):\n\n${url}`
    );
    const phone = phoneRaw ? normalizePhone(phoneRaw) : null;
    if (phoneRaw && !phone) {
      toast.error('Número de telefone inválido. Use DDD + número (ex: 11 91234-5678).');
      return;
    }
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const base = isMobile ? 'whatsapp://send' : 'https://api.whatsapp.com/send';
    const waUrl = phone
      ? `${base}?phone=${phone}&text=${text}`
      : `${base}?text=${text}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  const handleEmail = (token: string) => {
    const url = getInviteUrl(token);
    const subject = encodeURIComponent('Convite para o ScoutFoto');
    const body = encodeURIComponent(
      `Olá!\n\nVocê foi convidado para acessar o ScoutFoto. Crie sua conta através do link abaixo (válido por 6 horas):\n\n${url}\n\nAtenciosamente,\nEquipe ScoutFoto`
    );
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('invite_links').delete().eq('id', id);
    if (error) toast.error('Erro ao excluir link');
    else {
      toast.success('Link excluído');
      fetchLinks();
    }
  };

  const getLinkStatus = (link: InviteLink) => {
    if (link.used_at) return { label: 'Usado', variant: 'secondary' as const, icon: CheckCircle2 };
    if (new Date(link.expires_at) < new Date()) return { label: 'Expirado', variant: 'destructive' as const, icon: XCircle };
    return { label: 'Ativo', variant: 'default' as const, icon: Clock };
  };

  const roleLabel = (r: string) => ROLE_LABELS[r as AppRole] || r;

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            Links de Convite
          </CardTitle>
          <Dialog open={dialogOpen} onOpenChange={handleDialogOpenChange}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Link2 className="h-4 w-4" />
                Gerar Link de Convite
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{generatedToken ? 'Link gerado com sucesso' : 'Gerar link de convite'}</DialogTitle>
              </DialogHeader>
              {!generatedToken ? (
                <div className="space-y-4 pt-2">
                  <p className="text-sm text-muted-foreground">
                    O link terá validade de <strong>6 horas</strong> e poderá ser usado apenas uma vez.
                  </p>
                  <div className="space-y-2">
                    <Label>Cargo</Label>
                    <Select value={role} onValueChange={setRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {availableRoles.map(r => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Seção</Label>
                    <Select value={section || 'none'} onValueChange={(v) => setSection(v === 'none' ? '' : v)}>
                      <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Nenhuma</SelectItem>
                        {SECTION_OPTIONS.map(opt => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button onClick={handleCreate} className="w-full gap-2" disabled={creating}>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                    Gerar Link
                  </Button>
                </div>
              ) : (
                <div className="space-y-4 pt-2">
                  <p className="text-sm text-muted-foreground">
                    Compartilhe este link com a pessoa convidada. Ele expira em <strong>6 horas</strong> e pode ser usado apenas uma vez.
                  </p>
                  <div className="rounded-md border bg-muted/40 p-3">
                    <code className="block break-all text-xs text-foreground/90">
                      {getInviteUrl(generatedToken)}
                    </code>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="wa-phone">
                      WhatsApp do destinatário <span className="text-muted-foreground font-normal">(opcional)</span>
                    </Label>
                    <Input
                      id="wa-phone"
                      type="tel"
                      inputMode="tel"
                      placeholder="(00) 00000-0000"
                      value={formatPhoneBR(waPhone)}
                      onChange={(e) => setWaPhone(formatPhoneBR(e.target.value))}
                      maxLength={15}
                    />
                    <p className="text-xs text-muted-foreground">
                      Se informado, abre a conversa direto com o contato. DDI 55 (Brasil) é assumido quando ausente.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleCopy(generatedToken)}
                      className="gap-2"
                    >
                      <Copy className="h-4 w-4" />
                      Copiar
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleWhatsApp(generatedToken, waPhone)}
                      className="gap-2 text-green-600 hover:text-green-700"
                    >
                      <MessageCircle className="h-4 w-4" />
                      WhatsApp
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleEmail(generatedToken)}
                      className="gap-2"
                    >
                      <Mail className="h-4 w-4" />
                      Email
                    </Button>
                  </div>
                  <Button variant="ghost" onClick={() => handleDialogOpenChange(false)} className="w-full">
                    Fechar
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : links.length === 0 ? (
          <p className="py-8 text-center text-muted-foreground">Nenhum link de convite criado ainda.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Cargo</TableHead>
                  <TableHead className="hidden md:table-cell">Seção</TableHead>
                  <TableHead className="hidden md:table-cell">Expira em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {links.map(link => {
                  const status = getLinkStatus(link);
                  const StatusIcon = status.icon;
                  const isActive = status.label === 'Ativo';
                  return (
                    <TableRow key={link.id}>
                      <TableCell>
                        <Badge variant={status.variant} className="gap-1">
                          <StatusIcon className="h-3 w-3" />
                          {status.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium">{roleLabel(link.role)}</TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {link.section || '—'}
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {format(new Date(link.expires_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {isActive && (
                            <>
                              <Button variant="ghost" size="icon" onClick={() => handleCopy(link.token)} title="Copiar link">
                                <Copy className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleWhatsApp(link.token)} title="Enviar via WhatsApp" className="text-green-600 hover:text-green-700">
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleEmail(link.token)} title="Enviar por email">
                                <Mail className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(link.id)} className="text-destructive hover:text-destructive">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default InviteLinkPanel;
