import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  ChevronLeft, 
  ChevronRight, 
  MapPin, 
  Calendar as CalIcon, 
  Clock,
  X,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  startOfWeek,
  endOfWeek,
  isToday,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { parseLocalDate } from '@/lib/scoutUtils';

interface CalendarItem {
  id: string;
  title: string;
  date: Date;
  time?: string;
  location?: string;
  type: 'event';
  branchId?: string;
  description?: string;
}

interface Branch {
  id: string;
  key: string;
  display_name: string;
  icon: string;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const LONG_DESCRIPTION_LIMIT = 180;

const InformativoSection = ({ description }: { description: string }) => {
  const [expanded, setExpanded] = useState(false);
  const isLong = description.length > LONG_DESCRIPTION_LIMIT;
  const visibleText = isLong && !expanded
    ? `${description.slice(0, LONG_DESCRIPTION_LIMIT).trimEnd()}…`
    : description;

  return (
    <div
      data-testid="informativo-section"
      className="rounded-lg border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900/50 p-2.5"
    >
      <p className="text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300 mb-1">
        Informativo
      </p>
      <p className="text-xs text-foreground/90 leading-relaxed whitespace-pre-line">
        {visibleText}
      </p>
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(v => !v)}
          className="mt-1.5 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide text-blue-700 dark:text-blue-300 hover:underline"
        >
          {expanded ? 'Ver menos' : 'Ver mais'}
          {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      )}
    </div>
  );
};



