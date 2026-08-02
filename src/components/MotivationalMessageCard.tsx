import { useCallback, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';

interface MotivationalMessage {
  id: string;
  text: string;
  author: string;
  category: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  bp: 'Baden-Powell',
  lei: 'Lei Escoteira',
  promessa: 'Promessa',
  valores: 'Valores',
  lideranca: 'Liderança',
  servico: 'Serviço',
  natureza: 'Natureza',
  amizade: 'Amizade',
  equipe: 'Trabalho em Equipe',
  cidadania: 'Cidadania',
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Bom dia', emoji: '🌅' };
  if (h < 18) return { text: 'Boa tarde', emoji: '☀️' };
  return { text: 'Boa noite', emoji: '🌙' };
}

const MotivationalMessageCard = ({ showGreeting = false }: { showGreeting?: boolean }) => {
  const { profile } = useAuth();
  const [message, setMessage] = useState<MotivationalMessage | null>(null);
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<MotivationalMessage[]>([]);

  const pickRandom = useCallback((list: MotivationalMessage[], exceptId?: string) => {
    if (list.length === 0) return null;
    if (list.length === 1) return list[0];
    let choice = list[Math.floor(Math.random() * list.length)];
    let tries = 0;
    while (exceptId && choice.id === exceptId && tries < 5) {
      choice = list[Math.floor(Math.random() * list.length)];
      tries++;
    }
    return choice;
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data, error } = await supabase
        .from('motivational_messages')
        .select('id, text, author, category')
        .eq('is_active', true);
      if (!mounted) return;
      if (error || !data || data.length === 0) {
        setLoading(false);
        return;
      }
      setMessages(data);
      setMessage(pickRandom(data));
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [pickRandom]);

  const handleNew = () => setMessage(pickRandom(messages, message?.id));

  const g = greeting();
  const firstName = profile?.name?.split(' ')[0] || '';

  if (loading || !message) {
    if (!showGreeting) return null;
    return (
      <div className="mb-4">
        <h1 className="text-3xl font-bold tracking-tight">
          {g.text}, {firstName} 👋
        </h1>
      </div>
    );
  }

  return (
    <div className="mb-6">
      {showGreeting && (
        <h1 className="text-3xl font-bold tracking-tight mb-3">
          {g.text}, {firstName} 👋
        </h1>
      )}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5 shadow-sm overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary [animation:spin_6s_linear_infinite]">
              <img src="/scoutfoto-logo-512.png" alt="Flor de Lis" className="h-6 w-6 object-contain" />
            </div>
            <div className="flex-1 min-w-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.35 }}
                >
                  <p className="text-sm sm:text-base font-medium italic leading-relaxed text-foreground">
                    “{message.text}”
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">— {message.author}</span>
                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                      {CATEGORY_LABELS[message.category] || message.category}
                    </Badge>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="shrink-0 h-8 w-8"
              onClick={handleNew}
              title="Nova mensagem"
              aria-label="Nova mensagem"
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MotivationalMessageCard;
