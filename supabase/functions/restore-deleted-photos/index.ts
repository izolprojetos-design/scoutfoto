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

  // Restore everything in "arquivadas" folder
  console.log("Listing files...");
  const { data: files, error } = await supabaseAdmin.storage.from("scout-photos").list("arquivadas");
  
  if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });

  const restored = [];
  for (const file of (files || [])) {
    if (file.name.startsWith(".")) continue;
    
    const { data: blob, error: dlErr } = await supabaseAdmin.storage.from("scout-photos").download(`arquivadas/${file.name}`);
    if (dlErr) continue;

    const buf = new Uint8Array(await blob.arrayBuffer());
    const { error: upErr } = await supabaseAdmin.storage.from("scout-photos").upload(file.name, buf, {
      upsert: true, contentType: blob.type,
    });
    if (upErr) continue;

    await supabaseAdmin.storage.from("scout-photos").remove([`arquivadas/${file.name}`]);
    restored.push(file.name);
  }

  return new Response(JSON.stringify({ success: true, restoredCount: restored.length, restored }), { headers: corsHeaders });
});
