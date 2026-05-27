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

  console.log('--- Iniciando reprocessamento de fotos (via Edge Function) ---');
  
  const { data: photos, error } = await supabaseAdmin
    .from('scout_photos')
    .select('id, storage_path, created_at, scout_id');

  if (error) {
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }

  const scoutIds = [...new Set((photos || []).map(p => p.scout_id).filter(Boolean))];
  const { data: scouts, error: scoutsError } = await supabaseAdmin
    .from('scouts')
    .select('id, name, registration_id')
    .in('id', scoutIds);

  if (scoutsError) {
    return Response.json({ error: scoutsError.message }, { status: 500, headers: corsHeaders });
  }

  const scoutsMap = new Map((scouts || []).map(s => [s.id, s]));

  const results = [];
  for (const photo of (photos || [])) {
    try {
      const scout = scoutsMap.get(photo.scout_id);
      if (!scout) continue;

      const pathParts = photo.storage_path.split('/');
      const currentFilename = pathParts[pathParts.length - 1];
      const datePart = photo.created_at.split('T')[0];
      
      const safeName = scout.name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9_\-]/g, '_')
        .replace(/_+/g, '_').replace(/^_|_$/g, '').substring(0, 40).toUpperCase();
      
      const safeId = (scout.registration_id || photo.scout_id.slice(0, 8)).replace(/[^a-zA-Z0-9]/g, '');
      const ext = currentFilename.split('.').pop() || 'jpg';
      
      const newFilename = `${safeName}_${safeId}_${datePart}_${photo.id.slice(0, 4)}.${ext}`;
      pathParts[pathParts.length - 1] = newFilename;
      const newPath = pathParts.join('/');

      if (photo.storage_path === newPath) continue;

      // Move in Storage
      const { error: moveError } = await supabaseAdmin.storage
        .from('scout-photos')
        .move(photo.storage_path, newPath);

      if (moveError) {
        results.push({ id: photo.id, status: 'error', error: `Move: ${moveError.message}` });
        continue;
      }

      // Update DB
      const { error: dbUpdateError } = await supabaseAdmin
        .from('scout_photos')
        .update({ storage_path: newPath })
        .eq('id', photo.id);

      if (dbUpdateError) {
        results.push({ id: photo.id, status: 'error', error: `DB: ${dbUpdateError.message}` });
      } else {
        results.push({ id: photo.id, status: 'success', from: photo.storage_path, to: newPath });
      }
    } catch (err: any) {
      results.push({ id: photo.id, status: 'error', error: err.message });
    }
  }

  return Response.json({ results, total: results.length }, { headers: corsHeaders });
});