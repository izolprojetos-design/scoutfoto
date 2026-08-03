import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export const usePushNotifications = () => {
  const { user } = useAuth();
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [loading, setLoading] = useState(false);
  const [vapidPublicKey, setVapidPublicKey] = useState<string | null>(null);

  useEffect(() => {
    const supported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
    setIsSupported(supported);
    if (supported) {
      setPermission(Notification.permission);
    }
  }, []);

  // Fetch VAPID public key from edge function
  useEffect(() => {
    let cancelled = false;
    const fetchKey = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-vapid-public-key');
        if (!cancelled && !error && data?.publicKey) {
          setVapidPublicKey(data.publicKey);
        }
      } catch (err) {
        console.error('Error fetching VAPID key:', err);
      }
    };
    fetchKey();
    return () => { cancelled = true; };
  }, []);

  // Check if already subscribed
  useEffect(() => {
    if (!isSupported || !user) return;
    let cancelled = false;

    const checkSubscription = async () => {
      try {
        const registration = await navigator.serviceWorker.getRegistration('/sw-push.js');
        if (!registration) { if (!cancelled) setIsSubscribed(false); return; }
        const sub = await registration.pushManager.getSubscription();
        if (!cancelled) setIsSubscribed(!!sub);
      } catch {
        if (!cancelled) setIsSubscribed(false);
      }
    };
    checkSubscription();
    return () => { cancelled = true; };
  }, [isSupported, user]);

  const subscribe = useCallback(async () => {
    if (!user || !isSupported || !vapidPublicKey) {
      if (!vapidPublicKey) {
        toast.error('Chave VAPID não disponível. Tente novamente.');
      }
      return false;
    }
    setLoading(true);

    try {
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== 'granted') {
        toast.error('Permissão de notificação negada pelo navegador.');
        setLoading(false);
        return false;
      }

      const registration = await navigator.serviceWorker.register('/sw-push.js', { scope: '/' });
      await navigator.serviceWorker.ready;

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as BufferSource,
      });

      const subJson = subscription.toJSON();

      const { error } = await supabase
        .from('push_subscriptions')
        .upsert({
          user_id: user.id,
          endpoint: subJson.endpoint!,
          p256dh: subJson.keys!.p256dh!,
          auth: subJson.keys!.auth!,
        }, { onConflict: 'user_id,endpoint' });

      if (error) {
        console.error('Error saving push subscription:', error);
        toast.error('Erro ao salvar inscrição push.');
        setLoading(false);
        return false;
      }

      setIsSubscribed(true);
      toast.success('Notificações push ativadas!');
      setLoading(false);
      return true;
    } catch (err) {
      console.error('Push subscribe error:', err);
      toast.error('Erro ao ativar notificações push.');
      setLoading(false);
      return false;
    }
  }, [user, isSupported, vapidPublicKey]);

  const unsubscribe = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const registration = await navigator.serviceWorker.getRegistration('/sw-push.js');
      if (registration) {
        const sub = await registration.pushManager.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe();

          await supabase
            .from('push_subscriptions')
            .delete()
            .eq('user_id', user.id)
            .eq('endpoint', endpoint);
        }
      }

      setIsSubscribed(false);
      toast.info('Notificações push desativadas.');
    } catch (err) {
      console.error('Push unsubscribe error:', err);
      toast.error('Erro ao desativar notificações push.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  const sendTestNotification = useCallback(async () => {
    if (!user) return;
    
    try {
      const { data, error } = await supabase.functions.invoke('send-push-notification', {
        body: {
          userId: user.id,
          title: '🔔 Teste ScoutFoto',
          body: 'Notificação push funcionando! Parabéns! 🎉',
          url: '/',
        },
      });

      if (error) {
        console.error('Test push error:', error);
        toast.error('Erro ao enviar notificação de teste.');
        return;
      }

      if (data?.sent > 0) {
        toast.success(`Notificação de teste enviada! (${data.sent} dispositivo(s))`);
      } else {
        toast.warning(data?.error || 'Nenhuma inscrição encontrada.');
      }
    } catch (err) {
      console.error('Test push error:', err);
      toast.error('Erro ao enviar notificação de teste.');
    }
  }, [user]);

  return {
    isSupported,
    isSubscribed,
    permission,
    loading,
    subscribe,
    unsubscribe,
    sendTestNotification,
  };
};
