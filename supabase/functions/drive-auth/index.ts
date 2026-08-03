import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { code, redirectUri } = await req.json();

    if (!code || !redirectUri) {
      return new Response(JSON.stringify({ error: 'Missing code or redirectUri' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // 1. Pegar o usuário logado que fez a requisição
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Inicializar o Supabase Client com a chave de serviço para poder inserir na tabela (ou usar o token do usuário se o RLS permitir)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized user' }), { 
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // 2. Trocar o código no Google pelo Token
    const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
    const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');

    if (!clientId || !clientSecret) {
      throw new Error("Client ID ou Secret do Google não configurados no servidor.");
    }

    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error("Erro do Google Token:", tokenData);
      throw new Error(tokenData.error_description || "Falha ao obter token do Google");
    }

    // 3. Pegar informações básicas (Email do Google conectado)
    const userInfoResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      }
    });
    const userInfo = await userInfoResponse.json();

    // 4. Salvar na tabela user_google_tokens
    const expiresAt = new Date(Date.now() + tokenData.expires_in * 1000).toISOString();

    // Cria cliente com Service Role para ignorar RLS (caso seja necessário inserir para um admin) ou usar o próprio user auth
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { error: upsertError } = await supabaseAdmin
      .from('user_google_tokens')
      .upsert({
        user_id: user.id,
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token || '', // Se for re-login sem prompt=consent, pode não vir. Importante forçar prompt=consent na URL
        token_type: tokenData.token_type,
        scope: tokenData.scope,
        expires_at: expiresAt,
        google_email: userInfo.email || ''
      }, {
        onConflict: 'user_id'
      });

    if (upsertError) {
      console.error("Erro ao salvar token no DB:", upsertError);
      throw new Error("Falha ao salvar as credenciais no banco.");
    }

    return new Response(JSON.stringify({ success: true, email: userInfo.email }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro na função drive-auth:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
