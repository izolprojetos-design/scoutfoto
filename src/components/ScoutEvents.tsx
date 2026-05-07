import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Calendar, Camera, Inbox } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Props {
  scoutId: string;
}

interface EventGroup {
  key: string;
  label: string;
  count: number;
  firstDate: Date;
  lastDate: Date;
  hasCaption: boolean;
}

const ScoutEvents = ({ scoutId }: Props) => {
  const [groups, setGroups] = useState<EventGroup[]>([]);
  const [totalUntagged, setTotalUntagged] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('scout_photos')
        .select('caption, created_at')
        .eq('scout_id', scoutId)
        .order('created_at', { ascending: false })
        .limit(2000);

      const map = new Map<string, EventGroup>();
      let untagged = 0;

      (data || []).forEach((p: any) => {
        const caption = (p.caption || '').trim();
        const d = new Date(p.created_at);
        if (!caption) {
          untagged++;
          return;
        }
        const key = caption.toLowerCase();
        const existing = map.get(key);
        if (existing) {
          existing.count++;
          if (d < existing.firstDate) existing.firstDate = d;
          if (d > existing.lastDate) existing.lastDate = d;
        } else {
          map.set(key, { key, label: caption, count: 1, firstDate: d, lastDate: d, hasCaption: true });
        }
      });

      const list = Array.from(map.values()).sort((a, b) => b.lastDate.getTime() - a.lastDate.getTime());

      if (!cancelled) {
        setGroups(list);
        setTotalUntagged(untagged);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [scoutId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (groups.length === 0 && totalUntagged === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        <Inbox className="mx-auto mb-2 h-6 w-6 opacity-60" />
        Nenhum evento ou foto registrada para este integrante.
      </div>
    );
  }

  const fmt = (d: Date) => format(d, "dd 'de' MMM 'de' yyyy", { locale: ptBR });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>{groups.length} {groups.length === 1 ? 'evento identificado' : 'eventos identificados'}</span>
        {totalUntagged > 0 && (
          <span>+ {totalUntagged} {totalUntagged === 1 ? 'foto' : 'fotos'} sem evento</span>
        )}
      </div>

      <div className="space-y-2">
        {groups.map((g) => {
          const sameDay = g.firstDate.toDateString() === g.lastDate.toDateString();
          return (
            <div key={g.key} className="rounded-lg border bg-card p-3 hover:bg-accent/40 transition-colors">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-sm break-words">{g.label}</p>
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {sameDay ? fmt(g.firstDate) : `${fmt(g.firstDate)} → ${fmt(g.lastDate)}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-700 shrink-0">
                  <Camera className="h-3 w-3" />
                  {g.count}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {totalUntagged > 0 && (
        <p className="text-[11px] text-muted-foreground text-center pt-2">
          Dica: adicione legendas às fotos para que apareçam aqui como eventos.
        </p>
      )}
    </div>
  );
};

export default ScoutEvents;
