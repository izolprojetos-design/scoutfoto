import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { CalendarPlus, ArrowLeft } from 'lucide-react';
import SchedulingRequestForm from '@/components/SchedulingRequestForm';
import AgendamentosManager from '@/components/AgendamentosManager';

const MyAgendamentos = () => {
  const { roles } = useAuth();
  const canRequestScheduling = roles?.includes('admin') || roles?.includes('voluntario');
  const [showForm, setShowForm] = useState(false);

  return (
    <>
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Minha Agenda</h1>
        <p className="mt-1 text-muted-foreground">Gerencie seus agendamentos e solicitações</p>
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
                Novo agendamento
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
