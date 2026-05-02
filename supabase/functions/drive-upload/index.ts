import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { SignJWT, importPKCS8 } from "https://deno.land/x/jose@v4.14.4/index.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

async function getGoogleDriveAccessToken() {
  // O usuário deverá configurar as variáveis GOOGLE_CLIENT_EMAIL e GOOGLE_PRIVATE_KEY no Supabase Vault ou Secrets
  const clientEmail = Deno.env.get('GOOGLE_CLIENT_EMAIL');
  let privateKey = Deno.env.get('GOOGLE_PRIVATE_KEY');

  if (!clientEmail || !privateKey) {
    throw new Error("Credenciais do Google Drive não configuradas no servidor.");
  }

  // Corrigir quebras de linha na chave privada (caso tenha sido inserida numa única linha)
  privateKey = privateKey.replace(/\\n/g, '\n');

  const algorithm = 'RS256';
  const privateKeyObj = await importPKCS8(privateKey, algorithm);

  const jwt = await new SignJWT({ scope: 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive' })
    .setProtectedHeader({ alg: algorithm, typ: 'JWT' })
    .setIssuer(clientEmail)
    .setAudience('https://oauth2.googleapis.com/token')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(privateKeyObj);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    console.error("Erro ao obter token do Google:", err);
    throw new Error("Falha ao autenticar com o Google Drive");
  }

  const data = await response.json();
  return data.access_token;
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
  
  // Como estamos usando Service Account, precisamos dar permissão de visualização para o link funcionar (Opcional, mas útil para o admin ver o link)
  // Mas como a pasta raiz já pode ter permissão, as subpastas herdam. Vamos assumir que herda.
  
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

    console.log(`Recebido upload para Ramo: ${ramo}, Nome: ${nome}, Data: ${dataEvento}, Arquivo: ${file.name}`);

    // 1. Autenticar no Google
    const accessToken = await getOrCreateFolder.accessToken || await getGoogleDriveAccessToken();

    // 2. Criar a estrutura ScoutFoto > Ramo > Nome > Data
    // Opcional: Se houver um ID Fixo para a pasta RAIZ do ScoutFoto, o cliente pode colocar na variável de ambiente GOOGLE_DRIVE_ROOT_FOLDER_ID
    const rootFolderId = Deno.env.get('GOOGLE_DRIVE_ROOT_FOLDER_ID') || await getOrCreateFolder(accessToken, 'ScoutFoto');
    const ramoFolderId = await getOrCreateFolder(accessToken, ramo, rootFolderId);
    const nomeFolderId = await getOrCreateFolder(accessToken, nome, ramoFolderId);
    const dataFolderId = await getOrCreateFolder(accessToken, dataEvento, nomeFolderId);

    // 3. Fazer o Upload do arquivo
    // Usamos o upload multipart para enviar metadata e o arquivo de uma vez
    const metadata = {
      name: file.name,
      parents: [dataFolderId]
    };

    const boundary = '-------314159265358979323846';
    const delimiter = `\r\n--${boundary}\r\n`;
    const close_delim = `\r\n--${boundary}--`;

    const fileBuffer = await file.arrayBuffer();

    // Construir o corpo da requisição multipart (não é recomendado para arquivos super gigantes, mas fotos até 10MB é ok)
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
