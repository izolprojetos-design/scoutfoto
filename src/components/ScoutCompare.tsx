import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { differenceInMonths, differenceInYears } from 'date-fns';
import { Camera, Calendar, Trophy, Clock, Cake, X, Users, Search } from 'lucide-react';
import { parseLocalDate, formatAge, getCurrentBranch, ALL_CATEGORIES } from '@/lib/scoutUtils';
import ScoutPhoto from '@/components/ScoutPhoto';

interface ScoutLite {
  id: string;
  name: string;
  photo_url: string | null;
  birth_date: string;
  created_at: string;
  section: string;
  subgroup_id: string | null;
  manual_branch: string | null;
}

interface Subgroup { id: string; name: string }

interface CompareStats {
  photos: number;
  events: number;
  achievements: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  scouts: ScoutLite[];
  subgroups: Subgroup[];
  initialIds?: string[];
}

const MAX_COMPARE = 4;

const ScoutCompare = ({ open, onOpenChange, scouts, subgroups, initialIds = [] }: Props) => {
  const [selected, setSelected] = useState<string[]>(initialIds);
  const [search, setSearch] = useState('');
  const [statsMap, setStatsMap] = useState<Record<string, CompareStats>>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setSelected(initialIds.slice(0, MAX_COMPARE));
    if (!open) { setSearch(''); setStatsMap({}); }
  }, [open]);

  // Fetch stats for selected scouts
  useEffect(() => {
    if (!open || selected.length === 0) return;
    const missing = selected.filter(id => !statsMap[id]);
    if (missing.length === 0) return;
    setLoading(true);
    (async () => {
      const results = await Promise.all(missing.map(async (id) => {
        const [{ count: photos }, { count: achievements }, { data: evRows }] = await Promise.all([
          supabase.from('scout_photos').select('id', { count: 'exact', head: true }).eq('scout_id', id),
          supabase.from('scout_achievements').select('id', { count: 'exact', head: true }).eq('scout_id', id),
          supabase.from('scout_photos').select('caption').eq('scout_id', id).limit(1000),
        ]);
        const events = new Set((evRows || []).map((r: any) => r.caption).filter(Boolean)).size;
        return [id, { photos: photos || 0, events, achievements: achievements || 0 }] as const;
      }));
      setStatsMap(prev => {
        const next = { ...prev };
        for (const [id, s] of results) next[id] = s;
        return next;
      });
      setLoading(false);
    })();
  }, [selected, open]);

  const toggle = (id: string) => {
    setSelected(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, id];
    });
  };

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    return scouts.filter(s => !term || s.name.toLowerCase().includes(term));
  }, [scouts, search]);

  const selectedScouts = selected.map(id => scouts.find(s => s.id === id)).filter(Boolean) as ScoutLite[];

  const subgroupName = (id: string | null) => id ? (subgroups.find(s => s.id === id)?.name || '—') : '—';

  const branchFor = (s: ScoutLite) => {
    if (s.manual_branch) return ALL_CATEGORIES.find(b => b.key === s.manual_branch) || null;
    return getCurrentBranch(parseLocalDate(s.birth_date));
  };

  const tenure = (s: ScoutLite) => {
    const months = differenceInMonths(new Date(), new Date(s.created_at));
    const y = Math.floor(months / 12);
    const m = months % 12;
    if (y >= 1) return `${y}a ${m}m`;
    return `${m}m`;
  };

  // Compute leaders for highlighting
  const maxOf = (key: keyof CompareStats) => {
    const vals = selectedScouts.map(s => statsMap[s.id]?.[key] ?? 0);
    return vals.length ? Math.max(...vals) : 0;
  };
  const oldestAge = selectedScouts.length
    ? Math.max(...selectedScouts.map(s => differenceInYears(new Date(), parseLocalDate(s.birth_date))))
    : 0;
  const longestTenure = selectedScouts.length
    ? Math.max(...selectedScouts.map(s => differenceInMonths(new Date(), new Date(s.created_at))))
    : 0;

  const isLeader = (val: number, max: number) => max > 0 && val === max;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Comparar integrantes
          </DialogTitle>
          <DialogDescription>
            Selecione até {MAX_COMPARE} integrantes para comparar lado a lado.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 md:grid-cols-[260px_1fr]">
          {/* Selector */}
          <div className="border rounded-lg p-2 bg-card">
            <div className="relative mb-2">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-7 h-9 text-sm"
              />
            </div>
            <p className="text-[11px] text-muted-foreground mb-2 px-1">
              {selected.length}/{MAX_COMPARE} selecionados • {filtered.length} disponíveis
            </p>
            <ScrollArea className="h-[420px] pr-2">
              <div className="space-y-1">
                {filtered.map(s => {
                  const checked = selected.includes(s.id);
                  const disabled = !checked && selected.length >= MAX_COMPARE;
                  return (
                    <label
                      key={s.id}
                      className={`flex items-center gap-2 rounded-md p-1.5 cursor-pointer transition-colors ${checked ? 'bg-primary/10' : 'hover:bg-muted'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
                    >
                      <Checkbox
                        checked={checked}
                        disabled={disabled}
                        onCheckedChange={() => toggle(s.id)}
                      />
                      <span className="text-xs uppercase font-medium truncate" title={s.name}>{s.name}</span>
                    </label>
                  );
                })}
                {filtered.length === 0 && (
                  <p className="text-xs text-muted-foreground p-2 text-center">Nenhum integrante</p>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Comparison */}
          <div className="min-w-0">
            {selectedScouts.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[420px] text-center text-muted-foreground border rounded-lg bg-card">
                <Users className="h-10 w-10 mb-2 opacity-50" />
                <p className="text-sm">Selecione integrantes ao lado para comparar</p>
              </div>
            ) : (
              <div className={`grid gap-3 ${selectedScouts.length === 1 ? 'grid-cols-1' : selectedScouts.length === 2 ? 'grid-cols-2' : selectedScouts.length === 3 ? 'grid-cols-3' : 'grid-cols-2 lg:grid-cols-4'}`}>
                {selectedScouts.map(s => {
                  const stats = statsMap[s.id];
                  const branch = branchFor(s);
                  const ageY = differenceInYears(new Date(), parseLocalDate(s.birth_date));
                  const tenureM = differenceInMonths(new Date(), new Date(s.created_at));
                  return (
                    <Card key={s.id} className="overflow-hidden">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start justify-between gap-1">
                          <div className="flex flex-col items-center w-full">
                            {s.photo_url ? (
                              <ScoutPhoto
                                photoUrl={s.photo_url}
                                alt={s.name}
                                className="h-16 w-16 rounded-full object-cover object-top ring-2 ring-muted"
                                fallback={
                                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl ring-2 ring-muted">
                                    {branch?.icon || '⚜️'}
                                  </div>
                                }
                              />
                            ) : (
                              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl ring-2 ring-muted">
                                {branch?.icon || '⚜️'}
                              </div>
                            )}
                          </div>
                          <Button variant="ghost" size="icon" className="h-6 w-6 -mr-1 -mt-1" onClick={() => toggle(s.id)}>
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                        <h4 className="text-xs font-bold uppercase text-center break-words leading-tight" style={{ overflowWrap: 'anywhere' }}>{s.name}</h4>
                        {branch && (
                          <Badge variant="secondary" className="w-full justify-center text-[10px] font-normal">
                            {branch.icon} {branch.name}
                          </Badge>
                        )}
                        <div className="space-y-1.5 pt-1 border-t">
                          <Row icon={Cake} label="Idade" value={formatAge(parseLocalDate(s.birth_date))} highlight={isLeader(ageY, oldestAge)} />
                          <Row icon={Clock} label="No grupo" value={tenure(s)} highlight={isLeader(tenureM, longestTenure)} />
                          <Row icon={Camera} label="Fotos" value={stats ? String(stats.photos) : '…'} highlight={!!stats && isLeader(stats.photos, maxOf('photos'))} />
                          <Row icon={Calendar} label="Eventos" value={stats ? String(stats.events) : '…'} highlight={!!stats && isLeader(stats.events, maxOf('events'))} />
                          <Row icon={Trophy} label="Conquistas" value={stats ? String(stats.achievements) : '…'} highlight={!!stats && isLeader(stats.achievements, maxOf('achievements'))} />
                          <Row label="Seção" value={s.section || '—'} />
                          <Row label="Equipe" value={subgroupName(s.subgroup_id)} />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

const Row = ({ icon: Icon, label, value, highlight }: { icon?: any; label: string; value: string; highlight?: boolean }) => (
  <div className={`flex items-center justify-between gap-2 text-xs rounded px-1 py-0.5 ${highlight ? 'bg-amber-500/15 text-amber-900 dark:text-amber-200 font-semibold' : ''}`}>
    <span className="flex items-center gap-1 text-muted-foreground">
      {Icon && <Icon className="h-3 w-3" />}
      {label}
    </span>
    <span className="font-medium truncate" title={value}>{value}</span>
  </div>
);

export default ScoutCompare;
