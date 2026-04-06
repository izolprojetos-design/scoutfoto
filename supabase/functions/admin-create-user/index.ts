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
    const { data: { user: callerUser }, error: callerError } = await anonClient.auth.getUser(token);
    if (callerError || !callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: resHeaders });
    }

    const callerId = callerUser.id;

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
      const { email, password, name, role, section } = body;

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

      // Set must_change_password flag so user is forced to change on first login
      if (newUser.user) {
        // Small delay to ensure profile trigger has completed
        await new Promise(resolve => setTimeout(resolve, 500));
        const updateData: Record<string, unknown> = { must_change_password: true };
        if (section) updateData.section = section;
        await serviceClient
          .from("profiles")
          .update(updateData)
          .eq("user_id", newUser.user.id);
      }

      // Update role if provided and not default
      if (role && role !== "viewer" && newUser.user) {
        // The trigger creates a 'viewer' role, so we update it
        // Small delay to ensure trigger has completed
        await new Promise(resolve => setTimeout(resolve, 500));
        const { error: roleError } = await serviceClient
          .from("user_roles")
          .update({ role })
          .eq("user_id", newUser.user.id);
        
        // If update didn't affect any rows, insert instead
        if (roleError) {
          await serviceClient
            .from("user_roles")
            .upsert({ user_id: newUser.user.id, role }, { onConflict: "user_id" });
        }
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

    if (action === "register-invite") {
      const { token, name, email, password } = body;

      if (!token || !name || !email || !password) {
        return new Response(JSON.stringify({ error: "Dados incompletos" }), { status: 400, headers: resHeaders });
      }

      // No auth needed for this action - use service client directly
      // Validate invite token
      const { data: invite, error: inviteError } = await serviceClient
        .from("invite_links")
        .select("*")
        .eq("token", token)
        .single();

      if (inviteError || !invite) {
        return new Response(JSON.stringify({ error: "Link de convite inválido" }), { status: 400, headers: resHeaders });
      }

      if (invite.used_at) {
        return new Response(JSON.stringify({ error: "Este link já foi utilizado" }), { status: 400, headers: resHeaders });
      }

      if (new Date(invite.expires_at) < new Date()) {
        return new Response(JSON.stringify({ error: "Este link expirou" }), { status: 400, headers: resHeaders });
      }

      // Create user
      const { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: resHeaders });
      }

      if (newUser.user) {
        await new Promise(resolve => setTimeout(resolve, 500));

        // Update profile with section
        const updateData: Record<string, unknown> = {};
        if (invite.section) updateData.section = invite.section;
        if (Object.keys(updateData).length > 0) {
          await serviceClient.from("profiles").update(updateData).eq("user_id", newUser.user.id);
        }

        // Set role
        if (invite.role && invite.role !== "viewer") {
          await new Promise(resolve => setTimeout(resolve, 500));
          const { error: roleError } = await serviceClient
            .from("user_roles")
            .update({ role: invite.role })
            .eq("user_id", newUser.user.id);
          if (roleError) {
            await serviceClient
              .from("user_roles")
              .upsert({ user_id: newUser.user.id, role: invite.role }, { onConflict: "user_id" });
          }
        }

        // Mark invite as used
        await serviceClient
          .from("invite_links")
          .update({ used_at: new Date().toISOString(), used_by: newUser.user.id })
          .eq("id", invite.id);
      }

      return new Response(JSON.stringify({ success: true, user_id: newUser.user?.id }), { headers: resHeaders });
    }

    return new Response(JSON.stringify({ error: "Ação inválida" }), { status: 400, headers: resHeaders });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: resHeaders });
  }
});
