import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Cloud, Save, Loader2, Link2, ExternalLink, AlertTriangle, ShieldCheck, Image as ImageIcon, Video, FileText, CheckCircle2, X } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DriveLog {
  id: string;
  branch: string;
  scout_name: string;
  photo_date: string;
  drive_folder_id: string;
  drive_folder_url: string;
  file_name: string;
  created_at: string;
  user_id: string;
}

interface GoogleDriveConfig {
  enabled: boolean;
  allowed_types: string[]; // 'image', 'video', 'document'
  blocked_domains: string[];
}

const GoogleDriveSettings = () => {
  const [config, setConfig] = useState<GoogleDriveConfig | null>(null);
  const [logs, setLogs] = useState<DriveLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: configData } = await supabase
        .from('global_settings')
        .select('value')
        .eq('key', 'google_drive_integration')
        .single();
      
      if (configData) {
        setConfig(configData.value as unknown as GoogleDriveConfig);
      }

      const { data: logsData } = await supabase
        .from('drive_uploads' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(20);
      
      setLogs((logsData as any) || []);
    } catch (error) {
      console.error('Error fetching Drive data:', error);
    }
    setLoading(false);
  };

  const handleSaveConfig = async () => {
    if (!config) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('global_settings')
        .upsert({ 
          key: 'google_drive_integration', 
          value: config as any,
          updated_at: new Date().toISOString()
        });
      
      if (error) throw error;
      toast.success('Configurações do Google Drive atualizadas!');
    } catch (error: any) {
      toast.error('Erro ao salvar: ' + error.message);
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        {/* Main Control */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Cloud className="h-5 w-5 text-primary" />
              Integração Google Drive
            </CardTitle>
            <CardDescription>
              Controle global de links e uploads para o Google Drive
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
              <div className="space-y-0.5">
                <Label className="text-base font-semibold">Status Global da Integração</Label>
                <p className="text-sm text-muted-foreground">
                  Habilita ou desabilita completamente o uso de links do Google Drive
                </p>
              </div>
              <Switch 
                checked={config?.enabled} 
                onCheckedChange={(checked) => setConfig(prev => prev ? ({ 
                  ...prev, 
                  enabled: checked,
                  allowed_types: checked ? (prev.allowed_types.length > 0 ? prev.allowed_types : ['image', 'video', 'document']) : []
                }) : null)}
              />
            </div>

            {config?.enabled && (
              <div className="space-y-4 pt-2">
                <Label className="text-sm font-medium">Tipos de Links Permitidos</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Button
                    variant={config.allowed_types.length === 3 ? "default" : "outline"}
                    size="sm"
                    className="justify-start gap-2 h-10"
                    onClick={() => setConfig({ ...config, allowed_types: ['image', 'video', 'document'] })}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Todos os Tipos
                  </Button>
                  <Button
                    variant={config.allowed_types.length === 0 ? "default" : "outline"}
                    size="sm"
                    className="justify-start gap-2 h-10"
                    onClick={() => setConfig({ ...config, allowed_types: [] })}
                  >
                    <X className="h-4 w-4" />
                    Nenhum
                  </Button>
                </div>

                <div className="space-y-2">
                  {[
                    { id: 'image', label: 'Link de Foto', icon: ImageIcon },
                    { id: 'video', label: 'Link de Video', icon: Video },
                    { id: 'document', label: 'Link de Documento', icon: FileText },
                  ].map((type) => {
                    const isSelected = config.allowed_types.includes(type.id);
                    return (
                      <div 
                        key={type.id}
                        onClick={() => {
                          const next = isSelected 
                            ? config.allowed_types.filter(t => t !== type.id)
                            : [...config.allowed_types, type.id];
                          setConfig({ ...config, allowed_types: next });
                        }}
                        className={`flex items-center justify-between p-3 rounded-md border cursor-pointer transition-all ${
                          isSelected ? 'bg-primary/5 border-primary ring-1 ring-primary' : 'hover:bg-muted'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <type.icon className={`h-4 w-4 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                          <span className="text-sm font-medium">{type.label}</span>
                        </div>
                        <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-muted-foreground/30'}`}>
                          {isSelected && <CheckCircle2 className="h-3 w-3 text-white" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex items-start gap-3 p-4 rounded-lg border border-yellow-500/30 bg-yellow-500/5">
              <AlertTriangle className="h-5 w-5 text-yellow-600 shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800 dark:text-yellow-200">
                <p className="font-semibold">Importante:</p>
                <p>O bloqueio global impede novos links de domínios drive.google.com. Links existentes continuarão visíveis a menos que a permissão "Gerenciar links do Google Drive" seja removida dos usuários/papéis.</p>
              </div>
            </div>

            <Button 
              onClick={handleSaveConfig} 
              disabled={saving} 
              className="w-full gap-2"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar Alterações
            </Button>
          </CardContent>
        </Card>

        {/* Permission Info */}
        <Card className="border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              Acesso aos Integrantes
            </CardTitle>
            <CardDescription>
              Gerenciamento de permissões por papel
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              A permissão <strong>"Gerenciar links do Google Drive"</strong> agora está disponível no painel de Permissões.
            </p>
            <ul className="space-y-2 text-sm">
              <li className="flex items-center gap-2">
                <Badge variant="outline" className="h-2 w-2 rounded-full p-0 bg-green-500 border-green-500" />
                <span><strong>Admin:</strong> Acesso total automático.</span>
              </li>
              <li className="flex items-center gap-2">
                <Badge variant="outline" className="h-2 w-2 rounded-full p-0 bg-blue-500 border-blue-500" />
                <span><strong>Integrantes:</strong> Precisam ter a permissão habilitada para adicionar ou remover links do Drive.</span>
              </li>
            </ul>
            <div className="pt-4">
              <p className="text-xs text-muted-foreground bg-muted p-3 rounded italic">
                "Esta função permite que os integrantes cadastrados possam ser autorizados a vincular materiais externos do Google Drive aos eventos do sistema."
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Upload Logs */}
      <Card className="border-0 shadow-lg">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Logs de Atividade Drive
          </CardTitle>
          <CardDescription>
            Últimos uploads e links registrados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Ramo/Evento</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.length > 0 ? logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell className="text-xs">
                      {log.created_at ? format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '—'}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-medium">{log.scout_name}</span>
                        <span className="text-xs text-muted-foreground">{log.branch} • {log.photo_date}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{log.file_name}</Badge>
                    </TableCell>
                    <TableCell>
                      <a 
                        href={log.drive_folder_url} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-primary hover:underline flex items-center gap-1 text-sm"
                      >
                        <Link2 className="h-3.5 w-3.5" />
                        Ver Pasta
                      </a>
                    </TableCell>
                  </TableRow>
                )) : (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center py-10 text-muted-foreground">
                      Nenhum registro de upload para o Drive encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GoogleDriveSettings;
