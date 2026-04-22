import { useMemo, lazy, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart3,
  ImageIcon,
  Film,
  HardDrive,
  TrendingUp,
  Upload,
  User,
} from 'lucide-react';
import { format, subMonths, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Lazy load recharts for code splitting
const RechartsBar = lazy(() =>
  import('recharts').then(mod => ({
    default: ({ data, bars, xKey, height = 220 }: {
      data: any[];
      bars: { dataKey: string; name: string; color: string; stackId?: string }[];
      xKey: string;
      height?: number;
    }) => (
      <mod.ResponsiveContainer width="100%" height={height}>
        <mod.BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <mod.CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
          <mod.XAxis dataKey={xKey} tick={{ fontSize: 11 }} className="fill-muted-foreground" />
          <mod.YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" allowDecimals={false} />
          <mod.Tooltip
            contentStyle={{
              borderRadius: '8px',
              border: '1px solid hsl(var(--border))',
              background: 'hsl(var(--card))',
              fontSize: '12px',
            }}
          />
          <mod.Legend wrapperStyle={{ fontSize: '11px' }} />
          {bars.map(bar => (
            <mod.Bar
              key={bar.dataKey}
              dataKey={bar.dataKey}
              name={bar.name}
              fill={bar.color}
              stackId={bar.stackId}
              radius={bar.stackId ? undefined : [4, 4, 0, 0]}
            />
          ))}
        </mod.BarChart>
      </mod.ResponsiveContainer>
    ),
  }))
);

interface ImageRecord {
  created_at: string;
  media_type: string;
  user_id: string;
  event_id: string | null;
}

interface EventRecord {
  id: string;
  created_at: string;
}

interface ScoutRecord {
  id: string;
  created_at: string;
}

interface TopUploader {
  user_id: string;
  name: string;
  count: number;
}

interface DashboardMetricsProps {
  images: ImageRecord[];
  events: EventRecord[];
  scouts: ScoutRecord[];
  profiles: { user_id: string; name: string }[];
  isAdmin: boolean;
}

const ChartSkeleton = () => (
  <div className="h-[220px] animate-pulse rounded-lg bg-muted/50" />
);

const DashboardMetrics = ({ images, events, scouts, profiles, isAdmin }: DashboardMetricsProps) => {
  // Monthly upload activity (last 6 months)
  const monthlyUploads = useMemo(() => {
    const now = new Date();
    const months: { key: string; label: string; start: Date; end: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const start = startOfMonth(d);
      const end = i === 0 ? now : startOfMonth(subMonths(now, i - 1));
      months.push({
        key: format(d, 'yyyy-MM'),
        label: format(d, 'MMM', { locale: ptBR }),
        start,
        end,
      });
    }
    return months.map(m => {
      const monthImages = images.filter(img => {
        const d = new Date(img.created_at);
        return d >= m.start && d < m.end;
      });
      return {
        month: m.label.charAt(0).toUpperCase() + m.label.slice(1),
        fotos: monthImages.filter(i => i.media_type !== 'video').length,
        videos: monthImages.filter(i => i.media_type === 'video').length,
      };
    });
  }, [images]);

  // Monthly growth (events + scouts)
  const monthlyGrowth = useMemo(() => {
    const now = new Date();
    const months: { label: string; start: Date; end: Date }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
      const start = startOfMonth(d);
      const end = i === 0 ? now : startOfMonth(subMonths(now, i - 1));
      months.push({
        label: format(d, 'MMM', { locale: ptBR }),
        start,
        end,
      });
    }
    return months.map(m => ({
      month: m.label.charAt(0).toUpperCase() + m.label.slice(1),
      eventos: events.filter(e => {
        const d = new Date(e.created_at);
        return d >= m.start && d < m.end;
      }).length,
      integrantes: scouts.filter(s => {
        const d = new Date(s.created_at);
        return d >= m.start && d < m.end;
      }).length,
    }));
  }, [events, scouts]);

  // Media type breakdown
  const mediaBreakdown = useMemo(() => {
    const photos = images.filter(i => i.media_type !== 'video').length;
    const videos = images.filter(i => i.media_type === 'video').length;
    const eventPhotos = images.filter(i => i.event_id && i.media_type !== 'video').length;
    const memberPhotos = images.filter(i => !i.event_id && i.media_type !== 'video').length;
    return { photos, videos, total: images.length, eventPhotos, memberPhotos };
  }, [images]);

  // Top uploaders (admin only)
  const topUploaders = useMemo(() => {
    if (!isAdmin) return [];
    const counts: Record<string, number> = {};
    images.forEach(img => {
      counts[img.user_id] = (counts[img.user_id] || 0) + 1;
    });
    const profileMap = new Map(profiles.map(p => [p.user_id, p.name]));
    return Object.entries(counts)
      .map(([user_id, count]) => ({
        user_id,
        name: profileMap.get(user_id) || 'Desconhecido',
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [images, profiles, isAdmin]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <BarChart3 className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold tracking-tight">Métricas e Atividade</h2>
      </div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { icon: ImageIcon, value: mediaBreakdown.photos, label: 'Fotos', color: 'text-blue-600' },
          { icon: Film, value: mediaBreakdown.videos, label: 'Vídeos', color: 'text-purple-600' },
          { icon: ImageIcon, value: mediaBreakdown.eventPhotos, label: 'Fotos de Eventos', color: 'text-emerald-600' },
          { icon: ImageIcon, value: mediaBreakdown.memberPhotos, label: 'Fotos de Integrantes', color: 'text-amber-600' },
        ].map((stat, i) => (
          <Card key={i} className="border bg-card shadow-sm">
            <CardContent className="flex items-center gap-3 p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                <stat.icon className={`h-4.5 w-4.5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xl font-bold tracking-tight">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className={`grid grid-cols-1 gap-6 ${isAdmin ? 'lg:grid-cols-3' : 'lg:grid-cols-2'}`}>
        {/* Upload Activity Chart */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Upload className="h-4 w-4" /> Uploads por Mês
              <Badge className="ml-auto text-xs bg-primary/10 text-primary border-0">
                6 meses
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<ChartSkeleton />}>
              <RechartsBar
                data={monthlyUploads}
                xKey="month"
                bars={[
                  { dataKey: 'fotos', name: 'Fotos', color: 'hsl(217, 91%, 60%)', stackId: 'uploads' },
                  { dataKey: 'videos', name: 'Vídeos', color: 'hsl(271, 91%, 65%)', stackId: 'uploads' },
                ]}
              />
            </Suspense>
          </CardContent>
        </Card>

        {/* Growth Chart */}
        <Card className="border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" /> Crescimento Mensal
              <Badge className="ml-auto text-xs bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-0">
                6 meses
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Suspense fallback={<ChartSkeleton />}>
              <RechartsBar
                data={monthlyGrowth}
                xKey="month"
                bars={[
                  { dataKey: 'eventos', name: 'Eventos', color: 'hsl(142, 71%, 45%)' },
                  { dataKey: 'integrantes', name: 'Integrantes', color: 'hsl(38, 92%, 50%)' },
                ]}
              />
            </Suspense>
          </CardContent>
        </Card>

        {/* Top Uploaders (admin only) */}
        {isAdmin && (
          <Card className="border shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <User className="h-4 w-4" /> Top Contribuidores
                <Badge className="ml-auto text-xs bg-primary/10 text-primary border-0">
                  Top 5
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {topUploaders.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
              ) : (
                <div className="space-y-2">
                  {topUploaders.map((u, i) => {
                    const maxCount = topUploaders[0]?.count || 1;
                    const pct = Math.round((u.count / maxCount) * 100);
                    return (
                      <div key={u.user_id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {i + 1}
                            </span>
                            <span className="font-medium uppercase text-xs break-words" style={{ overflowWrap: 'anywhere' }}>
                              {u.name}
                            </span>
                          </div>
                          <Badge variant="secondary" className="text-xs">{u.count}</Badge>
                        </div>
                        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary/60 transition-all duration-500"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default DashboardMetrics;
