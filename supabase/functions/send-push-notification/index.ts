import { createClient } from "jsr:@supabase/supabase-js@2";
import * as webpush from "jsr:@negrel/webpush@0.5";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");

    if (!vapidPublicKey || !vapidPrivateKey) {
      return new Response(
        JSON.stringify({ error: "VAPID keys not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- Authentication: require a valid JWT (or service-role for internal calls) ----
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const bearer = authHeader.replace("Bearer ", "").trim();
    const isServiceRole = bearer === serviceRoleKey;

    let callerId: string | null = null;
    if (!isServiceRole) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: userData, error: userError } = await userClient.auth.getUser();
      if (userError || !userData?.user) {
        return new Response(
          JSON.stringify({ error: "Unauthorized" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      callerId = userData.user.id;
    }

    // Parse request
    const { userId, title, body: msgBody, icon, url, data } = await req.json();

    if (!userId || !title) {
      return new Response(
        JSON.stringify({ error: "userId and title are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ---- Authorization: caller may only target self, unless admin or service-role ----
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    if (!isServiceRole && userId !== callerId) {
      const { data: isAdmin } = await supabase.rpc("has_role", {
        _user_id: callerId,
        _role: "admin",
      });
      if (!isAdmin) {
        return new Response(
          JSON.stringify({ error: "Forbidden: cannot send notifications to other users" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }


    // Fetch subscriptions for the user
    const { data: subscriptions, error: fetchError } = await supabase
      .from("push_subscriptions")
      .select("*")
      .eq("user_id", userId);

    if (fetchError) {
      console.error("Error fetching subscriptions:", fetchError);
      return new Response(
        JSON.stringify({ error: "Failed to fetch subscriptions" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!subscriptions || subscriptions.length === 0) {
      return new Response(
        JSON.stringify({ error: "No push subscriptions found for user", sent: 0 }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Import VAPID keys
    const vapidKeys = await webpush.importVapidKeys({
      publicKey: vapidPublicKey,
      privateKey: vapidPrivateKey,
    }, { extractable: false });

    // Create application server
    const appServer = await webpush.ApplicationServer.new({
      contactInformation: "mailto:admin@scoutfoto.app",
      vapidKeys,
    });

    const payload = JSON.stringify({
      title: title,
      body: msgBody || "",
      icon: icon || "/icons/icon-192x192.png",
      badge: "/icons/icon-72x72.png",
      url: url || "/",
      data: data || {},
    });

    let sent = 0;
    let failed = 0;
    const failedEndpoints: string[] = [];

    for (const sub of subscriptions) {
      try {
        const pushSub = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth,
          },
        };

        const subscriber = appServer.subscribe(pushSub);
        const httpReq = await subscriber.pushTextMessage(payload, {});
        
        const response = await fetch(httpReq.endpoint, {
          method: httpReq.method,
          headers: httpReq.headers,
          body: httpReq.body,
        });

        if (response.ok || response.status === 201) {
          sent++;
        } else if (response.status === 410 || response.status === 404) {
          // Subscription expired or invalid — remove it
          await supabase
            .from("push_subscriptions")
            .delete()
            .eq("id", sub.id);
          failed++;
          failedEndpoints.push(sub.endpoint.substring(0, 50));
        } else {
          console.error(`Push failed for ${sub.endpoint.substring(0, 50)}: ${response.status}`);
          failed++;
        }
      } catch (err) {
        console.error(`Push error for sub ${sub.id}:`, err);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ sent, failed, total: subscriptions.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("send-push-notification error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
