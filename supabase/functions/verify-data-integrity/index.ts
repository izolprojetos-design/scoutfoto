import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized: missing bearer" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

    // Verify caller & admin
    const { data: userData, error: userErr } = await admin.auth.getUser(token);
    if (userErr || !userData?.user) return json({ error: "Unauthorized" }, 401);
    const user = userData.user;

    const { data: isAdmin } = await admin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin" as unknown as string,
    });
    if (!isAdmin) return json({ error: "Forbidden: admin only" }, 403);

    // ===== 1) Ground truth via service_role (bypassa RLS) =====
    const { count: scoutsTotal } = await admin
      .from("scouts")
      .select("id", { count: "exact", head: true });
    const { count: scoutsActive } = await admin
      .from("scouts")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);
    const { count: photosTotal } = await admin
      .from("scout_photos")
      .select("id", { count: "exact", head: true });

    // Distribuição por ramo (ativos)
    const { data: byBranch } = await admin
      .from("scouts")
      .select("branch")
      .eq("is_active", true);
    const branchCounts: Record<string, number> = {};
    (byBranch ?? []).forEach((r: any) => {
      const k = r.branch ?? "sem_ramo";
      branchCounts[k] = (branchCounts[k] ?? 0) + 1;
    });

    // Contagem de arquivos no bucket scout-photos
    const listAll = async (
      bucketId: string,
      prefix = "",
    ): Promise<number> => {
      let count = 0;
      const { data: items, error } = await admin.storage
        .from(bucketId)
        .list(prefix, { limit: 1000 });
      if (error || !items) return 0;
      for (const item of items) {
        if (!item.name || item.name.startsWith(".")) continue;
        if (item.metadata) count++;
        else count += await listAll(bucketId, prefix ? `${prefix}/${item.name}` : item.name);
      }
      return count;
    };
    const storageScoutPhotos = await listAll("scout-photos");
    const storageImages = await listAll("images");

    // ===== 2) Visibilidade real para o usuário chamador (respeita RLS) =====
    const asCaller = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { count: scoutsVisible, error: visErr } = await asCaller
      .from("scouts")
      .select("id", { count: "exact", head: true })
      .eq("is_active", true);
    const { count: photosVisible } = await asCaller
      .from("scout_photos")
      .select("id", { count: "exact", head: true });

    // ===== 3) Diagnóstico final =====
    const expectedActive = 81;
    const ok =
      (scoutsActive ?? 0) >= expectedActive &&
      (scoutsVisible ?? 0) === (scoutsActive ?? 0);

    return json({
      ok,
      expected_active: expectedActive,
      db: {
        scouts_total: scoutsTotal ?? 0,
        scouts_active: scoutsActive ?? 0,
        scout_photos: photosTotal ?? 0,
        by_branch: branchCounts,
      },
      storage: {
        "scout-photos": storageScoutPhotos,
        images: storageImages,
      },
      caller_visibility: {
        user_id: user.id,
        scouts_active_visible: scoutsVisible ?? 0,
        scout_photos_visible: photosVisible ?? 0,
        rls_error: visErr?.message ?? null,
      },
      messages: {
        data_present:
          (scoutsActive ?? 0) >= expectedActive
            ? `✅ ${scoutsActive} integrantes ativos no banco (esperado ≥ ${expectedActive})`
            : `❌ Apenas ${scoutsActive} integrantes ativos (esperado ${expectedActive})`,
        rls_ok:
          (scoutsVisible ?? 0) === (scoutsActive ?? 0)
            ? "✅ RLS liberando leitura para este usuário"
            : `⚠️ RLS bloqueando: você enxerga ${scoutsVisible} de ${scoutsActive}`,
        photos:
          storageScoutPhotos > 0
            ? `✅ ${storageScoutPhotos} arquivos no bucket scout-photos`
            : "⚠️ Nenhum arquivo no bucket scout-photos",
      },
    });
  } catch (err) {
    console.error("verify-data-integrity error:", err);
    return json({ error: "Internal error", detail: (err as Error).message }, 500);
  }
});
