// Public endpoint to confirm a scheduling request via token.
// No JWT required — confirmation links are sent by email and validated by token.

import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, serviceKey)

  let token: string | null = null

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url)
      token = url.searchParams.get('token')
    } else {
      const body = await req.json().catch(() => ({}))
      token = body?.token ?? null
    }
  } catch {
    // ignore
  }

  if (!token || typeof token !== 'string' || token.length < 10) {
    return new Response(
      JSON.stringify({ error: 'Token inválido' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Look up the request
  const { data: request, error: fetchError } = await supabase
    .from('scheduling_requests')
    .select('id, status, token_expires_at, nome_responsavel, data, horario, local, tipo, descricao')
    .eq('token_confirmacao', token)
    .maybeSingle()

  if (fetchError) {
    console.error('Failed to look up scheduling request', fetchError)
    return new Response(
      JSON.stringify({ error: 'Erro ao validar solicitação' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (!request) {
    return new Response(
      JSON.stringify({ error: 'not_found', message: 'Solicitação não encontrada ou link inválido' }),
      { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const expired = new Date(request.token_expires_at).getTime() < Date.now()
  if (expired) {
    return new Response(
      JSON.stringify({ error: 'expired', message: 'Este link de confirmação expirou (válido por 72h)' }),
      { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // GET = check only, return current status
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({
        valid: true,
        status: request.status,
        alreadyConfirmed: request.status !== 'pendente',
        request: {
          nome_responsavel: request.nome_responsavel,
          data: request.data,
          horario: request.horario,
          local: request.local,
          tipo: request.tipo,
          descricao: request.descricao,
        },
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // POST = perform confirmation
  if (request.status === 'confirmado_email' || request.status === 'aprovado') {
    return new Response(
      JSON.stringify({ success: true, alreadyConfirmed: true, status: request.status }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  if (request.status !== 'pendente') {
    return new Response(
      JSON.stringify({ error: 'invalid_status', status: request.status, message: 'Esta solicitação já foi processada' }),
      { status: 409, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  const { error: updateError } = await supabase
    .from('scheduling_requests')
    .update({ status: 'confirmado_email', updated_at: new Date().toISOString() })
    .eq('id', request.id)

  if (updateError) {
    console.error('Failed to confirm scheduling request', updateError)
    return new Response(
      JSON.stringify({ error: 'Erro ao confirmar solicitação' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  return new Response(
    JSON.stringify({ success: true, status: 'confirmado_email' }),
    { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
})
