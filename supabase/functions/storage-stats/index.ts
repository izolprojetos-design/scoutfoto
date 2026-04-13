import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      console.error("No Authorization header provided");
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Use anon key client with user's token to verify identity
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();

    if (userError || !user) {
      console.error("Auth error:", userError?.message || "No user found");
      return new Response(JSON.stringify({ error: "Unauthorized", detail: userError?.message }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Query storage.objects for real sizes
    const bucketIds = ["images", "scout-photos"];
    const results = [];

    const listAllFiles = async (bucketId: string, prefix = ""): Promise<{ size: number; count: number }> => {
      let totalBytes = 0;
      let fileCount = 0;

      const { data: items } = await supabaseAdmin.storage.from(bucketId).list(prefix, {
        limit: 1000,
      });

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

    return new Response(JSON.stringify({
      buckets: results,
      total_bytes: totalBytes,
      total_files: totalFiles,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
