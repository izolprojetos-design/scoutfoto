import { useEffect, useState } from 'react';
import { z } from 'zod';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Loader2, Send, CheckCircle2 } from 'lucide-react';
import { motion } from 'framer-motion';

import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { SCHEDULING_TYPES } from '@/lib/schedulingTypes';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

interface Branch {
  id: string;
  display_name: string;
  icon: string;
}

const formSchema = z.object({
  nome_responsavel: z.string().trim().min(2, 'Informe o nome completo').max(120),
  email: z.string().trim().email('E-mail inválido').max(255),
  data: z.date({ required_error: 'Selecione a data' }),
  horario: z.string().regex(/^\d{2}:\d{2}$/, 'Formato HH:MM'),
  local: z.string().trim().min(2, 'Informe o local').max(200),
  branch_id: z.string().uuid('Selecione um ramo'),
  tipo: z.enum(['reuniao', 'acampamento', 'atividade_especial', 'outro']),
  descricao: z.string().trim().min(5, 'Descreva brevemente a atividade').max(1000),
});

type FormValues = z.infer<typeof formSchema>;

interface Props {
  onSuccess?: () => void;
}

const SchedulingRequestForm = ({ onSuccess }: Props) => {
  const { user, profile } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome_responsavel: profile?.name ?? '',
      email: profile?.email ?? user?.email ?? '',
      horario: '',
      local: '',
      branch_id: '',
      tipo: 'reuniao',
      descricao: '',
    },
  });

  useEffect(() => {
    supabase.from('branches').select('id, display_name, icon').order('sort_order')
      .then(({ data }) => setBranches(data ?? []));
  }, []);

  useEffect(() => {
    if (profile?.name) form.setValue('nome_responsavel', profile.name);
    if (profile?.email) form.setValue('email', profile.email);
  }, [profile, form]);

  const onSubmit = async (values: FormValues) => {
    if (!user) return;
    const { error } = await supabase.from('scheduling_requests').insert({
      user_id: user.id,
      nome_responsavel: values.nome_responsavel,
      email: values.email,
      data: format(values.data, 'yyyy-MM-dd'),
      horario: values.horario,
      local: values.local,
      branch_id: values.branch_id,
      tipo: values.tipo,
      descricao: values.descricao,
    });

    if (error) {
      toast({ title: 'Erro ao enviar', description: error.message, variant: 'destructive' });
      return;
    }

    setSubmitted(true);
    toast({ title: 'Solicitação enviada!', description: 'Aguarde a análise do administrador.' });
    form.reset({
      nome_responsavel: profile?.name ?? '',
      email: profile?.email ?? user?.email ?? '',
      horario: '',
      local: '',
      branch_id: '',
      tipo: 'reuniao',
      descricao: '',
    });
    onSuccess?.();
  };

  if (submitted) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <Alert className="border-primary/30 bg-primary/5">
          <CheckCircle2 className="h-5 w-5 text-primary" />
          <AlertTitle>Solicitação registrada com sucesso</AlertTitle>
          <AlertDescription className="mt-1">
            Sua solicitação está com status <strong>Pendente</strong>. Você poderá acompanhá-la na aba "Minhas solicitações".
            <div className="mt-3">
              <Button variant="outline" size="sm" onClick={() => setSubmitted(false)}>
                Nova solicitação
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </motion.div>
    );
  }

  return (
    <Card className="border shadow-sm">
      <CardHeader>
        <CardTitle>Solicitar Agendamento de Seção</CardTitle>
        <CardDescription>
          Preencha os dados abaixo. A solicitação passará por análise antes de virar um evento no calendário.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField control={form.control} name="nome_responsavel" render={({ field }) => (
                <FormItem>
                  <FormLabel>Nome do responsável *</FormLabel>
                  <FormControl><Input placeholder="Seu nome completo" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="email" render={({ field }) => (
                <FormItem>
                  <FormLabel>E-mail *</FormLabel>
                  <FormControl><Input type="email" placeholder="voce@exemplo.com" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="data" render={({ field }) => (
                <FormItem className="flex flex-col">
                  <FormLabel>Data da seção *</FormLabel>
                  <Popover>
                    <PopoverTrigger asChild>
                      <FormControl>
                        <Button variant="outline" className={cn(
                          'h-12 justify-start text-left font-normal',
                          !field.value && 'text-muted-foreground'
                        )}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {field.value ? format(field.value, "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : 'Selecione a data'}
                        </Button>
                      </FormControl>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={field.value}
                        onSelect={field.onChange}
                        disabled={(date) => date < new Date(new Date().setHours(0,0,0,0))}
                        initialFocus
                        locale={ptBR}
                        className={cn('p-3 pointer-events-auto')}
                      />
                    </PopoverContent>
                  </Popover>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="horario" render={({ field }) => (
                <FormItem>
                  <FormLabel>Horário *</FormLabel>
                  <FormControl><Input type="time" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="local" render={({ field }) => (
                <FormItem className="md:col-span-2">
                  <FormLabel>Local *</FormLabel>
                  <FormControl><Input placeholder="Ex: Sede do grupo, Parque Anauá..." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="branch_id" render={({ field }) => (
                <FormItem>
                  <FormLabel>Ramo escoteiro *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-12"><SelectValue placeholder="Selecione o ramo" /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {branches.map(b => (
                        <SelectItem key={b.id} value={b.id}>{b.icon} {b.display_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />

              <FormField control={form.control} name="tipo" render={({ field }) => (
                <FormItem>
                  <FormLabel>Tipo de atividade *</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {SCHEDULING_TYPES.map(t => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <FormField control={form.control} name="descricao" render={({ field }) => (
              <FormItem>
                <FormLabel>Descrição / Observações *</FormLabel>
                <FormControl>
                  <Textarea rows={4} placeholder="Detalhe a atividade, materiais necessários, observações importantes..." {...field} />
                </FormControl>
                <FormDescription>Mínimo 5 caracteres, máximo 1000.</FormDescription>
                <FormMessage />
              </FormItem>
            )} />

            <div className="flex justify-end pt-2">
              <Button type="submit" size="lg" disabled={form.formState.isSubmitting} className="gap-2">
                {form.formState.isSubmitting
                  ? <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
                  : <><Send className="h-4 w-4" /> Enviar Solicitação</>}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default SchedulingRequestForm;
