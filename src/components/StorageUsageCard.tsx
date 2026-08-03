import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { HardDrive, ImageIcon, Users2, Loader2, RefreshCw, Database } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface BucketInfo {
  bucket_id: string;
  files: number;
  total_bytes: number;
}

// Lovable Cloud free tier: 1 GB storage limit
const STORAGE_LIMIT_BYTES = 1 * 1024 * 1024 * 1024;

const formatBytes = (bytes: number) => {
  if (!bytes) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const StorageUsageCard = () => {
  const [buckets, setBuckets] = useState<BucketInfo[]>([]);
  const [totalBytes, setTotalBytes] = useState(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('storage-stats');
      if (error) throw error;
      setBuckets(data?.buckets || []);
      setTotalBytes(data?.total_bytes || 0);
      setTotalFiles(data?.total_files || 0);
    } catch (err) {
      console.error('Error fetching storage stats:', err);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const usagePercent = Math.min((totalBytes / STORAGE_LIMIT_BYTES) * 100, 100);
  const statusColor = usagePercent > 90 ? 'destructive' : usagePercent > 70 ? 'warning' : 'healthy';
  const statusLabel = usagePercent > 90 ? 'Crítico' : usagePercent > 70 ? 'Atenção' : 'Saudável';

  return (
    <Card className="border-0 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <HardDrive className="h-5 w-5" />
            Uso de Armazenamento
          </CardTitle>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={fetchData}
            disabled={loading}
          >
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Overall progress bar */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  {formatBytes(totalBytes)} <span className="text-muted-foreground font-normal">de {formatBytes(STORAGE_LIMIT_BYTES)}</span>
                </span>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={statusColor === 'destructive' ? 'destructive' : 'secondary'}
                    className={cn(
                      "text-[10px] gap-1",
                      statusColor === 'healthy' && "bg-green-600/15 text-green-700 dark:text-green-400 border border-green-600/20",
                      statusColor === 'warning' && "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border border-yellow-500/20"
                    )}
                  >
                    {statusLabel}
                  </Badge>
                  <span className="text-xs font-semibold text-muted-foreground">{usagePercent.toFixed(1)}%</span>
                </div>
              </div>
              <Progress
                value={usagePercent}
                className="h-2.5"
              />
            </div>

            {/* Summary badges */}
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary" className="gap-1.5 px-2.5 py-1">
                <Database className="h-3 w-3" />
                {totalFiles} arquivos
              </Badge>
            </div>

            {/* Bucket details with individual bars */}
            <div className="space-y-3">
              {buckets.map((bucket) => {
                const isImagesBucket = bucket.bucket_id === 'images';
                const Icon = isImagesBucket ? ImageIcon : Users2;
                const label = isImagesBucket ? 'Fotos de Eventos' : 'Fotos de Integrantes';
                const bucketPercent = totalBytes > 0 ? (bucket.total_bytes / STORAGE_LIMIT_BYTES) * 100 : 0;

                return (
                  <div
                    key={bucket.bucket_id}
                    className="rounded-lg border p-3 transition-colors hover:bg-muted/30 space-y-2"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 shrink-0">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{label}</p>
                        <p className="text-xs text-muted-foreground">
                          {bucket.files} arquivo{bucket.files !== 1 ? 's' : ''} • {formatBytes(bucket.total_bytes)}
                        </p>
                      </div>
                      <span className="text-xs font-semibold text-muted-foreground shrink-0">
                        {bucketPercent.toFixed(1)}%
                      </span>
                    </div>
                    <Progress value={bucketPercent} className="h-1.5" />
                  </div>
                );
              })}
            </div>

            {/* Info note */}
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              Buckets privados com acesso via URLs assinadas. Limite de 1 GB no plano atual.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
};

export default StorageUsageCard;
