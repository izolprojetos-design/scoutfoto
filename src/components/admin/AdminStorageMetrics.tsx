import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HardDrive, Database, RefreshCw, Loader2, AlertTriangle, Save, Users2, User, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Link } from "react-router-dom";

interface Bucket { bucket_id: string; files: number; total_bytes: number; }
interface RankingUser { user_id: string; name: string; email: string; files: number; total_bytes: number; }
interface RankingScout { scout_id: string; name: string; registration_id: string | null; section: string | null; files: number; total_bytes: number; }
interface TableStat { table: string; bytes: number; rows: number; }
interface AlertItem { key: string; level: "warn" | "crit"; message: string; value: number; threshold: number; }
interface Config {
  storage_warn_bytes: number; storage_crit_bytes: number;
  db_warn_bytes: number; db_crit_bytes: number;
  bucket_warn_bytes: number; bucket_crit_bytes: number;
}
interface Metrics {
  generated_at: string;
  config: Config;
  db_size_bytes: number;
  top_tables: TableStat[];
  storage_total_bytes: number;
  buckets: Bucket[];
  ranking_users: RankingUser[];
  ranking_scouts: RankingScout[];
  alerts: AlertItem[];
}

const fmt = (b: number) => {
  if (!b) return "0 B";
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1073741824) return `${(b / 1048576).toFixed(1)} MB`;
  return `${(b / 1073741824).toFixed(2)} GB`;
};
const toMB = (b: number) => Math.round(b / 1048576);
const fromMB = (mb: number) => Math.round(mb * 1048576);

