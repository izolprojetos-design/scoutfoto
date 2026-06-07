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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify caller
    const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
    if (userErr || !userData?.user) {
      console.error("getUser error:", userErr);
      return json({ error: "Unauthorized: invalid token", detail: userErr?.message }, 401);
    }
    const user = userData.user;

    const { data: isAdmin, error: roleErr } = await supabaseAdmin.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });
    if (roleErr) {
      console.error("has_role error:", roleErr);
      return json({ error: "Role check failed", detail: roleErr.message }, 500);
    }
    if (!isAdmin) {
      return json({ error: "Forbidden: admin only" }, 403);
    }

    const bucketIds = ["images", "scout-photos"];
    const results = [];

    const listAllFiles = async (bucketId: string, prefix = ""): Promise<{ size: number; count: number }> => {
      let totalBytes = 0;
      let fileCount = 0;

      const { data: items, error: listErr } = await supabaseAdmin.storage.from(bucketId).list(prefix, {
        limit: 1000,
      });
      if (listErr) {
        console.error(`list error bucket=${bucketId} prefix=${prefix}:`, listErr);
        return { size: 0, count: 0 };
      }

      if (items) {
        for (const item of items) {
          if (!item.name || item.name.startsWith(".")) continue;
          if (item.metadata) {
            totalBytes += (item.metadata as any)?.size || 0;
            fileCount++;
          } else {
            const subPath = prefix ? `${prefix}/${item.name}` : item.name;
            const sub = await listAllFiles(bucketId, subPath);
            totalBytes += sub.size;
            fileCount += sub.count;
          }
        }
      }

      return { size: totalBytes, count: fileCount };
    };

    for (const bucketId of bucketIds) {
      const { size: totalBytes, count: fileCount } = await listAllFiles(bucketId);
      results.push({
        bucket_id: bucketId,
        files: fileCount,
        total_bytes: totalBytes,
      });
    }

    const totalBytes = results.reduce((s, r) => s + r.total_bytes, 0);
    const totalFiles = results.reduce((s, r) => s + r.files, 0);

    return json({
      buckets: results,
      total_bytes: totalBytes,
      total_files: totalFiles,
    });
  } catch (err) {
    console.error("storage-stats error:", err);
    return json({ error: "Internal error", detail: (err as Error).message }, 500);
  }
});
