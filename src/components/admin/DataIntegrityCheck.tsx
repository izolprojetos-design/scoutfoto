import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Result {
  ok: boolean;
  expected_active: number;
  db: { scouts_total: number; scouts_active: number; scout_photos: number; by_branch: Record<string, number> };
  storage: Record<string, number>;
  caller_visibility: { scouts_active_visible: number; scout_photos_visible: number; rls_error: string | null };
  messages: { data_present: string; rls_ok: string; photos: string };
}

export function DataIntegrityCheck() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  const run = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("verify-data-integrity");
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).detail || (data as any).error);
      setResult(data as Result);
      toast.success("Verificação concluída");
    } catch (e: any) {
      toast.error(`Falha: ${e.message ?? e}`);
    } finally {
      setLoading(false);
    }
  };

  const StatusIcon = ({ text }: { text: string }) =>
    text.startsWith("✅") ? <CheckCircle2 className="h-4 w-4 text-emerald-500" />
      : text.startsWith("❌") ? <XCircle className="h-4 w-4 text-destructive" />
      : <AlertTriangle className="h-4 w-4 text-amber-500" />;

  return (
    <Card className="border shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 font-bold">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Verificação de Integridade de Dados
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Confere no banco e no armazenamento se os 81 integrantes e as fotos estão presentes e visíveis para você.
        </p>
        <Button onClick={run} disabled={loading} className="h-11">
          {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Verificando…</> : "Executar verificação"}
        </Button>

        {result && (
          <div className="space-y-4">
            <div className={`p-4 rounded-lg border ${result.ok ? "bg-emerald-500/10 border-emerald-500/30" : "bg-amber-500/10 border-amber-500/30"}`}>
              <p className="font-bold text-sm mb-2">
                {result.ok ? "✅ Dados restaurados com sucesso" : "⚠️ Divergências encontradas"}
              </p>
              <ul className="space-y-1 text-sm">
                <li className="flex items-center gap-2"><StatusIcon text={result.messages.data_present} /> {result.messages.data_present.replace(/^[✅❌⚠️]\s?/, "")}</li>
                <li className="flex items-center gap-2"><StatusIcon text={result.messages.rls_ok} /> {result.messages.rls_ok.replace(/^[✅❌⚠️]\s?/, "")}</li>
                <li className="flex items-center gap-2"><StatusIcon text={result.messages.photos} /> {result.messages.photos.replace(/^[✅❌⚠️]\s?/, "")}</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Metric label="Integrantes (total)" value={result.db.scouts_total} />
              <Metric label="Ativos" value={result.db.scouts_active} highlight />
              <Metric label="Fotos (registro)" value={result.db.scout_photos} />
              <Metric label="Arquivos scout-photos" value={result.storage["scout-photos"]} />
              <Metric label="Arquivos images" value={result.storage.images} />
              <Metric label="Você enxerga (ativos)" value={result.caller_visibility.scouts_active_visible} />
              <Metric label="Você enxerga (fotos)" value={result.caller_visibility.scout_photos_visible} />
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Distribuição por ramo (ativos)</p>
              <div className="flex flex-wrap gap-2">
                {Object.entries(result.db.by_branch).map(([k, v]) => (
                  <Badge key={k} variant="secondary" className="text-xs">{k}: {v}</Badge>
                ))}
              </div>
            </div>

            {result.caller_visibility.rls_error && (
              <div className="p-3 bg-destructive/10 border border-destructive/30 rounded text-xs text-destructive">
                Erro RLS: {result.caller_visibility.rls_error}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const Metric = ({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) => (
  <div className={`rounded-lg border p-3 ${highlight ? "bg-primary/10 border-primary/30" : "bg-muted/30"}`}>
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">{label}</p>
    <p className={`text-2xl font-bold ${highlight ? "text-primary" : ""}`}>{value}</p>
  </div>
);
