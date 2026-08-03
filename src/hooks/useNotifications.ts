import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface SecurityNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  priority: 'high' | 'medium' | 'info';
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export const useNotifications = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<SecurityNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotifications = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('security_notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);
    setNotifications((data as SecurityNotification[]) || []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (!user) { setNotifications([]); setLoading(false); return; }
    fetchNotifications();

    // Realtime: reflete inserts/updates/deletes imediatamente (badge e estado do sino)
    const channel = supabase
      .channel(`security-notifications-${user.id}`)
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'security_notifications', filter: `user_id=eq.${user.id}` },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const n = payload.new as SecurityNotification;
            setNotifications(prev => prev.some(x => x.id === n.id) ? prev : [n, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const n = payload.new as SecurityNotification;
            setNotifications(prev => prev.map(x => x.id === n.id ? { ...x, ...n } : x));
          } else if (payload.eventType === 'DELETE') {
            const oldId = (payload.old as { id?: string })?.id;
            if (oldId) setNotifications(prev => prev.filter(x => x.id !== oldId));
          }
        })
      .subscribe();

    // Poll fallback (caso realtime não esteja habilitado)
    const interval = setInterval(fetchNotifications, 60000);
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [user, fetchNotifications]);

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const markAsRead = async (id: string) => {
    await supabase
      .from('security_notifications')
      .update({ is_read: true })
      .eq('id', id);
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  };

  const markAllAsRead = async () => {
    if (!user) return;
    await supabase
      .from('security_notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('is_read', false);
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
  };

  const markAllOfTypeAsRead = async (type: string) => {
    if (!user) return;
    await supabase
      .from('security_notifications')
      .update({ is_read: true })
      .eq('user_id', user.id)
      .eq('type', type)
      .eq('is_read', false);
    setNotifications(prev => prev.map(n => n.type === type ? { ...n, is_read: true } : n));
  };

  const deleteNotification = async (id: string) => {
    await supabase
      .from('security_notifications')
      .delete()
      .eq('id', id);
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const deleteAllNotifications = async () => {
    if (!user) return;
    await supabase
      .from('security_notifications')
      .delete()
      .eq('user_id', user.id);
    setNotifications([]);
  };

  return { notifications, unreadCount, loading, markAsRead, markAllAsRead, markAllOfTypeAsRead, deleteNotification, deleteAllNotifications, refetch: fetchNotifications };
};
