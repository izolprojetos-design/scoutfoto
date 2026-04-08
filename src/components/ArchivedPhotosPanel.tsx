import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Archive, Trash2, RotateCcw, Loader2, ImageIcon, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

interface ArchivedFile {
  name: string;
  url: string;
  size: number;
  created_at: string;
}

const ArchivedPhotosPanel = () => {
  const [files, setFiles] = useState<ArchivedFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('archive-old-photos', {
        body: { action: 'list' },
      });
      if (error) throw error;
      setFiles(data?.files || []);
    } catch (err) {
      console.error(err);
      toast.error('Erro ao carregar fotos arquivadas');
    }
    setLoading(false);
  };

  useEffect(() => { loadFiles(); }, []);

  const handleRestore = async (fileName: string) => {
    setActionLoading(fileName);
    try {
      const { data, error } = await supabase.functions.invoke('archive-old-photos', {
        body: { action: 'restore', fileName },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success(`"${fileName}" restaurada com sucesso!`);
      setFiles(prev => prev.filter(f => f.name !== fileName));
    } catch (err: any) {
      toast.error('Erro ao restaurar: ' + err.message);
    }
    setActionLoading(null);
  };

  const handleDelete = async (fileName: string) => {
    setActionLoading(fileName);
    try {
      const { data, error } = await supabase.functions.invoke('archive-old-photos', {
        body: { action: 'delete', fileName },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      toast.success(`"${fileName}" excluída permanentemente`);
      setFiles(prev => prev.filter(f => f.name !== fileName));
    } catch (err: any) {
      toast.error('Erro ao excluir: ' + err.message);
    }
    setActionLoading(null);
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Archive className="h-5 w-5" />
            Fotos Arquivadas
            {files.length > 0 && (
              <Badge variant="secondary" className="ml-1">{files.length}</Badge>
            )}
          </CardTitle>
          <Button variant="outline" size="sm" onClick={loadFiles} disabled={loading} className="gap-1.5">
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Atualizar
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Fotos antigas movidas para a pasta de arquivamento. Você pode restaurá-las ou excluí-las permanentemente.
        </p>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : files.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <ImageIcon className="h-10 w-10 mb-3" />
            <p className="text-sm font-medium">Nenhuma foto arquivada</p>
            <p className="text-xs mt-1">A pasta de arquivamento está vazia</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {files.map((file) => (
                <motion.div
                  key={file.name}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="group rounded-lg border bg-card overflow-hidden"
                >
                  <div className="aspect-square relative bg-muted">
                    <img
                      src={file.url}
                      alt={file.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                    {actionLoading === file.name && (
                      <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    )}
                  </div>
                  <div className="p-3 space-y-2">
                    <p className="text-xs font-medium truncate" title={file.name}>{file.name}</p>
                    <p className="text-[10px] text-muted-foreground">{formatSize(file.size)}</p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1 gap-1.5 text-xs"
                        onClick={() => handleRestore(file.name)}
                        disabled={!!actionLoading}
                      >
                        <RotateCcw className="h-3 w-3" />
                        Restaurar
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="destructive"
                            size="sm"
                            className="flex-1 gap-1.5 text-xs"
                            disabled={!!actionLoading}
                          >
                            <Trash2 className="h-3 w-3" />
                            Excluir
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Excluir permanentemente?</AlertDialogTitle>
                            <AlertDialogDescription>
                              A foto <strong>"{file.name}"</strong> será excluída permanentemente e não poderá ser recuperada.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancelar</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(file.name)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                              Excluir
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ArchivedPhotosPanel;