export default function AdminStorageMetrics() {
  const [data, setData] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<Record<string, number>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: res, error } = await supabase.functions.invoke("storage-metrics");
      if (error) throw error;
      if ((res as any)?.error) throw new Error((res as any).detail || (res as any).error);
      setData(res as Metrics);
      setDraft({
        storage_warn: toMB((res as Metrics).config.storage_warn_bytes),
        storage_crit: toMB((res as Metrics).config.storage_crit_bytes),
        db_warn: toMB((res as Metrics).config.db_warn_bytes),
        db_crit: toMB((res as Metrics).config.db_crit_bytes),
        bucket_warn: toMB((res as Metrics).config.bucket_warn_bytes),
        bucket_crit: toMB((res as Metrics).config.bucket_crit_bytes),
      });
    } catch (e: any) {
      toast.error(`Falha: ${e.message ?? e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const t = setInterval(fetchData, 60_000);
    return () => clearInterval(t);
  }, []);

  const saveConfig = async () => {
    setSaving(true);
    try {
      const payload = {
        storage_warn_bytes: fromMB(draft.storage_warn),
        storage_crit_bytes: fromMB(draft.storage_crit),
        db_warn_bytes: fromMB(draft.db_warn),
        db_crit_bytes: fromMB(draft.db_crit),
        bucket_warn_bytes: fromMB(draft.bucket_warn),
        bucket_crit_bytes: fromMB(draft.bucket_crit),
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from("storage_alert_config").update(payload).eq("id", 1);
      if (error) throw error;
      toast.success("Limites atualizados");
      fetchData();
    } catch (e: any) {
      toast.error(`Falha ao salvar: ${e.message ?? e}`);
    } finally {
      setSaving(false);
    }
  };

  const storagePct = useMemo(() => {
    if (!data) return 0;
    return Math.min(100, (data.storage_total_bytes / (1024 * 1024 * 1024)) * 100);
  }, [data]);

  const badgeFor = (v: number, warn: number, crit: number) =>
    v >= crit ? { label: "Crítico", cls: "bg-destructive/15 text-destructive border-destructive/30" }
    : v >= warn ? { label: "Atenção", cls: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/20" }
    : { label: "Saudável", cls: "bg-green-600/15 text-green-700 dark:text-green-400 border-green-600/20" };

  if (loading && !data) {
    return (
      <Card className="border shadow-sm"><CardContent className="py-10 flex items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </CardContent></Card>
    );
  }
  if (!data) return null;

  const stB = badgeFor(data.storage_total_bytes, data.config.storage_warn_bytes, data.config.storage_crit_bytes);
  const dbB = badgeFor(data.db_size_bytes, data.config.db_warn_bytes, data.config.db_crit_bytes);

  return (
    <Card className="border shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="flex items-center gap-2 font-bold">
            <HardDrive className="h-5 w-5 text-primary" />
            Métricas de Armazenamento
          </CardTitle>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              Atualizado {new Date(data.generated_at).toLocaleTimeString("pt-BR")}
            </span>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchData} disabled={loading}>
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data.alerts.length > 0 && (
          <div className="mb-4 space-y-2">
            {data.alerts.map((a) => (
              <div key={a.key} className={cn("flex items-start gap-2 rounded-lg border p-3 text-sm",
                a.level === "crit" ? "bg-destructive/10 border-destructive/30 text-destructive" : "bg-yellow-500/10 border-yellow-500/30")}>
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <div><strong>{a.message}</strong> — {fmt(a.value)} / limite {fmt(a.threshold)}</div>
              </div>
            ))}
          </div>
        )}

        <Tabs defaultValue="overview">
          <TabsList>
            <TabsTrigger value="overview">Visão geral</TabsTrigger>
            <TabsTrigger value="ranking-users">Ranking · usuários</TabsTrigger>
            <TabsTrigger value="ranking-scouts">Ranking · integrantes</TabsTrigger>
            <TabsTrigger value="config">Limites</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4 pt-4">
            {/* Storage total */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-medium"><HardDrive className="h-4 w-4" /> Storage total</div>
                <Badge variant="outline" className={stB.cls}>{stB.label}</Badge>
              </div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold">{fmt(data.storage_total_bytes)}</span>
                <span className="text-muted-foreground text-xs">de 1 GB · warn {fmt(data.config.storage_warn_bytes)} · crit {fmt(data.config.storage_crit_bytes)}</span>
              </div>
              <Progress value={storagePct} className="h-2" />
              <div className="grid gap-2 pt-2">
                {data.buckets.map((b) => {
                  const bb = badgeFor(b.total_bytes, data.config.bucket_warn_bytes, data.config.bucket_crit_bytes);
                  return (
                    <div key={b.bucket_id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                      <div><strong>{b.bucket_id}</strong> <span className="text-muted-foreground">· {b.files} arq.</span></div>
                      <div className="flex items-center gap-2">
                        <span>{fmt(b.total_bytes)}</span>
                        <Badge variant="outline" className={cn("text-[10px]", bb.cls)}>{bb.label}</Badge>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* DB */}
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-medium"><Database className="h-4 w-4" /> Banco de dados</div>
                <Badge variant="outline" className={dbB.cls}>{dbB.label}</Badge>
              </div>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold">{fmt(data.db_size_bytes)}</span>
                <span className="text-muted-foreground text-xs">warn {fmt(data.config.db_warn_bytes)} · crit {fmt(data.config.db_crit_bytes)}</span>
              </div>
              {data.top_tables.length > 0 && (
                <div className="pt-2">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold mb-2">Top tabelas</p>
                  <div className="max-h-72 overflow-y-auto rounded border">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50 sticky top-0">
                        <tr><th className="text-left px-3 py-1.5">Tabela</th><th className="text-right px-3 py-1.5">Linhas</th><th className="text-right px-3 py-1.5">Tamanho</th></tr>
                      </thead>
                      <tbody>
                        {data.top_tables.map((t) => (
                          <tr key={t.table} className="border-t"><td className="px-3 py-1.5 font-mono text-xs">{t.table}</td><td className="text-right px-3 py-1.5">{t.rows}</td><td className="text-right px-3 py-1.5">{fmt(t.bytes)}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="ranking-users" className="pt-4">
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2">#</th>
                    <th className="text-left px-3 py-2">Usuário</th>
                    <th className="text-right px-3 py-2">Arquivos</th>
                    <th className="text-right px-3 py-2">Uso</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.ranking_users.length === 0 && (
                    <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">Sem dados</td></tr>
                  )}
                  {data.ranking_users.map((u, i) => (
                    <tr key={u.user_id} className="border-t">
                      <td className="px-3 py-2">{i + 1}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium flex items-center gap-1"><User className="h-3 w-3" />{u.name}</div>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </td>
                      <td className="text-right px-3 py-2">{u.files}</td>
                      <td className="text-right px-3 py-2 font-semibold">{fmt(u.total_bytes)}</td>
                      <td className="px-3 py-2 text-right">
                        <Link to={`/gallery?uploader=${u.user_id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          Ver <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="ranking-scouts" className="pt-4">
            <div className="rounded-lg border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2">#</th>
                    <th className="text-left px-3 py-2">Integrante</th>
                    <th className="text-left px-3 py-2">Seção</th>
                    <th className="text-right px-3 py-2">Fotos</th>
                    <th className="text-right px-3 py-2">Uso</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.ranking_scouts.length === 0 && (
                    <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Sem dados</td></tr>
                  )}
                  {data.ranking_scouts.map((s, i) => (
                    <tr key={s.scout_id} className="border-t">
                      <td className="px-3 py-2">{i + 1}</td>
                      <td className="px-3 py-2">
                        <div className="font-medium flex items-center gap-1"><Users2 className="h-3 w-3" />{s.name.toUpperCase()}</div>
                        <div className="text-xs text-muted-foreground">#{s.registration_id ?? "—"}</div>
                      </td>
                      <td className="px-3 py-2 text-xs">{s.section ?? "—"}</td>
                      <td className="text-right px-3 py-2">{s.files}</td>
                      <td className="text-right px-3 py-2 font-semibold">{fmt(s.total_bytes)}</td>
                      <td className="px-3 py-2 text-right">
                        <Link to={`/scouts/${s.scout_id}`} className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          Abrir <ExternalLink className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </TabsContent>

          <TabsContent value="config" className="pt-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              Valores em <strong>MB</strong>. Alertas in-app são enviados aos administradores quando o uso atinge cada nível (dedup de 24h).
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <ThresholdInput label="Storage total — atenção" value={draft.storage_warn} onChange={(v) => setDraft({ ...draft, storage_warn: v })} />
              <ThresholdInput label="Storage total — crítico" value={draft.storage_crit} onChange={(v) => setDraft({ ...draft, storage_crit: v })} />
              <ThresholdInput label="Banco de dados — atenção" value={draft.db_warn} onChange={(v) => setDraft({ ...draft, db_warn: v })} />
              <ThresholdInput label="Banco de dados — crítico" value={draft.db_crit} onChange={(v) => setDraft({ ...draft, db_crit: v })} />
              <ThresholdInput label="Bucket individual — atenção" value={draft.bucket_warn} onChange={(v) => setDraft({ ...draft, bucket_warn: v })} />
              <ThresholdInput label="Bucket individual — crítico" value={draft.bucket_crit} onChange={(v) => setDraft({ ...draft, bucket_crit: v })} />
            </div>
            <Button onClick={saveConfig} disabled={saving} className="h-11">
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Salvando…</> : <><Save className="h-4 w-4 mr-2" /> Salvar limites</>}
            </Button>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

function ThresholdInput({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      <div className="relative">
        <Input type="number" min={1} value={value ?? ""} onChange={(e) => onChange(Number(e.target.value))} className="h-11 pr-12" />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">MB</span>
      </div>
    </div>
  );
}
