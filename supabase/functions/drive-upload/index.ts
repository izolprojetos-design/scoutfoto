import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function refreshGoogleAccessToken(refreshToken: string, clientId: string, clientSecret: string) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("Erro ao renovar token do Google:", err);
    throw new Error("Falha ao renovar token do Google Drive");
  }

  const data = await response.json();
  return data;
}

// Helper para buscar ou criar pasta no Google Drive
async function getOrCreateFolder(accessToken: string, folderName: string, parentId?: string): Promise<string> {
  let query = `mimeType='application/vnd.google-apps.folder' and name='${folderName}' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const searchRes = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name)`, {
    headers: { 'Authorization': `Bearer ${accessToken}` }
  });

  const searchData = await searchRes.json();

  if (searchData.files && searchData.files.length > 0) {
    return searchData.files[0].id;
  }

  // Se não existir, criar a pasta
  const createBody: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  
  if (parentId) {
    createBody.parents = [parentId];
  }

  const createRes = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(createBody)
  });

  if (!createRes.ok) {
    throw new Error(`Falha ao criar pasta ${folderName}`);
  }

  const createData = await createRes.json();
  return createData.id;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const formData = await req.formData();
    const ramo = formData.get('ramo') as string;
    const nome = formData.get('nome') as string;
    const dataEvento = formData.get('data') as string; // yyyy-mm-dd
    const file = formData.get('file') as File;

    if (!ramo || !nome || !dataEvento || !file) {
      return new Response(JSON.stringify({ error: 'Parâmetros incompletos' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Inicializa Supabase e valida sessão
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized user' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // 1. Obter o token do Google do usuário do banco de dados
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: tokenRecord, error: tokenError } = await supabaseAdmin
      .from('user_google_tokens')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (tokenError || !tokenRecord) {
      return new Response(JSON.stringify({ error: 'Google Drive não conectado' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    let accessToken = tokenRecord.access_token;

    // Verificar se expirou ou está perto de expirar (margem de 5 minutos)
    const expiresAt = new Date(tokenRecord.expires_at).getTime();
    if (Date.now() > expiresAt - 5 * 60 * 1000) {
      // Renovar
      const clientId = Deno.env.get('GOOGLE_OAUTH_CLIENT_ID');
      const clientSecret = Deno.env.get('GOOGLE_OAUTH_CLIENT_SECRET');

      if (!clientId || !clientSecret) {
        throw new Error("Client ID ou Secret do Google não configurados no servidor.");
      }

      if (!tokenRecord.refresh_token) {
        throw new Error("Refresh token ausente. Refaça o login no Google Drive.");
      }

      const refreshed = await refreshGoogleAccessToken(tokenRecord.refresh_token, clientId, clientSecret);
      accessToken = refreshed.access_token;
      
      const newExpiresAt = new Date(Date.now() + refreshed.expires_in * 1000).toISOString();
      
      await supabaseAdmin.from('user_google_tokens').update({
        access_token: accessToken,
        expires_at: newExpiresAt
      }).eq('user_id', user.id);
    }

    // 2. Criar a estrutura ScoutFoto > Ramo > Nome > Data
    const rootFolderId = await getOrCreateFolder(accessToken, 'ScoutFoto');
    const ramoFolderId = await getOrCreateFolder(accessToken, ramo, rootFolderId);
    const nomeFolderId = await getOrCreateFolder(accessToken, nome, ramoFolderId);
    const dataFolderId = await getOrCreateFolder(accessToken, dataEvento, nomeFolderId);

    // 3. Fazer o Upload do arquivo
    const metadata = {
      name: file.name,
      parents: [dataFolderId],
      description: 'Upload via ScoutFoto App'
    };


    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const close_delim = `\r\n--${boundary}--`;

    const fileBuffer = await file.arrayBuffer();

    const multipartBody = new Blob([
      delimiter,
      'Content-Type: application/json\r\n\r\n',
      JSON.stringify(metadata),
      delimiter,
      `Content-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`,
      fileBuffer,
      close_delim
    ]);

    const uploadRes = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartBody
    });

    if (!uploadRes.ok) {
      const err = await uploadRes.text();
      console.error("Erro no upload do Google Drive:", err);
      throw new Error('Falha no upload do arquivo');
    }

    const uploadData = await uploadRes.json();

    return new Response(JSON.stringify({ 
      success: true, 
      fileId: uploadData.id,
      folderId: dataFolderId,
      folderLink: `https://drive.google.com/drive/folders/${dataFolderId}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro na função drive-upload:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
