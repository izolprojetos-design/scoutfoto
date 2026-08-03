import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Copy, Link, Check } from 'lucide-react';

interface ShareLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string;
  eventName: string;
}

const ShareLinkDialog = ({ open, onOpenChange, eventId, eventName }: ShareLinkDialogProps) => {
  const { user } = useAuth();
  const [expiry, setExpiry] = useState('7');
  const [maxViews, setMaxViews] = useState('');
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const generateShortCode = (length = 8): string => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let result = '';
    const array = new Uint8Array(length);
    crypto.getRandomValues(array);
    for (let i = 0; i < length; i++) {
      result += chars[array[i] % chars.length];
    }
    return result;
  };

  const handleGenerate = async () => {
    if (!user) return;
    setLoading(true);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + parseInt(expiry));

    const shortToken = generateShortCode(8);

    const { data, error } = await supabase
      .from('event_share_links')
      .insert({
        event_id: eventId,
        created_by: user.id,
        expires_at: expiresAt.toISOString(),
        max_views: maxViews ? parseInt(maxViews) : null,
        token: shortToken,
      })
      .select('token')
      .single();

    if (error) {
      toast.error('Erro ao gerar link: ' + error.message);
    } else if (data) {
      const link = `${window.location.origin}/evento/${data.token}`;
      setGeneratedLink(link);
      toast.success('Link gerado com sucesso!');
    }
    setLoading(false);
  };

  const handleCopy = async () => {
    if (!generatedLink) return;
    await navigator.clipboard.writeText(generatedLink);
    setCopied(true);
    toast.success('Link copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = (open: boolean) => {
    if (!open) {
      setGeneratedLink(null);
      setCopied(false);
    }
    onOpenChange(open);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link className="h-5 w-5" />
            Compartilhar Evento
          </DialogTitle>
        </DialogHeader>

        <p className="text-sm text-muted-foreground">
          Gere um link seguro para pais visualizarem as fotos de <strong>{eventName}</strong>.
          Apenas fotos sem menores serão visíveis.
        </p>

        {!generatedLink ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Expiração do link</Label>
              <Select value={expiry} onValueChange={setExpiry}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 dia</SelectItem>
                  <SelectItem value="3">3 dias</SelectItem>
                  <SelectItem value="7">7 dias</SelectItem>
                  <SelectItem value="14">14 dias</SelectItem>
                  <SelectItem value="30">30 dias</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Limite de visualizações (opcional)</Label>
              <Input
                type="number"
                min="1"
                placeholder="Ilimitado"
                value={maxViews}
                onChange={e => setMaxViews(e.target.value)}
              />
            </div>

            <Button onClick={handleGenerate} className="w-full gap-2" disabled={loading}>
              <Link className="h-4 w-4" />
              {loading ? 'Gerando...' : 'Gerar Link Seguro'}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex gap-2">
              <Input value={generatedLink} readOnly className="text-xs" />
              <Button variant="outline" size="icon" onClick={handleCopy}>
                {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Este link expira em {expiry} dia(s). Compartilhe com os pais para acesso às fotos do evento.
            </p>
            <Button variant="outline" className="w-full" onClick={() => setGeneratedLink(null)}>
              Gerar outro link
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default ShareLinkDialog;
