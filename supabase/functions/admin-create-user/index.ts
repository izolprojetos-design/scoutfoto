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
    const body = await req.json();
    const { action } = body;

    // Service role client for admin operations
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── register-invite: does NOT require authentication ──
    if (action === "register-invite") {
      const { token, name, email, password } = body;

      if (!token || !name || !email || !password) {
        return new Response(JSON.stringify({ error: "Dados incompletos" }), { status: 400, headers: resHeaders });
      }

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

        const updateData: Record<string, unknown> = {};
        if (invite.section) updateData.section = invite.section;
        if (Object.keys(updateData).length > 0) {
          await serviceClient.from("profiles").update(updateData).eq("user_id", newUser.user.id);
        }

        if (invite.role) {
          await new Promise(resolve => setTimeout(resolve, 500));
          await serviceClient.from("user_roles").delete().eq("user_id", newUser.user.id);
          await serviceClient.from("user_roles").insert({ user_id: newUser.user.id, role: invite.role });
        }

        await serviceClient
          .from("invite_links")
          .update({ used_at: new Date().toISOString(), used_by: newUser.user.id })
          .eq("id", invite.id);
      }

      return new Response(JSON.stringify({ success: true, user_id: newUser.user?.id }), { headers: resHeaders });
    }

    // ── All other actions require admin authentication ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: resHeaders });
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const jwt = authHeader.replace("Bearer ", "");
    const { data: { user: callerUser }, error: callerError } = await anonClient.auth.getUser(jwt);
    if (callerError || !callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: resHeaders });
    }

    const { data: roleData } = await serviceClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id)
      .eq("role", "admin")
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), { status: 403, headers: resHeaders });
    }

    if (action === "create") {
      let { email, password, name, role, section, user_number, cargo_1, cargo_2 } = body;

      if (!user_number) {
        const { data: nextNum } = await serviceClient.rpc("get_next_user_number");
        if (nextNum) user_number = nextNum;
      }

      if (!email || !password || !name) {
        return new Response(JSON.stringify({ error: "email, password e name são obrigatórios" }), { status: 400, headers: resHeaders });
      }

      let { data: newUser, error: createError } = await serviceClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { name },
      });

      // Recover from orphan auth.users (profile was deleted but auth user remains)
      if (createError && /already been registered|already exists/i.test(createError.message)) {
        const { data: list } = await serviceClient.auth.admin.listUsers();
        const existing = list?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
        if (existing) {
          const { count } = await serviceClient
            .from("profiles")
            .select("user_id", { count: "exact", head: true })
            .eq("user_id", existing.id);
          if (!count || count === 0) {
            await serviceClient.auth.admin.deleteUser(existing.id);
            const recreated = await serviceClient.auth.admin.createUser({
              email,
              password,
              email_confirm: true,
              user_metadata: { name },
            });
            newUser = recreated.data;
            createError = recreated.error;
          }
        }
      }

      if (createError) {
        return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: resHeaders });
      }


      if (newUser.user) {
        await new Promise(resolve => setTimeout(resolve, 500));
        const updateData: Record<string, unknown> = { must_change_password: true };
        if (section) updateData.section = section;
        if (user_number) updateData.user_number = user_number;
        if (cargo_1) updateData.cargo_1 = cargo_1;
        if (cargo_2) updateData.cargo_2 = cargo_2;

        const { error: updateProfileError } = await serviceClient.from("profiles").update(updateData).eq("user_id", newUser.user.id);
        
        if (updateProfileError) {
          // If unique constraint violation
          if (updateProfileError.code === '23505') {
             return new Response(JSON.stringify({ error: "Este ID já está em uso. Por favor, tente outro." }), { status: 400, headers: resHeaders });
          }
          return new Response(JSON.stringify({ error: `Erro ao atualizar perfil: ${updateProfileError.message}` }), { status: 400, headers: resHeaders });
        }
      }

      if (role && newUser.user) {
        await new Promise(resolve => setTimeout(resolve, 500));
        await serviceClient.from("user_roles").delete().eq("user_id", newUser.user.id);
        await serviceClient.from("user_roles").insert({ user_id: newUser.user.id, role });
      }

      return new Response(JSON.stringify({ success: true, user_id: newUser.user?.id }), { headers: resHeaders });
    }

    if (action === "signout-user") {
      const { user_id } = body;

      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id é obrigatório" }), { status: 400, headers: resHeaders });
      }

      if (user_id === callerUser.id) {
        return new Response(JSON.stringify({ error: "Você não pode derrubar sua própria sessão por aqui" }), { status: 400, headers: resHeaders });
      }

      // Run revocation + force-refresh bump in parallel for lower latency.
      const [revokeRes, refreshRes] = await Promise.all([
        serviceClient.rpc("admin_signout_user", {
          p_user_id: user_id,
          p_admin_user_id: callerUser.id,
        }),
        serviceClient
          .from("profiles")
          .update({ force_refresh_at: new Date().toISOString() })
          .eq("user_id", user_id),
      ]);

      if (revokeRes.error) {
        return new Response(JSON.stringify({ error: `Falha ao encerrar sessões: ${revokeRes.error.message}` }), { status: 400, headers: resHeaders });
      }
      if (refreshRes.error) {
        // Non-fatal: sessions are already killed; just log.
        console.warn("force_refresh_at bump failed:", refreshRes.error.message);
      }

      return new Response(JSON.stringify({ success: true }), { headers: resHeaders });
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
