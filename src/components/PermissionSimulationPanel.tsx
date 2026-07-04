import React, { useState, useEffect, useCallback } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Shield, Bug, X, Info, AlertTriangle, Home, LayoutDashboard, Users, User, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useNavigate, useLocation } from 'react-router-dom';

export const PermissionSimulationPanel = () => {
  const { canViewPhotos, canViewScouts, canAccessAdmin } = usePermissions();
  const { roles, user, simulateRoles, isSimulating: isSimulationActive } = useAuth();
  const [logs, setLogs] = useState<{ id: string; timestamp: string; message: string; type: 'info' | 'warn' | 'error' }[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [internalIsSimulating, setInternalIsSimulating] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

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
    const handleToggle = () => setShowLogs((v) => !v);

    window.addEventListener('route-redirect', handleRedirect);
    window.addEventListener('toggle-permission-simulator', handleToggle);

    return () => {
      window.removeEventListener('route-redirect', handleRedirect);
      window.removeEventListener('toggle-permission-simulator', handleToggle);
    };
  }, [addLog]);

  useEffect(() => {
    const timestamp = new Date().toLocaleTimeString();
    const message = `Página Atual: ${location.pathname} | Permissões: Fotos=${canViewPhotos ? 'OK' : 'Bloqueado'}, Integrantes=${canViewScouts ? 'OK' : 'Bloqueado'}, Admin=${canAccessAdmin ? 'Sim' : 'Não'}`;
    addLog(message, 'info');
  }, [canViewPhotos, canViewScouts, canAccessAdmin, addLog, location.pathname]);

  const simulateRole = async (targetRole: any) => {
    setInternalIsSimulating(true);
    addLog(`Ativando modo de simulação: ${targetRole}...`, 'info');
    
    try {
      simulateRoles(targetRole === 'admin' ? ['admin'] : [targetRole]);
      addLog(`Modo simulação ativo: ${targetRole}. Navegue para testar as rotas.`, 'info');
      toast.success(`Simulação: Agora você é ${targetRole}`);
    } catch (err: any) {
      addLog(`Erro na simulação: ${err.message}`, 'error');
      toast.error('Falha na simulação');
    } finally {
      setInternalIsSimulating(false);
    }
  };

  const restoreOriginal = () => {
    simulateRoles(null);
    addLog('Restaurando permissões originais...', 'info');
    toast.success('Permissões originais restauradas');
  };

  const quickNav = (path: string) => {
    addLog(`Navegação forçada para ${path}...`, 'info');
    // Forçamos a limpeza da última rota para o teste de navegação manual
    localStorage.removeItem('last_accessed_route');
    navigate(path);
  };

  // Only show for admins or if already simulating
  if (!roles.includes('admin') && !isSimulationActive) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-2">
      {showLogs && (
        <Card className="w-80 shadow-2xl border-primary/20 bg-background/95 backdrop-blur flex flex-col max-h-[85vh]">
          <CardHeader className="py-3 flex flex-row items-center justify-between shrink-0">
            <div className="flex flex-col">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Bug className="h-4 w-4 text-primary" />
                Simulador de Navegação
              </CardTitle>
              <span className="text-[10px] text-muted-foreground">Valide permissões e redirecionamentos</span>
            </div>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setShowLogs(false)}>
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>
          <CardContent className="p-0 flex-1 overflow-hidden flex flex-col">
            <div className="p-3 bg-muted/50 border-b space-y-3 shrink-0">
              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Shield className="h-3 w-3" /> Alterar Papel (Simulação)
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button 
                    variant={roles.includes('admin') && !isSimulationActive ? "default" : "outline"}
                    size="sm" 
                    className="h-7 text-[10px] px-1 justify-start"
                    onClick={() => simulateRole('admin')}
                    disabled={internalIsSimulating}
                  >
                    Administrador
                  </Button>
                  <Button 
                    variant={roles.includes('chefe') ? "secondary" : "outline"}
                    size="sm" 
                    className="h-7 text-[10px] px-1 justify-start"
                    onClick={() => simulateRole('chefe')}
                    disabled={internalIsSimulating}
                  >
                    Chefe/Escotista
                  </Button>
                  <Button 
                    variant={roles.includes('parent') ? "secondary" : "outline"}
                    size="sm" 
                    className="h-7 text-[10px] px-1 justify-start"
                    onClick={() => simulateRole('parent')}
                    disabled={internalIsSimulating}
                  >
                    Pai/Mãe
                  </Button>
                  <Button 
                    variant={roles.includes('viewer') ? "secondary" : "outline"}
                    size="sm" 
                    className="h-7 text-[10px] px-1 justify-start"
                    onClick={() => simulateRole('viewer')}
                    disabled={internalIsSimulating}
                  >
                    Visitante
                  </Button>
                </div>
                {isSimulationActive && (
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="w-full mt-2 h-7 text-[10px] text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={restoreOriginal}
                  >
                    Sair do Modo Simulação
                  </Button>
                )}
              </div>

              <div>
                <p className="text-[10px] font-bold uppercase text-muted-foreground mb-1.5 flex items-center gap-1">
                  <ArrowRight className="h-3 w-3" /> Testar Navegação
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => quickNav('/')}>
                    <Home className="h-3 w-3" /> Início
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => quickNav('/dashboard')}>
                    <LayoutDashboard className="h-3 w-3" /> Dashboard
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => quickNav('/scouts')}>
                    <Users className="h-3 w-3" /> Integrantes
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => quickNav('/profile')}>
                    <User className="h-3 w-3" /> Perfil
                  </Button>
                  <Button variant="outline" size="sm" className="h-7 text-[10px] gap-1" onClick={() => quickNav('/admin')}>
                    <Shield className="h-3 w-3" /> Admin
                  </Button>
                </div>
              </div>

              {isSimulationActive && (
                <div className="flex items-center gap-1.5 text-[10px] text-amber-600 bg-amber-50 p-1.5 rounded border border-amber-200">
                  <AlertTriangle className="h-3 w-3" />
                  <span>Modo Simulação Ativo: As permissões acima são temporárias.</span>
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
          </CardContent>
        </Card>
      )}
      
    </div>
  );
};

export const PermissionSimulationTrigger = () => {
  const { roles, isSimulating } = useAuth();
  if (!roles.includes('admin') && !isSimulating) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('toggle-permission-simulator'))}
          className={cn(
            "p-1 rounded-md transition-colors",
            isSimulating
              ? "text-amber-600 hover:bg-amber-50"
              : "text-muted-foreground hover:text-foreground hover:bg-accent"
          )}
        >
          {isSimulating ? <AlertTriangle className="h-3.5 w-3.5" /> : <Bug className="h-3.5 w-3.5" />}
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <p className="text-xs">Simulador de Navegação</p>
      </TooltipContent>
    </Tooltip>
  );
};
