import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, MapPin, Calendar as CalIcon } from 'lucide-react';
import { motion } from 'framer-motion';
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

interface CalendarEvent {
  id: string;
  name: string;
  description: string | null;
  event_date: string | null;
  location: string | null;
  branch_id: string | null;
}

interface Branch {
  id: string;
  key: string;
  display_name: string;
  icon: string;
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const ScoutCalendar = () => {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      supabase.from('events').select('*').order('event_date'),
      supabase.from('branches').select('*'),
    ]).then(([{ data: evts }, { data: br }]) => {
      setEvents(evts || []);
      setBranches(br || []);
      setLoading(false);
    });
  }, []);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });

  const getEventsForDay = (day: Date) =>
    events.filter(e => e.event_date && isSameDay(new Date(e.event_date), day));

  const selectedEvents = selectedDate
    ? getEventsForDay(selectedDate)
    : [];

  const getBranch = (bId: string | null) =>
    bId ? branches.find(b => b.id === bId) : null;

  return (
    <AppLayout>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Calendário Escoteiro</h1>
        <p className="mt-1 text-muted-foreground">Atividades e eventos do grupo</p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Calendar Grid */}
        <Card className="lg:col-span-2 border shadow-sm">
          <CardContent className="p-4 sm:p-6">
            {/* Month Navigation */}
            <div className="mb-6 flex items-center justify-between">
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
                <ChevronLeft className="h-5 w-5" />
              </Button>
              <h2 className="text-xl font-semibold capitalize">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </h2>
              <Button variant="ghost" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
                <ChevronRight className="h-5 w-5" />
              </Button>
            </div>

            {/* Weekday Headers */}
            <div className="mb-2 grid grid-cols-7 gap-1">
              {WEEKDAYS.map(d => (
                <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">
                  {d}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1">
              {days.map((day, i) => {
                const dayEvents = getEventsForDay(day);
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const today = isToday(day);

                return (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.005 }}
                    className={`relative flex flex-col items-center rounded-lg p-2 text-sm transition-colors min-h-[60px] ${
                      !isCurrentMonth
                        ? 'text-muted-foreground/40'
                        : isSelected
                        ? 'bg-primary text-primary-foreground'
                        : today
                        ? 'bg-primary/10 text-primary font-semibold'
                        : 'hover:bg-muted'
                    }`}
                    onClick={() => setSelectedDate(day)}
                  >
                    <span className={`text-sm ${today && !isSelected ? 'font-bold' : ''}`}>
                      {format(day, 'd')}
                    </span>
                    {dayEvents.length > 0 && (
                      <div className="mt-1 flex gap-0.5">
                        {dayEvents.slice(0, 3).map((_, idx) => (
                          <div
                            key={idx}
                            className={`h-1.5 w-1.5 rounded-full ${
                              isSelected ? 'bg-primary-foreground' : 'bg-primary'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                  </motion.button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Event Details Sidebar */}
        <Card className="border shadow-sm">
          <CardContent className="p-5">
            <h3 className="text-lg font-semibold mb-4">
              {selectedDate
                ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR })
                : 'Selecione um dia'}
            </h3>

            {selectedDate && selectedEvents.length === 0 && (
              <div className="flex flex-col items-center py-8 text-muted-foreground">
                <CalIcon className="h-8 w-8 mb-2" />
                <p className="text-sm">Nenhum evento neste dia</p>
              </div>
            )}

            <div className="space-y-3">
              {selectedEvents.map(event => {
                const branch = getBranch(event.branch_id);
                return (
                  <motion.div
                    key={event.id}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="rounded-lg border bg-muted/30 p-4"
                  >
                    <h4 className="font-semibold">{event.name}</h4>
                    {event.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{event.description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap gap-2">
                      {event.location && (
                        <Badge variant="outline" className="gap-1 font-normal text-xs">
                          <MapPin className="h-3 w-3" />
                          {event.location}
                        </Badge>
                      )}
                      {branch && (
                        <Badge variant="secondary" className="font-normal text-xs">
                          {branch.icon} {branch.display_name}
                        </Badge>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>

            {/* Upcoming events */}
            {!selectedDate && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground mb-3">Próximos eventos:</p>
                {events
                  .filter(e => e.event_date && new Date(e.event_date) >= new Date())
                  .slice(0, 5)
                  .map(event => (
                    <div key={event.id} className="rounded-lg border bg-muted/30 p-3">
                      <p className="font-medium text-sm">{event.name}</p>
                      {event.event_date && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {format(new Date(event.event_date), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default ScoutCalendar;
