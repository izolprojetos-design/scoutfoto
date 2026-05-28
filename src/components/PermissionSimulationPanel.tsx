import React, { useState, useEffect } from 'react';
import { usePermissions } from '@/hooks/usePermissions';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, Bug, Navigation, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

export const PermissionSimulationPanel = () => {
  const { canViewPhotos, canViewScouts, canViewEvents, canAccessAdmin, permissions } = usePermissions();
  const { roles } = useAuth();
  const [logs, setLogs] = useState<{ id: string; timestamp: string; message: string; type: 'info' | 'warn' | 'error' }[]>([]);
  const [showLogs, setShowLogs] = useState(false);

  // Auto-log changes
  useEffect(() => {
    const timestamp = new Date().toLocaleTimeString();
    const message = `Permissions updated: ViewPhotos=${canViewPhotos}, ViewScouts=${canViewScouts}, Admin=${canAccessAdmin}`;
    addLog(message, 'info');
  }, [canViewPhotos, canViewScouts, canAccessAdmin]);

  const addLog = (message: string, type: 'info' | 'warn' | 'error' = 'info') => {
    setLogs(prev => [
      { id: Math.random().toString(36).substr(2, 9), timestamp: new Date().toLocaleTimeString(), message, type },
      ...prev.slice(0, 49)
    ]);
  };

  if (process.env.NODE_ENV === 'production' && !roles.includes('admin')) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-[9999] flex flex-col items-end gap-2">
      {showLogs && (
        <Card className="w-80 shadow-2xl border-primary/20 bg-background/95 backdrop-blur">
          <CardHeader className="py-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Bug className="h-4 w-4 text-primary" />
              Logs de Redirecionamento
            </CardTitle>
            <Badge variant="outline" className="text-[10px]">DEBUG</Badge>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-60 px-4 pb-4">
              <div className="space-y-2">
                {logs.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic text-center py-4">Sem eventos recentes</p>
                ) : (
                  logs.map(log => (
                    <div key={log.id} className="text-[10px] border-b border-border/50 pb-1">
                      <span className="text-muted-foreground mr-2 font-mono">[{log.timestamp}]</span>
                      <span className={cn(
                        log.type === 'error' ? 'text-destructive' : 
                        log.type === 'warn' ? 'text-amber-500' : 'text-foreground'
                      )}>
                        {log.message}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
            <div className="p-3 bg-muted/50 text-[10px] border-t">
              <p className="font-semibold mb-1">Status Atual:</p>
              <div className="grid grid-cols-2 gap-1">
                <div className="flex items-center gap-1">
                  <div className={cn("w-1.5 h-1.5 rounded-full", canViewPhotos ? "bg-green-500" : "bg-red-500")} />
                  Photos
                </div>
                <div className="flex items-center gap-1">
                  <div className={cn("w-1.5 h-1.5 rounded-full", canViewScouts ? "bg-green-500" : "bg-red-500")} />
                  Scouts
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
      
      <button 
        onClick={() => setShowLogs(!showLogs)}
        className="h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:scale-105 transition-transform"
        title="Simulação de Permissões"
      >
        <Shield className="h-5 w-5" />
      </button>
    </div>
  );
};