const ScoutCalendar = () => {
  const { roles } = useAuth();
  const [events, setEvents] = useState<any[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const [eventsRes, branchesRes] = await Promise.all([
        supabase.from('events').select('*'),
        supabase.from('branches').select('*')
      ]);

      setEvents(eventsRes.data || []);
      setBranches(branchesRes.data || []);
      setLoading(false);
    };

    fetchData();
  }, []);

  const calendarItems = useMemo(() => {
    const items: CalendarItem[] = [];

    events.forEach(e => {
      if (e.event_date) {
        items.push({
          id: e.id,
          title: e.name,
          date: parseLocalDate(e.event_date),
          location: e.location,
          type: 'event',
          branchId: e.branch_id,
          description: e.description
        });
      }
    });

    return items;
  }, [events]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getItemsForDay = (day: Date) =>
    calendarItems.filter(item => isSameDay(item.date, day));

  const selectedItems = useMemo(() => getItemsForDay(selectedDate), [selectedDate, calendarItems]);

  const getBranch = (bId?: string) =>
    bId ? branches.find(b => b.id === bId) : null;

  return (
    <div className="flex flex-col h-full bg-background animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Agenda do Grupo</h1>
          <p className="text-muted-foreground">Visualize os eventos na agenda</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full min-h-[600px]">
        {/* Main Calendar Grid */}
        <Card className={cn(
          "overflow-hidden border-none shadow-md bg-card transition-all duration-300",
          showDetails ? "lg:col-span-8" : "lg:col-span-12"
        )}>
          <div className="p-4 border-b flex items-center justify-between bg-muted/30">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-bold capitalize text-foreground">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </h2>
              <div className="flex items-center border rounded-md overflow-hidden bg-background">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 rounded-none border-r"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  className="h-8 px-3 rounded-none text-xs font-medium"
                  onClick={() => {
                    setCurrentMonth(new Date());
                    setSelectedDate(new Date());
                  }}
                >
                  Hoje
                </Button>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-8 w-8 rounded-none border-l"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-7 border-b bg-muted/20">
            {WEEKDAYS.map(day => (
              <div key={day} className="py-2 text-center text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 grid-rows-6 h-[500px] sm:h-[600px]">
            {days.map((day, i) => {
              const dayItems = getItemsForDay(day);
              const isCurrMonth = isSameMonth(day, currentMonth);
              const isSel = isSameDay(day, selectedDate);
              const isTod = isToday(day);

              return (
                <div
                  key={i}
                  onClick={() => {
                    setSelectedDate(day);
                    setShowDetails(true);
                  }}
                  className={cn(
                    "relative flex flex-col border-r border-b group cursor-pointer transition-colors p-1 overflow-hidden",
                    !isCurrMonth && "bg-muted/10 text-muted-foreground/40",
                    isSel && "bg-primary/5 ring-1 ring-inset ring-primary/20",
                    "hover:bg-accent/50"
                  )}
                >
                  <span className={cn(
                    "inline-flex items-center justify-center h-6 w-6 text-xs font-medium rounded-full mb-1 transition-colors",
                    isTod ? "bg-primary text-primary-foreground font-bold shadow-sm" : 
                    isSel ? "text-primary bg-primary/10" : "text-foreground group-hover:bg-muted"
                  )}>
                    {format(day, 'd')}
                  </span>

                  <div className="flex flex-col gap-0.5 overflow-y-auto scrollbar-none">
                    {dayItems.slice(0, 3).map((item) => (
                      <div 
                        key={item.id}
                        className="px-1.5 py-0.5 text-[9px] font-medium rounded truncate border bg-blue-500/10 text-blue-700 border-blue-200 dark:border-blue-900 dark:text-blue-300"
                      >
                        {item.title}
                      </div>
                    ))}
                    {dayItems.length > 3 && (
                      <div className="text-[9px] font-bold text-muted-foreground pl-1 mt-0.5">
                        + {dayItems.length - 3} mais
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Sidebar Details - Toggleable */}
        {showDetails && (
          <div className="lg:col-span-4 animate-in slide-in-from-right duration-300">
            <Card className="border-none shadow-md overflow-hidden bg-card h-full relative">
              <Button 
                variant="ghost" 
                size="icon" 
                className="absolute right-2 top-2 z-10 h-8 w-8 rounded-full bg-background/50 hover:bg-background"
                onClick={() => setShowDetails(false)}
              >
                <X className="h-4 w-4" />
              </Button>

              <div className="p-4 border-b bg-muted/30">
                <h3 className="text-lg font-bold text-foreground">
                  {format(selectedDate, "EEEE, d 'de' MMMM", { locale: ptBR })}
                </h3>
                {isToday(selectedDate) && (
                  <Badge variant="secondary" className="mt-1 text-[10px] font-bold uppercase tracking-tight">
                    Hoje
                  </Badge>
                )}
              </div>

              <CardContent className="p-4 overflow-y-auto max-h-[600px] scrollbar-thin">
                {selectedItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                    <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-3">
                      <CalIcon className="h-6 w-6 opacity-40" />
                    </div>
                    <p className="text-sm font-medium">Nenhum evento agendado</p>
                    <p className="text-xs mt-1">Clique em um dia com eventos para ver detalhes</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {selectedItems.map((item) => {
                      const branch = getBranch(item.branchId);
                      return (
                        <div 
                          key={item.id}
                          className="relative overflow-hidden rounded-xl border p-4 transition-all hover:shadow-md border-l-4 border-l-blue-500 bg-blue-50/30 dark:bg-blue-950/10"
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <h4 className="font-bold text-base text-foreground leading-tight">
                              {item.title}
                            </h4>
                            <Badge className="text-[10px] px-1.5 h-5 font-bold uppercase tracking-tight bg-blue-600 hover:bg-blue-700">
                              Evento
                            </Badge>
                          </div>

                          <div className="space-y-2.5">
                            {item.description && (
                              <InformativoSection description={item.description} />
                            )}

                            {item.time && (
                              <div className="flex items-center gap-2 text-sm text-foreground/80 font-medium">
                                <Clock className="h-4 w-4 text-blue-500" />
                                <span>{item.time}</span>
                              </div>
                            )}

                            {item.location && (
                              <div className="flex items-start gap-2 text-sm text-foreground/80">
                                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                                <span className="leading-tight">{item.location}</span>
                              </div>
                            )}

                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {branch && (
                                <Badge variant="secondary" className="h-5 px-1.5 text-[9px] font-bold uppercase bg-muted/50 border-none">
                                  {branch.icon} {branch.display_name}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
};

export default ScoutCalendar;