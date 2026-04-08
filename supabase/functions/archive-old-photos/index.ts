import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(
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
  
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (!isAdmin) return new Response("Forbidden", { status: 403, headers: corsHeaders });

  // List all files
  const { data: files, error } = await supabase.storage.from("scout-photos").list("", {
    limit: 500, sortBy: { column: "created_at", order: "desc" },
  });
  if (error) return Response.json({ error: error.message }, { status: 500, headers: corsHeaders });

  // Get scouts
  const { data: scouts } = await supabase.from("scouts").select("id, name");
  const scoutIdMap = new Map<string, string>();
  const scoutNames: string[] = [];
  scouts?.forEach((s) => { scoutIdMap.set(s.id, s.name); scoutNames.push(s.name); });

  const normalize = (str: string) =>
    str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]/g, "");

  const findScout = (filename: string): string | null => {
    const base = filename.split(".")[0];
    if (scoutIdMap.has(base)) return scoutIdMap.get(base)!;
    const n = normalize(base);
    for (const name of scoutNames) {
      const nn = normalize(name);
      if (nn === n || n.includes(nn) || nn.includes(n)) return name;
    }
    return null;
  };

  const groups = new Map<string, typeof files>();
  for (const file of files!) {
    if (!file.name || file.name.startsWith(".") || !file.metadata) continue;
    const scout = findScout(file.name);
    if (scout) {
      const key = normalize(scout);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(file);
    }
  }

  const moved: string[] = [];
  const errors: string[] = [];

  for (const [, groupFiles] of groups) {
    if (groupFiles!.length <= 1) continue;
    for (let i = 1; i < groupFiles!.length; i++) {
      const file = groupFiles![i];
      // Download
      const { data: blob, error: dlErr } = await supabase.storage.from("scout-photos").download(file.name);
      if (dlErr) { errors.push(`DL: ${file.name}`); continue; }

      const newPath = `arquivadas/${file.name}`;
      const buf = new Uint8Array(await blob.arrayBuffer());
      const { error: upErr } = await supabase.storage.from("scout-photos").upload(newPath, buf, {
        upsert: true, contentType: blob.type,
      });
      if (upErr) { errors.push(`UP: ${file.name}`); continue; }

      const { error: delErr } = await supabase.storage.from("scout-photos").remove([file.name]);
      if (delErr) { errors.push(`DEL: ${file.name}`); continue; }

      moved.push(`${file.name} → ${newPath}`);
    }
  }

  return Response.json({ moved, errors, totalFiles: files!.filter((f) => f.metadata).length }, { headers: corsHeaders });
});
