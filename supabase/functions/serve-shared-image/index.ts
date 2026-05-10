import { createClient } from "https://esm.sh/@supabase/supabase-js@2.98.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const token = url.searchParams.get("token");
    const storagePath = url.searchParams.get("path");

    if (!token || !storagePath) {
      return new Response(JSON.stringify({ error: "Missing token or path" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate storagePath: only allow safe characters (alphanumeric, slash, dot, dash, underscore)
    // Prevent PostgREST filter injection via the .or() builder.
    if (!/^[\w\-./]+$/.test(storagePath) || storagePath.includes("..") || storagePath.length > 512) {
      return new Response(JSON.stringify({ error: "Invalid path" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate token format too (share tokens are short alphanumeric strings)
    if (!/^[\w-]{6,128}$/.test(token)) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Validate share token
    const { data: linkRows, error: linkError } = await supabase
      .rpc("get_share_link_by_token", { p_token: token });

    if (linkError || !linkRows?.length) {
      return new Response(JSON.stringify({ error: "Invalid or expired token" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const link = linkRows[0];

    // Verify the image belongs to the event - use two parameterized queries
    // instead of raw .or() string interpolation to eliminate injection risk.
    const baseSelect = () =>
      supabase
        .from("images")
        .select("id, event_id, minor_age, visibility, storage_path, thumbnail_path")
        .eq("event_id", link.event_id)
        .is("minor_age", null)
        .in("visibility", ["public", "group"])
        .limit(1);

    let { data: imageRows } = await baseSelect().eq("storage_path", storagePath);
    if (!imageRows?.length) {
      ({ data: imageRows } = await baseSelect().eq("thumbnail_path", storagePath));
    }
    const image = imageRows?.[0];

    if (!image) {
      return new Response(JSON.stringify({ error: "Image not found or access denied" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate a short-lived signed URL
    const { data: signedData, error: signError } = await supabase.storage
      .from("images")
      .createSignedUrl(storagePath, 300); // 5 min

    if (signError || !signedData?.signedUrl) {
      return new Response(JSON.stringify({ error: "Failed to generate URL" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ url: signedData.signedUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
