import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Camera, Calendar, Clock, ArrowRightLeft, Cake, Trophy } from 'lucide-react';
import { differenceInYears, differenceInMonths } from 'date-fns';
import { parseLocalDate, getNextBranchChange, formatTimeLeft, formatAge, getCurrentBranch, calculateAgeInMonths } from '@/lib/scoutUtils';

interface Props {
  scoutId: string;
  scoutCreatedAt: string;
  scoutBirthDate: string;
  admissionDate?: string | null;
}


interface Stats {
  photos: number;
  events: number;
  achievements: number;
}

const ScoutStats = ({ scoutId, scoutCreatedAt, scoutBirthDate, admissionDate }: Props) => {
  const [stats, setStats] = useState<Stats>({ photos: 0, events: 0, achievements: 0 });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [{ count: photos }, { data: eventRows }, { count: achievements }] = await Promise.all([
        supabase.from('scout_photos').select('id', { count: 'exact', head: true }).eq('scout_id', scoutId),
        supabase.from('scout_photos').select('caption').eq('scout_id', scoutId).limit(1000),
        supabase.from('scout_achievements').select('id', { count: 'exact', head: true }).eq('scout_id', scoutId),
      ]);
      // event count: distinct captions (proxy when no event_id link); fallback to 0
      const events = new Set((eventRows || []).map((r: any) => r.caption).filter(Boolean)).size;
      if (!cancelled) setStats({ photos: photos || 0, events, achievements: achievements || 0 });
    })();
    return () => { cancelled = true; };
  }, [scoutId]);

  const birth = parseLocalDate(scoutBirthDate);
  const created = admissionDate ? parseLocalDate(admissionDate) : new Date(scoutCreatedAt);
  const yearsInGroup = differenceInYears(new Date(), created);
  const monthsInGroup = differenceInMonths(new Date(), created);
  const next = getNextBranchChange(birth);
  const age = formatAge(birth);
  const branch = getCurrentBranch(birth);
  const isAdult = branch?.key === 'voluntario' || calculateAgeInMonths(birth) >= 252;

  const items = [
    { icon: Cake, label: 'Idade', value: age, color: 'text-rose-600 bg-rose-500/10' },
    { icon: Clock, label: 'No grupo', value: yearsInGroup >= 1 ? `${yearsInGroup} ${yearsInGroup === 1 ? 'ano' : 'anos'}` : `${monthsInGroup} ${monthsInGroup === 1 ? 'mês' : 'meses'}`, color: 'text-primary bg-primary/10' },
    { icon: Camera, label: 'Fotos', value: String(stats.photos), color: 'text-emerald-600 bg-emerald-500/10' },
    { icon: Calendar, label: 'Eventos', value: String(stats.events), color: 'text-indigo-600 bg-indigo-500/10' },
    { icon: Trophy, label: 'Conquistas', value: String(stats.achievements), color: 'text-fuchsia-600 bg-fuchsia-500/10' },
    ...(!isAdult && next ? [{ icon: ArrowRightLeft, label: 'Próximo ramo', value: `${next.branch.icon} ${formatTimeLeft(next.monthsLeft, next.daysLeft)}`, color: 'text-amber-600 bg-amber-500/10' }] : []),
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 rounded-lg border bg-card p-3">
      {items.map((it) => {
        const Icon = it.icon;
        return (
          <div key={it.label} className="flex items-start gap-2 p-2 rounded-md">
            <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${it.color}`}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{it.label}</p>
              <p className="text-sm font-semibold truncate" title={it.value}>{it.value}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ScoutStats;
