import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Sparkles, ArrowRightLeft, Camera, UserPlus, Calendar, Trophy } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { parseLocalDate } from '@/lib/scoutUtils';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Props {
  scoutId: string;
  scoutCreatedAt: string;
  scoutBirthDate: string;
  transitionDate?: string | null;
  admissionDate?: string | null;
  currentSection?: string | null;

}

type ItemType = 'ingresso' | 'transicao' | 'secao' | 'fotos' | 'aniversario' | 'conquista';

interface TimelineItem {
  id: string;
  type: ItemType;
  date: Date;
  title: string;
  description?: string;
}

const TYPE_CONFIG: Record<ItemType, { icon: typeof Sparkles; color: string; bg: string; ring: string; label: string }> = {
  ingresso:    { icon: UserPlus,       color: 'text-primary',     bg: 'bg-primary/10',     ring: 'border-primary',     label: 'Ingresso' },
  transicao:   { icon: ArrowRightLeft, color: 'text-amber-600',   bg: 'bg-amber-500/10',   ring: 'border-amber-500',   label: 'Transição' },
  secao:       { icon: Sparkles,       color: 'text-indigo-600',  bg: 'bg-indigo-500/10',  ring: 'border-indigo-500',  label: 'Seção' },
  fotos:       { icon: Camera,         color: 'text-emerald-600', bg: 'bg-emerald-500/10', ring: 'border-emerald-500', label: 'Fotos' },
  aniversario: { icon: Calendar,       color: 'text-rose-600',    bg: 'bg-rose-500/10',    ring: 'border-rose-500',    label: 'Aniversário' },
  conquista:   { icon: Trophy,         color: 'text-fuchsia-600', bg: 'bg-fuchsia-500/10', ring: 'border-fuchsia-500', label: 'Conquista' },
};

const ALL_TYPES: ItemType[] = ['ingresso', 'transicao', 'secao', 'fotos', 'aniversario', 'conquista'];

