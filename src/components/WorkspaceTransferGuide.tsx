import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HelpCircle, ChevronRight, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Step {
  number: number;
  title: string;
  description: string;
  details?: string[];
}

const steps: Step[] = [
  {
    number: 1,
    title: "Localize o projeto",
    description: "No dashboard do Lovable, encontre o projeto dentro do workspace \"al's Lovable\".",
    details: ["Vá para a página inicial (dashboard)", "Procure o card do projeto ScoutFoto"],
  },
  {
    number: 2,
    title: "Inicie a transferência",
    description: "Clique com o botão direito no card do projeto ou use o menu de três pontos (⋯).",
    details: ["Selecione \"Transfer to workspace\" no menu", "Alternativa: Project Settings → Transfer workspace"],
  },
  {
    number: 3,
    title: "Escolha o destino",
    description: "Selecione \"Izol Marildo (PRO)\" como workspace de destino.",
    details: ["Confirme a transferência na janela que abrir", "Aguarde a conclusão do processo"],
  },
  {
    number: 4,
    title: "Pronto!",
    description: "O projeto agora está no workspace PRO e usará os créditos de Izol Marildo.",
    details: ["Verifique se o projeto aparece no novo workspace", "Os créditos do workspace PRO serão usados a partir de agora"],
  },
];

export default function WorkspaceTransferGuide() {
  const [open, setOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(0);

  const nextStep = () => setActiveStep((prev) => Math.min(prev + 1, steps.length - 1));
  const prevStep = () => setActiveStep((prev) => Math.max(prev - 1, 0));

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground gap-1.5"
        >
          <HelpCircle className="h-4 w-4" />
          <span className="hidden sm:inline">Como transferir o projeto?</span>
          <span className="sm:hidden">Transferir projeto</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            Transferir projeto entre workspaces
          </DialogTitle>
        </DialogHeader>

        <div className="mt-2 space-y-6">
          {/* Progress bar */}
          <div className="flex items-center gap-2">
            {steps.map((step, idx) => (
              <div key={step.number} className="flex items-center gap-2 flex-1">
                <div
                  className={`h-8 w-8 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                    idx <= activeStep
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {idx < activeStep ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    step.number
                  )}
                </div>
                {idx < steps.length - 1 && (
                  <div
                    className={`h-0.5 flex-1 transition-colors ${
                      idx < activeStep ? "bg-primary" : "bg-muted"
                    }`}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              <div className="rounded-xl border bg-card p-5 space-y-3">
                <h3 className="font-semibold text-lg">
                  Passo {steps[activeStep].number}: {steps[activeStep].title}
                </h3>
                <p className="text-muted-foreground leading-relaxed">
                  {steps[activeStep].description}
                </p>
                {steps[activeStep].details && (
                  <ul className="space-y-2 mt-3">
                    {steps[activeStep].details.map((detail, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm">
                        <ChevronRight className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{detail}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={activeStep === 0}
              className="rounded-xl"
            >
              Anterior
            </Button>
            <div className="text-sm text-muted-foreground">
              {activeStep + 1} de {steps.length}
            </div>
            <Button
              onClick={nextStep}
              disabled={activeStep === steps.length - 1}
              className="rounded-xl"
            >
              {activeStep === steps.length - 1 ? "Concluir" : "Próximo"}
            </Button>
          </div>

          {/* Important note */}
          <div className="rounded-xl bg-amber-50 border border-amber-200 p-4 text-sm text-amber-800 space-y-1">
            <p className="font-semibold">Importante:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Créditos não são transferíveis entre workspaces.</li>
              <li>Ao mover o projeto, o uso passa a consumir créditos do workspace destino.</li>
              <li>Se usar Lovable Cloud, pode ser necessário reconectar após a transferência.</li>
              <li>Apenas Admin/Owner de ambos workspaces pode transferir.</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
