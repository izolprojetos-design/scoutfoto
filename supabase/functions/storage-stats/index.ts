import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // Verify caller is admin
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const { data: { user } } = await createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } }
  ).auth.getUser();

  if (!user) return new Response("Unauthorized", { status: 401, headers: corsHeaders });

  const { data: isAdmin } = await supabaseAdmin.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (!isAdmin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

  // Query storage.objects for real sizes using admin client + raw SQL via rpc
  // We'll list files from each bucket and sum metadata sizes
  const bucketIds = ["images", "scout-photos"];
  const results = [];

  for (const bucketId of bucketIds) {
    const { data: files, error } = await supabaseAdmin.storage.from(bucketId).list("", {
      limit: 1000,
      sortBy: { column: "created_at", order: "desc" },
    });

    let totalBytes = 0;
    let fileCount = 0;

    if (files) {
      for (const file of files) {
        if (!file.name || file.name.startsWith(".") || !file.metadata) continue;
        totalBytes += (file.metadata as any)?.size || 0;
        fileCount++;
      }
    }

    // Also check subfolders (e.g. arquivadas/ in scout-photos)
    if (bucketId === "scout-photos") {
      const { data: archivedFiles } = await supabaseAdmin.storage.from(bucketId).list("arquivadas", {
        limit: 500,
      });
      if (archivedFiles) {
        for (const file of archivedFiles) {
          if (!file.name || file.name.startsWith(".") || !file.metadata) continue;
          totalBytes += (file.metadata as any)?.size || 0;
          fileCount++;
        }
      }
    }

    results.push({
      bucket_id: bucketId,
      files: fileCount,
      total_bytes: totalBytes,
    });
  }

  const totalBytes = results.reduce((s, r) => s + r.total_bytes, 0);
  const totalFiles = results.reduce((s, r) => s + r.files, 0);

  return Response.json({
    buckets: results,
    total_bytes: totalBytes,
    total_files: totalFiles,
  }, { headers: corsHeaders });
});
