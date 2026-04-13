import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

  // Helper to recursively list all files in a bucket
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
          // It's a file
          totalBytes += (item.metadata as any)?.size || 0;
          fileCount++;
        } else {
          // It's a folder — recurse
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

  return Response.json({
    buckets: results,
    total_bytes: totalBytes,
    total_files: totalFiles,
  }, { headers: corsHeaders });
});
