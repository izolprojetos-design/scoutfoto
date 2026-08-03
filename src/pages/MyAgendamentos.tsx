import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { CalendarPlus, ArrowLeft } from 'lucide-react';
import SchedulingRequestForm from '@/components/SchedulingRequestForm';
import AgendamentosManager from '@/components/AgendamentosManager';

const MyAgendamentos = () => {
  const { roles } = useAuth();
  const canRequestScheduling = roles?.includes('admin') || roles?.includes('voluntario');
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    const prev = document.title;
    document.title = 'Mensagem | ScoutFoto';

    const setMeta = (key: 'name' | 'property', keyValue: string, content: string) => {
      const selector = `meta[${key}="${keyValue}"]`;
      let el = document.head.querySelector<HTMLMetaElement>(selector);
      if (!el) {
        el = document.createElement('meta');
        el.setAttribute(key, keyValue);
        document.head.appendChild(el);
      }
      const old = el.getAttribute('content');
      el.setAttribute('content', content);
      return () => {
        if (old !== null) el!.setAttribute('content', old);
        else el!.remove();
      };
    };

    const restoreOg = setMeta('property', 'og:title', 'Mensagem | ScoutFoto');
    const restoreTw = setMeta('name', 'twitter:title', 'Mensagem | ScoutFoto');
    const restoreDesc = setMeta('name', 'description', 'Gerencie suas mensagens e solicitações no ScoutFoto.');

    return () => {
      document.title = prev;
      restoreOg();
      restoreTw();
      restoreDesc();
    };
  }, []);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Mensagem</h1>
        <p className="mt-1 text-muted-foreground">Gerencie suas mensagens e solicitações</p>
      </div>

      {showForm ? (
        <div className="space-y-4">
          <Button variant="ghost" onClick={() => setShowForm(false)} className="gap-2">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Button>
          {canRequestScheduling && <SchedulingRequestForm />}
        </div>
      ) : (
        <div className="space-y-6">
          {canRequestScheduling && (
            <div className="flex justify-end">
              <Button onClick={() => setShowForm(true)} className="gap-2">
                <CalendarPlus className="h-4 w-4" />
                Nova mensagem
              </Button>
            </div>
          )}
          <AgendamentosManager />
        </div>
      )}
    </>
  );
};

export default MyAgendamentos;