const ScoutTimeline = ({ scoutId, scoutCreatedAt, scoutBirthDate, transitionDate, currentSection, admissionDate }: Props) => {
  const [items, setItems] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTypes, setActiveTypes] = useState<Set<ItemType>>(new Set(ALL_TYPES));
  const [yearFilter, setYearFilter] = useState<string>('all');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const list: TimelineItem[] = [];

      list.push({
        id: 'ingresso',
        type: 'ingresso',
        date: admissionDate ? parseLocalDate(admissionDate) : new Date(scoutCreatedAt),
        title: 'Ingresso no grupo',
        description: currentSection ? `Seção: ${currentSection}` : undefined,
      });

      if (transitionDate) {
        list.push({
          id: 'transicao',
          type: 'transicao',
          date: parseLocalDate(transitionDate),
          title: 'Transição de ramo',
        });
      }

      const { data: audits } = await supabase
        .from('audit_logs')
        .select('id, action, created_at, before_data, after_data, details')
        .or(`details->>scout_id.eq.${scoutId},after_data->>scout_id.eq.${scoutId},details->>id.eq.${scoutId}`)
        .in('action', ['section_change', 'data_update'])
        .order('created_at', { ascending: false })
        .limit(200);

      (audits || []).forEach((a: any) => {
        const before = a.before_data?.section;
        const after = a.after_data?.section;
        if (a.action === 'section_change' || (before && after && before !== after)) {
          list.push({
            id: `audit-${a.id}`,
            type: 'secao',
            date: new Date(a.created_at),
            title: 'Mudança de seção',
            description: before && after ? `${before} → ${after}` : undefined,
          });
        }
      });

      const { data: photos } = await supabase
        .from('scout_photos')
        .select('id, created_at')
        .eq('scout_id', scoutId)
        .order('created_at', { ascending: false })
        .limit(500);

      const byMonth = new Map<string, number>();
      (photos || []).forEach((p: any) => {
        const d = new Date(p.created_at);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        byMonth.set(key, (byMonth.get(key) || 0) + 1);
      });
      byMonth.forEach((count, key) => {
        const [y, m] = key.split('-').map(Number);
        list.push({
          id: `photos-${key}`,
          type: 'fotos',
          date: new Date(y, m - 1, 15),
          title: `${count} ${count === 1 ? 'foto adicionada' : 'fotos adicionadas'}`,
          description: format(new Date(y, m - 1, 1), "MMMM 'de' yyyy", { locale: ptBR }),
        });
      });

      const birth = parseLocalDate(scoutBirthDate);
      const start = admissionDate ? parseLocalDate(admissionDate) : new Date(scoutCreatedAt);
      const today = new Date();
      let year = start.getFullYear();
      while (year <= today.getFullYear()) {
        const bday = new Date(year, birth.getMonth(), birth.getDate());
        if (bday >= start && bday <= today) {
          const age = year - birth.getFullYear();
          list.push({
            id: `bday-${year}`,
            type: 'aniversario',
            date: bday,
            title: `${age}º aniversário`,
          });
        }
        year++;
      }

      const { data: achievements } = await supabase
        .from('scout_achievements')
        .select('id, type, name, achievement_date, description')
        .eq('scout_id', scoutId)
        .order('achievement_date', { ascending: false })
        .limit(500);

      (achievements || []).forEach((a: any) => {
        list.push({
          id: `ach-${a.id}`,
          type: 'conquista',
          date: parseLocalDate(a.achievement_date),
          title: a.name,
          description: a.description || undefined,
        });
      });

      list.sort((a, b) => b.date.getTime() - a.date.getTime());

      if (!cancelled) {
        setItems(list);
        setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [scoutId, scoutCreatedAt, scoutBirthDate, transitionDate, currentSection, admissionDate]);

  const years = useMemo(() => {
    const set = new Set<number>();
    items.forEach((i) => set.add(i.date.getFullYear()));
    return Array.from(set).sort((a, b) => b - a);
  }, [items]);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (!activeTypes.has(i.type)) return false;
      if (yearFilter !== 'all' && i.date.getFullYear() !== Number(yearFilter)) return false;
      return true;
    });
  }, [items, activeTypes, yearFilter]);

  const toggle = (t: ItemType) => {
    setActiveTypes((prev) => {
      const next = new Set(prev);
      if (next.has(t)) next.delete(t);
      else next.add(t);
      // Avoid empty: if user deselected all, restore that one
      if (next.size === 0) next.add(t);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
        <Sparkles className="mx-auto mb-2 h-6 w-6 opacity-60" />
        Nenhum marco para exibir ainda.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {ALL_TYPES.map((t) => {
          const cfg = TYPE_CONFIG[t];
          const active = activeTypes.has(t);
          const Icon = cfg.icon;
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggle(t)}
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs transition-colors',
                active ? `${cfg.bg} ${cfg.ring} ${cfg.color} font-medium` : 'border-border bg-muted/40 text-muted-foreground hover:bg-muted'
              )}
            >
              <Icon className="h-3 w-3" />
              {cfg.label}
            </button>
          );
        })}
        <div className="ml-auto">
          <Select value={yearFilter} onValueChange={setYearFilter}>
            <SelectTrigger className="h-8 w-[110px] text-xs">
              <SelectValue placeholder="Ano" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos anos</SelectItem>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
          Nenhum marco com os filtros atuais.
        </div>
      ) : (
        <div className="relative space-y-0 pl-2">
          {filtered.map((item, i) => {
            const cfg = TYPE_CONFIG[item.type];
            const Icon = cfg.icon;
            const isLast = i === filtered.length - 1;
            return (
              <div key={item.id} className="relative flex gap-3 pb-4">
                {!isLast && <div className="absolute left-[15px] top-[32px] bottom-0 w-0.5 bg-border" />}
                <div className={cn('relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2', cfg.ring, cfg.bg)}>
                  <Icon className={cn('h-4 w-4', cfg.color)} />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{item.title}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(item.date, "dd 'de' MMM 'de' yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  {item.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="pt-1 text-center text-xs text-muted-foreground">
        Mostrando {filtered.length} de {items.length} {items.length === 1 ? 'marco' : 'marcos'}
      </p>
    </div>
  );
};

export default ScoutTimeline;
