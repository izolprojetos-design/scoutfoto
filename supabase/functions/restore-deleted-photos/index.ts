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

  // Restore everything in "arquivadas" folder
  console.log("Listing files...");
  const { data: files, error } = await supabaseAdmin.storage.from("scout-photos").list("arquivadas");
  
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });

  const restored = [];
  for (const file of (files || [])) {
    if (file.name.startsWith(".")) continue;
    
    console.log(`Processing ${file.name}...`);
    const { data: blob, error: dlErr } = await supabaseAdmin.storage.from("scout-photos").download(`arquivadas/${file.name}`);
    if (dlErr) {
        console.error(`Download error for ${file.name}:`, dlErr.message);
        continue;
    }

    const buf = new Uint8Array(await blob.arrayBuffer());
    const { error: upErr } = await supabaseAdmin.storage.from("scout-photos").upload(file.name, buf, {
      upsert: true, contentType: blob.type,
    });
    if (upErr) {
        console.error(`Upload error for ${file.name}:`, upErr.message);
        continue;
    }

    await supabaseAdmin.storage.from("scout-photos").remove([`arquivadas/${file.name}`]);
    restored.push(file.name);
  }

  return new Response(JSON.stringify({ success: true, restoredCount: restored.length, restored }), { headers: corsHeaders });
});
