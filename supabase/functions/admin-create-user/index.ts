import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const resHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  try {
    // Verify caller is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: resHeaders });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await anonClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: resHeaders });
    }

    const callerId = claimsData.claims.sub as string;

    // Service role client for admin operations
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Check caller is admin
    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerId)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), { status: 403, headers: resHeaders });
    }

    const body = await req.json();
    const { action } = body;

    if (action === "create") {
      const { email, password, name, role } = body;

      if (!email || !password || !name) {
        return new Response(JSON.stringify({ error: "email, password e name são obrigatórios" }), { status: 400, headers: resHeaders });
      }

      // Create user with admin API
      const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: resHeaders });
      }

      // Update role if provided and not default
      if (role && role !== "viewer" && newUser.user) {
        await serviceClient.from("user_roles").update({ role }).eq("user_id", newUser.user.id);
      }

      return new Response(JSON.stringify({ success: true, user_id: newUser.user?.id }), { headers: resHeaders });
    }

    if (action === "reset-password") {
      const { user_id, new_password } = body;

      if (!user_id || !new_password) {
        return new Response(JSON.stringify({ error: "user_id e new_password são obrigatórios" }), { status: 400, headers: resHeaders });
      }

      const { error: updateError } = await serviceClient.auth.admin.updateUserById(user_id, {
        password: new_password,
      });

      if (updateError) {
        return new Response(JSON.stringify({ error: updateError.message }), { status: 400, headers: resHeaders });
      }

      return new Response(JSON.stringify({ success: true }), { headers: resHeaders });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), { status: 400, headers: resHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: resHeaders });
  }
});
