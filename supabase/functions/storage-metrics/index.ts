import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const DEDUP_WINDOW_HOURS = 24;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);
    const token = authHeader.replace("Bearer ", "");

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ error: "Unauthorized" }, 401);
    const { data: isAdmin } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "admin" });
    if (!isAdmin) return json({ error: "Forbidden" }, 403);

    // Config
    const { data: cfg } = await admin.from("storage_alert_config").select("*").eq("id", 1).maybeSingle();

    // Storage per bucket + per user (from storage.objects)
    const { data: objs, error: objErr } = await admin
      .schema("storage")
      .from("objects")
      .select("bucket_id, name, owner, metadata")
      .limit(50000);
    if (objErr) console.error("objects error:", objErr);

    const bucketAgg: Record<string, { files: number; bytes: number }> = {};
    const userAgg: Record<string, { files: number; bytes: number }> = {};
    const scoutPathBytes: Record<string, number> = {}; // path -> bytes for scout_photos join

    for (const o of objs ?? []) {
      const size = Number((o.metadata as any)?.size ?? 0);
      const b = o.bucket_id as string;
      bucketAgg[b] ??= { files: 0, bytes: 0 };
      bucketAgg[b].files += 1;
      bucketAgg[b].bytes += size;
      const owner = (o.owner as string | null) ?? "unknown";
      userAgg[owner] ??= { files: 0, bytes: 0 };
      userAgg[owner].files += 1;
      userAgg[owner].bytes += size;
      if (b === "scout-photos" && o.name) scoutPathBytes[o.name as string] = size;
    }

    const buckets = Object.entries(bucketAgg).map(([id, v]) => ({ bucket_id: id, files: v.files, total_bytes: v.bytes }));
    const totalStorage = buckets.reduce((s, x) => s + x.total_bytes, 0);

    // Resolve top users
    const topUserIds = Object.entries(userAgg)
      .filter(([id]) => id !== "unknown")
      .sort((a, b) => b[1].bytes - a[1].bytes)
      .slice(0, 15)
      .map(([id]) => id);

    let userProfiles: Record<string, { name: string; email: string }> = {};
    if (topUserIds.length) {
      const { data: profs } = await admin
        .from("profiles")
        .select("user_id, name, email")
        .in("user_id", topUserIds);
      userProfiles = Object.fromEntries((profs ?? []).map((p) => [p.user_id, { name: p.name, email: p.email }]));
    }
    const rankingUsers = topUserIds.map((id) => ({
      user_id: id,
      name: userProfiles[id]?.name ?? "Desconhecido",
      email: userProfiles[id]?.email ?? "",
      files: userAgg[id].files,
      total_bytes: userAgg[id].bytes,
    }));

    // Ranking por scout — usa scout_photos (file_size + storage_path)
    const { data: sp } = await admin
      .from("scout_photos")
      .select("scout_id, storage_path, file_size");
    const scoutAgg: Record<string, { files: number; bytes: number }> = {};
    for (const r of sp ?? []) {
      const sid = r.scout_id as string;
      if (!sid) continue;
      const size = Number(r.file_size ?? scoutPathBytes[r.storage_path as string] ?? 0);
      scoutAgg[sid] ??= { files: 0, bytes: 0 };
      scoutAgg[sid].files += 1;
      scoutAgg[sid].bytes += size;
    }
    const topScoutIds = Object.entries(scoutAgg)
      .sort((a, b) => b[1].bytes - a[1].bytes)
      .slice(0, 15)
      .map(([id]) => id);
    let scoutMap: Record<string, { name: string; registration_id: string | null; section: string | null }> = {};
    if (topScoutIds.length) {
      const { data: sc } = await admin
        .from("scouts")
        .select("id, name, registration_id, section")
        .in("id", topScoutIds);
      scoutMap = Object.fromEntries((sc ?? []).map((s) => [s.id, { name: s.name, registration_id: s.registration_id, section: s.section }]));
    }
    const rankingScouts = topScoutIds.map((id) => ({
      scout_id: id,
      name: scoutMap[id]?.name ?? "—",
      registration_id: scoutMap[id]?.registration_id ?? null,
      section: scoutMap[id]?.section ?? null,
      files: scoutAgg[id].files,
      total_bytes: scoutAgg[id].bytes,
    }));

    // DB size + top tables via RPC-less SQL through pg (use REST is limited; use function on backend later). Use a simple approach: call a SECURITY DEFINER SQL via rpc? Not available. Use raw SQL via admin? Not available in supabase-js. Fallback: use pg_meta not available. Solution: create a helper RPC in DB. For now, compute using known constants is not acceptable — use fetch to PostgREST rpc. Skip precise numbers if unavailable.
    let dbSizeBytes = 0;
    let topTables: Array<{ table: string; bytes: number; rows: number }> = [];
    try {
      const { data: dbStats } = await admin.rpc("get_db_storage_stats");
      if (dbStats) {
        dbSizeBytes = Number((dbStats as any).db_bytes ?? 0);
        topTables = ((dbStats as any).tables ?? []) as any;
      }
    } catch (_) { /* rpc may not exist yet */ }

    // Threshold evaluation + alert dedup
    const alerts: Array<{ key: string; level: "warn" | "crit"; message: string; value: number; threshold: number }> = [];
    const pushAlert = (key: string, value: number, warn: number, crit: number, label: string) => {
      if (value >= crit) alerts.push({ key: `${key}:crit`, level: "crit", value, threshold: crit, message: `${label} atingiu nível CRÍTICO` });
      else if (value >= warn) alerts.push({ key: `${key}:warn`, level: "warn", value, threshold: warn, message: `${label} atingiu nível de atenção` });
    };
    if (cfg) {
      pushAlert("storage", totalStorage, cfg.storage_warn_bytes, cfg.storage_crit_bytes, "Storage total");
      pushAlert("db", dbSizeBytes, cfg.db_warn_bytes, cfg.db_crit_bytes, "Banco de dados");
      for (const b of buckets) pushAlert(`bucket:${b.bucket_id}`, b.total_bytes, cfg.bucket_warn_bytes, cfg.bucket_crit_bytes, `Bucket ${b.bucket_id}`);
    }

    // Fire dedup'd notifications
    if (alerts.length) {
      const since = new Date(Date.now() - DEDUP_WINDOW_HOURS * 3600_000).toISOString();
      const { data: recent } = await admin
        .from("storage_alerts_sent")
        .select("alert_key")
        .gte("sent_at", since);
      const seen = new Set((recent ?? []).map((r: any) => r.alert_key));
      const newOnes = alerts.filter((a) => !seen.has(a.key));
      if (newOnes.length) {
        const { data: admins } = await admin.from("user_roles").select("user_id").eq("role", "admin");
        const adminIds = (admins ?? []).map((r: any) => r.user_id as string);
        const notifs = adminIds.flatMap((uid) =>
          newOnes.map((a) => ({
            user_id: uid,
            type: `storage_${a.level}`,
            title: a.level === "crit" ? "🚨 Armazenamento crítico" : "⚠️ Atenção — armazenamento",
            message: `${a.message} (${(a.value / 1048576).toFixed(1)} MB / limite ${(a.threshold / 1048576).toFixed(0)} MB)`,
            priority: a.level === "crit" ? "high" : "medium",
            metadata: { alert_key: a.key, value_bytes: a.value, threshold_bytes: a.threshold },
          })),
        );
        if (notifs.length) await admin.from("security_notifications").insert(notifs);
        await admin.from("storage_alerts_sent").insert(newOnes.map((a) => ({
          alert_key: a.key, level: a.level, value_bytes: a.value, threshold_bytes: a.threshold,
        })));

        // --- E-mail para admins (via send-transactional-email) ---
        try {
          const { data: adminEmails } = await admin.rpc("get_admin_emails");
          const emails = ((adminEmails ?? []) as Array<{ email: string }>).map((r) => r.email).filter(Boolean);
          for (const a of newOnes) {
            const resource = a.key.split(":").slice(1, -1).join(":") || a.key.split(":")[0];
            const label = a.key.startsWith("bucket:")
              ? `Bucket ${resource}`
              : a.key.startsWith("db:") ? "Banco de dados" : "Storage total";
            for (const email of emails) {
              admin.functions.invoke("send-transactional-email", {
                body: {
                  templateName: "storage-alert",
                  recipientEmail: email,
                  idempotencyKey: `storage-alert-${a.key}-${new Date().toISOString().slice(0, 13)}`,
                  templateData: {
                    level: a.level,
                    resource: label,
                    valueMb: a.value / 1048576,
                    thresholdMb: a.threshold / 1048576,
                    message: a.message,
                  },
                },
              }).catch((e) => console.error("email invoke error:", e));
            }
          }
        } catch (e) {
          console.error("email dispatch error:", e);
        }

        // --- Push notification para admins com inscrição ativa ---
        try {
          if (adminIds.length) {
            const { data: subs } = await admin
              .from("push_subscriptions")
              .select("user_id")
              .in("user_id", adminIds);
            const pushUserIds = Array.from(new Set((subs ?? []).map((s: any) => s.user_id as string)));
            for (const a of newOnes) {
              const title = a.level === "crit" ? "🚨 Armazenamento crítico" : "⚠️ Atenção — armazenamento";
              const body = `${a.message} (${(a.value / 1048576).toFixed(1)} MB / limite ${(a.threshold / 1048576).toFixed(0)} MB)`;
              for (const uid of pushUserIds) {
                admin.functions.invoke("send-push-notification", {
                  body: { userId: uid, title, body, url: "/admin" },
                }).catch((e) => console.error("push invoke error:", e));
              }
            }
          }
        } catch (e) {
          console.error("push dispatch error:", e);
        }
      }
    }

    return json({
      generated_at: new Date().toISOString(),
      config: cfg,
      db_size_bytes: dbSizeBytes,
      top_tables: topTables,
      storage_total_bytes: totalStorage,
      buckets,
      ranking_users: rankingUsers,
      ranking_scouts: rankingScouts,
      alerts,
    });
  } catch (e) {
    console.error("storage-metrics error:", e);
    return json({ error: "Internal error", detail: (e as Error).message }, 500);
  }
});
