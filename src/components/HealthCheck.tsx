import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Server, Database, Shield, HardDrive, Cpu, RefreshCw, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface HealthStatus {
  service_name: string;
  status: 'healthy' | 'degraded' | 'down';
  last_check: string;
  details: any;
}

const HealthCheck = () => {
  const [statuses, setStatuses] = useState<HealthStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchHealth = async () => {
    setRefreshing(true);
    const { data, error } = await supabase
      .from('system_health')
      .select('*')
      .order('service_name');
    
    if (error) {
      toast.error('Erro ao carregar status do sistema');
    } else {
      setStatuses(data as HealthStatus[]);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchHealth();
    // Refresh every 30 seconds
    const interval = setInterval(fetchHealth, 30000);
    return () => clearInterval(interval);
  }, []);

  const getIcon = (name: string) => {
    switch (name) {
      case 'database': return <Database className="h-5 w-5" />;
      case 'auth': return <Shield className="h-5 w-5" />;
      case 'storage': return <HardDrive className="h-5 w-5" />;
      case 'edge_functions': return <Cpu className="h-5 w-5" />;
      default: return <Server className="h-5 w-5" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Badge className="bg-emerald-500 hover:bg-emerald-600 gap-1"><CheckCircle2 className="h-3 w-3" /> Operacional</Badge>;
      case 'degraded':
        return <Badge variant="outline" className="text-amber-500 border-amber-500 gap-1"><AlertCircle className="h-3 w-3" /> Degradado</Badge>;
      case 'down':
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Fora do ar</Badge>;
      default:
        return <Badge variant="secondary">Desconhecido</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-32 bg-muted rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight flex items-center gap-2">
          <Server className="h-5 w-5 text-primary" /> Health Check em Tempo Real
        </h2>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={fetchHealth} 
          disabled={refreshing}
          className="gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Atualizar
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statuses.map((status) => (
          <Card key={status.service_name} className="overflow-hidden border shadow-sm">
            <CardHeader className="p-4 pb-2 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-sm font-medium capitalize">
                {status.service_name.replace('_', ' ')}
              </CardTitle>
              <div className="text-muted-foreground">
                {getIcon(status.service_name)}
              </div>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="mt-2">
                {getStatusBadge(status.status)}
              </div>
              <p className="text-[10px] text-muted-foreground mt-3 uppercase tracking-wider">
                Última verificação: {new Date(status.last_check).toLocaleTimeString('pt-BR')}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};

export default HealthCheck;
