import { useState, useRef, useEffect } from 'react';
import { Bell, Check, CheckCheck, ShieldAlert, ShieldCheck, Info, X, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useNotifications, SecurityNotification } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

const PRIORITY_CONFIG = {
  high: { icon: ShieldAlert, color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/20', label: 'Alto' },
  medium: { icon: ShieldCheck, color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-500/10', border: 'border-yellow-500/20', label: 'Médio' },
  info: { icon: Info, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', label: 'Info' },
};

const TYPE_FILTER: Record<string, string> = {
  all: 'Todos',
  new_device: 'Dispositivos',
  password_changed: 'Senha',
  mfa_enabled: '2FA',
  mfa_disabled: '2FA',
  failed_attempts: 'Tentativas',
  account_locked: 'Bloqueios',
  login_success: 'Login',
  agendamento_response: 'Agendamentos',
};

const NotificationItem = ({ n, onRead, onDelete }: { n: SecurityNotification; onRead: (id: string) => void; onDelete: (id: string) => void }) => {
  const cfg = PRIORITY_CONFIG[n.priority];
  const Icon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: 20, height: 0, marginBottom: 0, padding: 0 }}
      layout
      onClick={() => { if (!n.is_read) onRead(n.id); }}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !n.is_read) { e.preventDefault(); onRead(n.id); } }}
      className={cn(
        'flex gap-3 rounded-lg border p-3 transition-colors cursor-pointer',
        n.is_read ? 'bg-muted/30 border-transparent opacity-60' : `${cfg.bg} ${cfg.border}`,
      )}
    >
      <Icon className={cn('h-5 w-5 mt-0.5 shrink-0', cfg.color)} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm font-medium leading-tight', !n.is_read && 'text-foreground')}>
            {n.title}
          </p>
          <div className="flex items-center gap-1 shrink-0">
            <span
              className={cn(
                'rounded-full px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide',
                n.is_read
                  ? 'bg-muted text-muted-foreground'
                  : 'bg-primary/15 text-primary',
              )}
            >
              {n.is_read ? 'Lida' : 'Não lida'}
            </span>
            {!n.is_read && (
              <button
                onClick={(e) => { e.stopPropagation(); onRead(n.id); }}
                className="rounded p-0.5 text-muted-foreground hover:text-foreground hover:bg-muted/50"
                title="Marcar como lida"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(n.id); }}
              className="rounded p-0.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              title="Excluir notificação"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{n.message}</p>
        <p className="text-[11px] text-muted-foreground/70 mt-1">
          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: ptBR })}
        </p>
      </div>
    </motion.div>
  );
};

const NotificationBell = () => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, markAllOfTypeAsRead, deleteNotification, deleteAllNotifications } = useNotifications();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    if (open) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const filtered = filter === 'all'
    ? notifications
    : notifications.filter(n => n.type === filter);

  const availableTypes = [...new Set(notifications.map(n => n.type))];
  const unreadAgendamentoCount = notifications.filter(n => n.type === 'agendamento_response' && !n.is_read).length;

  return (
    <div ref={ref} className="relative">
      <Button
        variant="ghost"
        size="icon"
        className={cn('relative h-9 w-9', unreadCount === 0 && 'text-muted-foreground')}
        onClick={() => setOpen(!open)}
        aria-label={
          unreadCount > 0
            ? `Notificações: ${unreadCount} não lida${unreadCount > 1 ? 's' : ''}`
            : 'Notificações: nenhuma não lida'
        }
        aria-live="polite"
        title={unreadCount > 0 ? `${unreadCount} não lida${unreadCount > 1 ? 's' : ''}` : 'Sem notificações novas'}
        data-testid="notification-bell"
        data-unread-count={unreadCount}
      >
        <Bell className={cn('h-4.5 w-4.5', unreadCount === 0 && 'opacity-70')} />
        {unreadCount > 0 ? (
          <span
            data-testid="unread-badge"
            className="absolute -top-0.5 -right-0.5 flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold text-destructive-foreground"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : (
          <span
            data-testid="bell-empty-dot"
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-muted-foreground/30"
          />
        )}
      </Button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-2 z-50 w-[360px] max-w-[calc(100vw-2rem)] rounded-xl border bg-popover shadow-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Notificações</h3>
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                    {unreadCount}
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-1">
                {notifications.length > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive hover:text-destructive hover:bg-destructive/10" onClick={deleteAllNotifications}>
                    <Trash2 className="h-3.5 w-3.5" />
                    Limpar
                  </Button>
                )}
                {unreadAgendamentoCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    title="Marcar todos os agendamentos como lidos"
                    onClick={() => markAllOfTypeAsRead('agendamento_response')}
                  >
                    <CheckCheck className="h-3.5 w-3.5" />
                    Agendamentos ({unreadAgendamentoCount})
                  </Button>
                )}
                {unreadCount > 0 && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1" onClick={markAllAsRead}>
                    <CheckCheck className="h-3.5 w-3.5" />
                    Ler tudo
                  </Button>
                )}
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Filters */}
            {availableTypes.length > 1 && (
              <div className="flex gap-1 px-4 py-2 border-b overflow-x-auto">
                <button
                  onClick={() => setFilter('all')}
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                    filter === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  Todos
                </button>
                {availableTypes.map(type => (
                  <button
                    key={type}
                    onClick={() => setFilter(type)}
                    className={cn(
                      'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors',
                      filter === type ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                    )}
                  >
                    {TYPE_FILTER[type] || type}
                  </button>
                ))}
              </div>
            )}

            {/* Notifications list */}
            <ScrollArea className="max-h-[400px]">
              <div className="space-y-2 p-3">
                {filtered.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-muted-foreground">
                    <Bell className="h-8 w-8 mb-2 opacity-40" />
                    <p className="text-sm">Nenhuma notificação</p>
                  </div>
                ) : (
                  filtered.map(n => (
                    <NotificationItem key={n.id} n={n} onRead={markAsRead} onDelete={deleteNotification} />
                  ))
                )}
              </div>
            </ScrollArea>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationBell;
