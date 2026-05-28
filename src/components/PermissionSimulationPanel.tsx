import React, { useState, useEffect, useCallback } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, Bug, X, Info, AlertTriangle, RefreshCw, LogIn } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export const PermissionSimulationPanel = () => {
  const { canViewPhotos, canViewScouts, canAccessAdmin } = usePermissions();
  const { roles, user, profile, refreshRoles } = useAuth();
  const [logs, setLogs] = useState<{ id: string; timestamp: string; message: string; type: 'info' | 'warn' | 'error' }[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [isSimulating, setIsSimulating] = useState(false);

  const addLog = useCallback((message: string, type: 'info' | 'warn' | 'error' = 'info') => {
    setLogs(prev => [
      { id: Math.random().toString(36).substr(2, 9), timestamp: new Date().toLocaleTimeString(), message, type },
      ...prev.slice(0, 49)
    ]);
  }, []);

  useEffect(() => {
    const handleRedirect = (e: any) => {
      addLog(e.detail.message, e.detail.type);
    };

    window.addEventListener('route-redirect', handleRedirect);
    
    return () => window.removeEventListener('route-redirect', handleRedirect);
  }, [addLog]);

  useEffect(() => {
    const timestamp = new Date().toLocaleTimeString();
    const message = `Status das Permissões: Início=${canViewPhotos ? 'OK' : 'Bloqueado'}, Integrantes=${canViewScouts ? 'OK' : 'Bloqueado'}, Admin=${canAccessAdmin ? 'Sim' : 'Não'}`;
    addLog(message, 'info');
  }, [canViewPhotos, canViewScouts, canAccessAdmin, addLog]);

  const simulateRole = async (targetRole: 'parent' | 'viewer' | 'voluntario') => {
    if (!user) return;
    setIsSimulating(true);
    addLog(`Simulando papel: ${targetRole}...`, 'info');
    
    try {
      // Temporarily change user role for testing
      const { error } = await supabase
        .from('user_roles')
        .update({ role: targetRole })
        .eq('user_id', user.id);

      if (error) throw error;
      
      await refreshRoles();
      addLog(`Papel alterado para ${targetRole}. Teste a navegação agora.`, 'info');
      toast.success(`Modo de teste: Agora você é ${targetRole}`);
    } catch (err: any) {
      addLog(`Erro na simulação: ${err.message}`, 'error');
      toast.error('Falha na simulação');
    } finally {
      setIsSimulating(false);
    }
  };

  const restoreAdmin = async () => {
    if (!user) return;
    setIsSimulating(true);
    addLog('Restaurando acesso de administrador...', 'info');
    
    try {
      const { error } = await supabase
        .from('user_roles')
        .update({ role: 'admin' })
        .eq('user_id', user.id);

      if (error) throw error;
      
      await refreshRoles();
      addLog('Acesso de administrador restaurado.', 'info');
      toast.success('Admin restaurado');
    } catch (err: any) {
      addLog(`Erro ao restaurar: ${err.message}`, 'error');
      toast.error('Falha ao restaurar admin');
    } finally {
      setIsSimulating(false);
    }
  };

  if (process.env.NODE_ENV === 'production' && !roles.includes('admin')) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-2">
      {showLogs && (
        <Card className="w-80 shadow-2xl border-primary/20 bg-background/95 backdrop-blur flex flex-col max-h-[80vh]">
          <CardHeader className="py-3 flex flex-row items-center justify-between shrink-0">
            <div className="flex flex-col">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Bug className="h-4 w-4 text-primary" />
                Diagnóstico de Rotas
              </CardTitle>
              <span className="text-[10px] text-muted-foreground">Log de Redirecionamento e Acessos</span>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowLogs(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
            <div className="p-3 bg-muted/50 border-b space-y-2 shrink-0">
              <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Simular Permissões (Modo Teste)</p>
              <div className="flex flex-wrap gap-1">
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-[10px] px-2"
                  onClick={() => simulateRole('parent')}
                  disabled={isSimulating || !roles.includes('admin')}
                >
                  Pai/Mãe
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="h-7 text-[10px] px-2"
                  onClick={() => simulateRole('viewer')}
                  disabled={isSimulating || !roles.includes('admin')}
                >
                  Visitante
                </Button>
                <Button 
                  variant="destructive" 
                  size="sm" 
                  className="h-7 text-[10px] px-2"
                  onClick={restoreAdmin}
                  disabled={isSimulating || roles.includes('admin')}
                >
                  Restaurar Admin
                </Button>
              </div>
              {!roles.includes('admin') && (
                <div className="flex items-center gap-1.5 text-[10px] text-amber-600 bg-amber-50 p-1.5 rounded border border-amber-200">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Você está operando com permissões reduzidas.</span>
                </div>
              )}
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-2">
                {logs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <Info className="h-8 w-8 mb-2 opacity-20" />
                    <p className="text-xs italic">Nenhum evento registrado</p>
                  </div>
                ) : (
                  logs.map(log => (
                    <div key={log.id} className="text-[10px] border-b border-border/50 pb-1.5 last:border-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-muted-foreground font-mono">[{log.timestamp}]</span>
                        <Badge variant="outline" className={cn(
                          "text-[8px] px-1 py-0 h-3 uppercase",
                          log.type === 'error' ? 'border-destructive text-destructive' : 
                          log.type === 'warn' ? 'border-amber-500 text-amber-500' : 'border-blue-500 text-blue-500'
                        )}>
                          {log.type}
                        </Badge>
                      </div>
                      <p className={cn(
                        "leading-relaxed font-medium",
                        log.type === 'error' ? 'text-destructive' : 
                        log.type === 'warn' ? 'text-amber-700 dark:text-amber-400' : 'text-foreground'
                      )}>
                        {log.message}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
            
            <div className="p-3 bg-primary/5 text-[10px] border-t shrink-0">
              <div className="flex items-center justify-between">
                <span className="font-bold">Capacidades Ativas:</span>
                <div className="flex gap-2">
                  <div className="flex items-center gap-1">
                    <div className={cn("w-1.5 h-1.5 rounded-full", canViewPhotos ? "bg-green-500" : "bg-red-500")} />
                    Fotos
                  </div>
                  <div className="flex items-center gap-1">
                    <div className={cn("w-1.5 h-1.5 rounded-full", canViewScouts ? "bg-green-500" : "bg-red-500")} />
                    Integrantes
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <button 
        onClick={() => setShowLogs(!showLogs)}
        className={cn(
          "h-12 w-12 rounded-full shadow-2xl flex items-center justify-center hover:scale-105 transition-all duration-300",
          !roles.includes('admin') ? "bg-amber-500 animate-pulse" : "bg-primary"
        )}
        title="Painel de Simulação e Diagnóstico"
      >
        {!roles.includes('admin') ? <AlertTriangle className="h-6 w-6 text-white" /> : <Bug className="h-6 w-6 text-primary-foreground" />}
      </button>
    </div>
  );
};
