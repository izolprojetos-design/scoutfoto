import { Bell, BellOff, BellRing, Loader2, Send } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePushNotifications } from '@/hooks/usePushNotifications';

const PushNotificationCard = () => {
  const {
    isSupported,
    isSubscribed,
    permission,
    loading,
    subscribe,
    unsubscribe,
    sendTestNotification,
  } = usePushNotifications();

  if (!isSupported) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <BellOff className="h-5 w-5 text-muted-foreground" />
            Notificações Push
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Seu navegador não suporta notificações push. Tente usar Chrome, Edge ou Firefox.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Bell className="h-5 w-5" />
          Notificações Push
          {isSubscribed ? (
            <Badge variant="default" className="text-[10px]">Ativo</Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px]">Inativo</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Receba alertas de segurança e atualizações importantes mesmo com o navegador fechado.
        </p>

        {permission === 'denied' && (
          <p className="text-sm text-destructive">
            Permissão bloqueada. Desbloqueie nas configurações do navegador.
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          {isSubscribed ? (
            <>
              <Button
                variant="outline"
                onClick={unsubscribe}
                disabled={loading}
                className="gap-2"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellOff className="h-4 w-4" />}
                Desativar
              </Button>
              <Button
                variant="secondary"
                onClick={sendTestNotification}
                disabled={loading}
                className="gap-2"
              >
                <Send className="h-4 w-4" />
                Enviar Teste
              </Button>
            </>
          ) : (
            <Button
              onClick={subscribe}
              disabled={loading || permission === 'denied'}
              className="gap-2"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}
              Ativar Notificações
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default PushNotificationCard;
