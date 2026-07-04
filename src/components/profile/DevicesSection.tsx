import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Smartphone, Monitor, Trash2, Loader2, Shield, ShieldCheck, LogOut } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { getDeviceFingerprint } from '@/lib/deviceDetection';
import { logAudit } from '@/lib/auditLog';

interface Device {
  id: string;
  device_name: string;
  browser: string;
  os: string;
  is_trusted: boolean;
  last_login_at: string;
  created_at: string;
  device_fingerprint: string;
}

const DevicesSection = () => {
  const { user } = useAuth();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [removing, setRemoving] = useState<string | null>(null);
  const [loggingOutAll, setLoggingOutAll] = useState(false);
  const [currentFingerprint, setCurrentFingerprint] = useState('');

  useEffect(() => {
    if (!user) return;
    fetchDevices();
    setCurrentFingerprint(getDeviceFingerprint());

    const channel = supabase
      .channel(`user_devices:${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'user_devices', filter: `user_id=eq.${user.id}` },
        () => { fetchDevices(); }
      )
      .subscribe();

    const interval = setInterval(fetchDevices, 60_000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);


  const fetchDevices = async () => {
    if (!user) return;
    setLoading(true);
    const { data, error } = await supabase
      .from('user_devices')
      .select('*')
      .eq('user_id', user.id)
      .order('last_login_at', { ascending: false });

    if (error) {
      toast.error('Erro ao carregar dispositivos');
    } else {
      setDevices(data || []);
    }
    setLoading(false);
  };

  const removeDevice = async (deviceId: string) => {
    setRemoving(deviceId);
    const { error } = await supabase
      .from('user_devices')
      .delete()
      .eq('id', deviceId);

    if (error) {
      toast.error('Erro ao remover dispositivo');
    } else {
      const removed = devices.find(d => d.id === deviceId);
      toast.success('Dispositivo removido');
      setDevices(prev => prev.filter(d => d.id !== deviceId));
      try {
        await logAudit(user!.id, 'remote_device_removed', undefined, {
          device_name: removed?.device_name,
          browser: removed?.browser,
          os: removed?.os,
        });
      } catch {}
    }
    setRemoving(null);
  };

  const toggleTrust = async (device: Device) => {
    const { error } = await supabase
      .from('user_devices')
      .update({ is_trusted: !device.is_trusted })
      .eq('id', device.id);

    if (error) {
      toast.error('Erro ao atualizar dispositivo');
    } else {
      setDevices(prev =>
        prev.map(d => d.id === device.id ? { ...d, is_trusted: !d.is_trusted } : d)
      );
      toast.success(device.is_trusted ? 'Dispositivo marcado como não confiável' : 'Dispositivo marcado como confiável');
    }
  };

  const isMobile = (os: string) =>
    /android|ios|iphone|ipad/i.test(os);

  const isCurrentDevice = (fingerprint: string) =>
    fingerprint === currentFingerprint;

  const logoutAllDevices = async () => {
    if (!user) return;
    setLoggingOutAll(true);
    const otherDevices = devices.filter(d => d.device_fingerprint !== currentFingerprint);
    // Remove all devices except current
    await supabase
      .from('user_devices')
      .delete()
      .eq('user_id', user.id)
      .neq('device_fingerprint', currentFingerprint);

    try {
      await logAudit(user.id, 'logout_all_sessions', undefined, {
        devices_removed: otherDevices.length,
        devices: otherDevices.map(d => ({ name: d.device_name, browser: d.browser, os: d.os })),
      });
    } catch {}

    toast.success('Todas as outras sessões foram encerradas.');
    await supabase.auth.signOut({ scope: 'global' });
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Smartphone className="h-5 w-5" />
          Dispositivos Conectados
        </CardTitle>
        {devices.length > 1 && (
          <Button
            variant="destructive"
            size="sm"
            onClick={logoutAllDevices}
            disabled={loggingOutAll}
            className="gap-2"
          >
            {loggingOutAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
            Encerrar todas as sessões
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : devices.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum dispositivo registrado
          </p>
        ) : (
          <div className="space-y-3">
            {devices.map(device => {
              const current = isCurrentDevice(device.device_fingerprint);
              return (
                <div
                  key={device.id}
                  className={`flex items-center gap-4 rounded-lg border p-4 transition-colors ${
                    current ? 'border-primary/30 bg-primary/5' : 'border-border'
                  }`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted">
                    {isMobile(device.os) ? (
                      <Smartphone className="h-5 w-5 text-muted-foreground" />
                    ) : (
                      <Monitor className="h-5 w-5 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">
                        {device.device_name || 'Dispositivo desconhecido'}
                      </span>
                      {current && (
                        <Badge variant="default" className="text-xs">Este dispositivo</Badge>
                      )}
                      {device.is_trusted && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <ShieldCheck className="h-3 w-3" /> Confiável
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {device.browser} · {device.os}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Último acesso: {format(new Date(device.last_login_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </p>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => toggleTrust(device)}
                      title={device.is_trusted ? 'Remover confiança' : 'Marcar como confiável'}
                      className="h-8 w-8"
                    >
                      {device.is_trusted ? (
                        <ShieldCheck className="h-4 w-4 text-primary" />
                      ) : (
                        <Shield className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                    {!current && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => removeDevice(device.id)}
                        disabled={removing === device.id}
                        title="Remover dispositivo"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                      >
                        {removing === device.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default DevicesSection;
