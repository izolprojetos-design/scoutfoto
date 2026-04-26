import { sendLovableEmail } from 'npm:@lovable.dev/email-js'
import { createClient } from 'npm:@supabase/supabase-js@2.45.4'

const MAX_RETRIES = 5
const DEFAULT_BATCH_SIZE = 10
const DEFAULT_SEND_DELAY_MS = 200
const DEFAULT_AUTH_TTL_MINUTES = 15
const DEFAULT_TRANSACTIONAL_TTL_MINUTES = 60

// Structured log helper — emits a single JSON line so logs are easily filterable.
type LogLevel = 'info' | 'warn' | 'error'
function logEvent(
  runId: string,
  level: LogLevel,
  event: string,
  data: Record<string, unknown> = {}
): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    run_id: runId,
    level,
    event,
    ...data,
  })
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.log(line)
}

interface QueueSummary {
  queue: string
  read: number
  sent: number
  failed: number
  rate_limited: number
  dlq_ttl: number
  dlq_max_retries: number
  dlq_forbidden: number
  duplicates_skipped: number
  read_errors: number
  delete_errors: number
}

function newQueueSummary(queue: string): QueueSummary {
  return {
    queue,
    read: 0,
    sent: 0,
    failed: 0,
    rate_limited: 0,
    dlq_ttl: 0,
    dlq_max_retries: 0,
    dlq_forbidden: 0,
    duplicates_skipped: 0,
    read_errors: 0,
    delete_errors: 0,
  }
}

// Check if an error is a rate-limit (429) response.
// Uses EmailAPIError.status when available (email-js >=0.x with structured errors),
// falls back to parsing the error message for older versions.
function isRateLimited(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as { status: number }).status === 429
  }
  return error instanceof Error && error.message.includes('429')
}

// Check if an error is a forbidden (403) response, which means emails are
// disabled for this project. Retrying won't help — move straight to DLQ.
function isForbidden(error: unknown): boolean {
  if (error && typeof error === 'object' && 'status' in error) {
    return (error as { status: number }).status === 403
  }
  return error instanceof Error && error.message.includes('403')
}

// Extract Retry-After seconds from a structured EmailAPIError, or default to 60s.
function getRetryAfterSeconds(error: unknown): number {
  if (error && typeof error === 'object' && 'retryAfterSeconds' in error) {
    return (error as { retryAfterSeconds: number | null }).retryAfterSeconds ?? 60
  }
  return 60
}

function parseJwtClaims(token: string): Record<string, unknown> | null {
  const parts = token.split('.')
  if (parts.length < 2) {
    return null
  }

  try {
    const payload = parts[1]
      .replaceAll('-', '+')
      .replaceAll('_', '/')
      .padEnd(Math.ceil(parts[1].length / 4) * 4, '=')

    return JSON.parse(atob(payload)) as Record<string, unknown>
  } catch {
    return null
  }
}

// Move a message to the dead letter queue and log the reason.
async function moveToDlq(
  supabase: ReturnType<typeof createClient<any>>,
  queue: string,
  msg: { msg_id: number; message: Record<string, any> },
  reason: string,
  runId: string,
  dlqKind: 'ttl' | 'max_retries' | 'forbidden' | 'other'
): Promise<void> {
  const payload = msg.message
  logEvent(runId, 'warn', 'message.dlq', {
    queue,
    msg_id: msg.msg_id,
    message_id: payload.message_id,
    recipient: payload.to,
    template: payload.label || queue,
    dlq_kind: dlqKind,
    reason,
  })
  await supabase.from('email_send_log').insert({
    message_id: payload.message_id,
    template_name: (payload.label || queue) as string,
    recipient_email: payload.to,
    status: 'dlq',
    error_message: reason,
  })
  const { error } = await supabase.rpc('move_to_dlq', {
    source_queue: queue,
    dlq_name: `${queue}_dlq`,
    message_id: msg.msg_id,
    payload,
  })
  if (error) {
    logEvent(runId, 'error', 'message.dlq.move_failed', {
      queue,
      msg_id: msg.msg_id,
      reason,
      error: error.message,
    })
  }
}

Deno.serve(async (req) => {
  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!apiKey || !supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables')
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Unauthorized' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )
  }

  // Defense in depth: verify_jwt=true already requires a valid JWT at the
  // gateway layer. This adds an explicit role check so only service-role
  // callers can trigger queue processing.
  const token = authHeader.slice('Bearer '.length).trim()
  const claims = parseJwtClaims(token)
  if (claims?.role !== 'service_role') {
    return new Response(
      JSON.stringify({ error: 'Forbidden' }),
      { status: 403, headers: { 'Content-Type': 'application/json' } }
    )
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const runId = crypto.randomUUID()
  const runStartedAt = Date.now()
  logEvent(runId, 'info', 'run.start', {})

  // 1. Check rate-limit cooldown and read queue config
  const { data: state } = await supabase
    .from('email_send_state')
    .select('retry_after_until, batch_size, send_delay_ms, auth_email_ttl_minutes, transactional_email_ttl_minutes')
    .single()

  if (state?.retry_after_until && new Date(state.retry_after_until) > new Date()) {
    logEvent(runId, 'info', 'run.skip', {
      reason: 'rate_limited',
      retry_after_until: state.retry_after_until,
    })
    return new Response(
      JSON.stringify({ run_id: runId, skipped: true, reason: 'rate_limited' }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  const batchSize = state?.batch_size ?? DEFAULT_BATCH_SIZE
  const sendDelayMs = state?.send_delay_ms ?? DEFAULT_SEND_DELAY_MS
  const ttlMinutes: Record<string, number> = {
    auth_emails: state?.auth_email_ttl_minutes ?? DEFAULT_AUTH_TTL_MINUTES,
    transactional_emails: state?.transactional_email_ttl_minutes ?? DEFAULT_TRANSACTIONAL_TTL_MINUTES,
  }

  let totalProcessed = 0
  const summaries: QueueSummary[] = []
  let stoppedReason: string | null = null

  // 2. Process auth_emails first (priority), then transactional_emails
  for (const queue of ['auth_emails', 'transactional_emails']) {
    const summary = newQueueSummary(queue)
    summaries.push(summary)

    const { data: messages, error: readError } = await supabase.rpc('read_email_batch', {
      queue_name: queue,
      batch_size: batchSize,
      vt: 30,
    })

    if (readError) {
      summary.read_errors++
      logEvent(runId, 'error', 'queue.read_failed', { queue, error: readError.message })
      continue
    }

    if (!messages?.length) {
      logEvent(runId, 'info', 'queue.empty', { queue })
      continue
    }

    summary.read = messages.length
    logEvent(runId, 'info', 'queue.batch_read', { queue, count: messages.length })

    // Retry budget is based on real send failures, not pgmq read_ct.
    // read_ct increments for every message in a claimed batch, including
    // messages not attempted when a 429 stops processing early.
    const messageIds = Array.from(
      new Set(
        (messages as Array<{ message: Record<string, any> }>)
          .map((msg) =>
            msg?.message?.message_id && typeof msg.message.message_id === 'string'
              ? (msg.message.message_id as string)
              : null
          )
          .filter((id): id is string => Boolean(id))
      )
    )
    const failedAttemptsByMessageId = new Map<string, number>()
    if (messageIds.length > 0) {
      const { data: failedRows, error: failedRowsError } = await supabase
        .from('email_send_log')
        .select('message_id')
        .in('message_id', messageIds)
        .eq('status', 'failed')

      if (failedRowsError) {
        logEvent(runId, 'error', 'queue.failed_counter_load_failed', {
          queue,
          error: failedRowsError.message,
        })
      } else {
        for (const row of failedRows ?? []) {
          const messageId = (row as { message_id: string | null })?.message_id
          if (typeof messageId !== 'string' || !messageId) continue
          failedAttemptsByMessageId.set(
            messageId,
            (failedAttemptsByMessageId.get(messageId) ?? 0) + 1
          )
        }
      }
    }

    for (let i = 0; i < messages.length; i++) {
      const msg = messages[i] as { msg_id: number; read_ct: number; message: Record<string, any> }
      const payload = msg.message
      const failedAttempts =
        payload?.message_id && typeof payload.message_id === 'string'
          ? (failedAttemptsByMessageId.get(payload.message_id) ?? 0)
          : 0

      const baseLog = {
        queue,
        msg_id: msg.msg_id,
        message_id: payload.message_id,
        recipient: payload.to,
        template: payload.label || queue,
        read_ct: msg.read_ct,
        failed_attempts: failedAttempts,
      }

      // Drop expired messages (TTL exceeded)
      if (payload.queued_at) {
        const ageMs = Date.now() - new Date(payload.queued_at).getTime()
        const maxAgeMs = ttlMinutes[queue] * 60 * 1000
        if (ageMs > maxAgeMs) {
          summary.dlq_ttl++
          await moveToDlq(
            supabase,
            queue,
            msg,
            `TTL exceeded (${ttlMinutes[queue]} minutes)`,
            runId,
            'ttl'
          )
          continue
        }
      }

      // Move to DLQ if max failed send attempts reached.
      if (failedAttempts >= MAX_RETRIES) {
        summary.dlq_max_retries++
        await moveToDlq(
          supabase,
          queue,
          msg,
          `Max retries (${MAX_RETRIES}) exceeded (attempted ${failedAttempts} times)`,
          runId,
          'max_retries'
        )
        continue
      }

      // Guard: skip if another worker already sent this message (VT expired race)
      if (payload.message_id) {
        const { data: alreadySent } = await supabase
          .from('email_send_log')
          .select('id')
          .eq('message_id', payload.message_id)
          .eq('status', 'sent')
          .maybeSingle()

        if (alreadySent) {
          summary.duplicates_skipped++
          logEvent(runId, 'warn', 'message.duplicate_skipped', baseLog)
          const { error: dupDelError } = await supabase.rpc('delete_email', {
            queue_name: queue,
            message_id: msg.msg_id,
          })
          if (dupDelError) {
            summary.delete_errors++
            logEvent(runId, 'error', 'message.delete_failed', {
              ...baseLog,
              kind: 'duplicate',
              error: dupDelError.message,
            })
          }
          continue
        }
      }

      const sendStart = Date.now()
      logEvent(runId, 'info', 'message.send_start', baseLog)

      try {
        await sendLovableEmail(
          {
            run_id: payload.run_id,
            to: payload.to,
            from: payload.from,
            sender_domain: payload.sender_domain,
            subject: payload.subject,
            html: payload.html,
            text: payload.text,
            purpose: payload.purpose,
            label: payload.label,
            idempotency_key: payload.idempotency_key,
            unsubscribe_token: payload.unsubscribe_token,
            message_id: payload.message_id,
          },
          // sendUrl is optional — when LOVABLE_SEND_URL is not set, the library
          // falls back to the default Lovable API endpoint (https://api.lovable.dev).
          // Set LOVABLE_SEND_URL as a Supabase secret to override (e.g. for local dev).
          { apiKey, sendUrl: Deno.env.get('LOVABLE_SEND_URL') }
        )

        summary.sent++
        logEvent(runId, 'info', 'message.sent', {
          ...baseLog,
          duration_ms: Date.now() - sendStart,
        })

        // Log success
        await supabase.from('email_send_log').insert({
          message_id: payload.message_id,
          template_name: payload.label || queue,
          recipient_email: payload.to,
          status: 'sent',
        })

        // Delete from queue
        const { error: delError } = await supabase.rpc('delete_email', {
          queue_name: queue,
          message_id: msg.msg_id,
        })
        if (delError) {
          summary.delete_errors++
          logEvent(runId, 'error', 'message.delete_failed', {
            ...baseLog,
            kind: 'sent',
            error: delError.message,
          })
        }
        totalProcessed++
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        const errorStatus =
          error && typeof error === 'object' && 'status' in error
            ? (error as { status: unknown }).status
            : undefined

        if (isRateLimited(error)) {
          summary.rate_limited++
          const retryAfterSecs = getRetryAfterSeconds(error)
          logEvent(runId, 'warn', 'message.rate_limited', {
            ...baseLog,
            duration_ms: Date.now() - sendStart,
            retry_after_seconds: retryAfterSecs,
            error: errorMsg,
          })

          await supabase.from('email_send_log').insert({
            message_id: payload.message_id,
            template_name: payload.label || queue,
            recipient_email: payload.to,
            status: 'rate_limited',
            error_message: errorMsg.slice(0, 1000),
          })

          await supabase
            .from('email_send_state')
            .update({
              retry_after_until: new Date(
                Date.now() + retryAfterSecs * 1000
              ).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', 1)

          stoppedReason = 'rate_limited'
          logEvent(runId, 'info', 'run.stop', {
            reason: stoppedReason,
            processed: totalProcessed,
            duration_ms: Date.now() - runStartedAt,
            summaries,
          })
          // Stop processing — remaining messages stay in queue (VT expires, retried next cycle)
          return new Response(
            JSON.stringify({
              run_id: runId,
              processed: totalProcessed,
              stopped: stoppedReason,
              summaries,
            }),
            { headers: { 'Content-Type': 'application/json' } }
          )
        }

        // 403 means emails are disabled for this project — retrying won't help.
        // Move straight to DLQ and stop processing the rest of the batch.
        if (isForbidden(error)) {
          summary.dlq_forbidden++
          logEvent(runId, 'error', 'message.forbidden', {
            ...baseLog,
            duration_ms: Date.now() - sendStart,
            error: errorMsg,
          })
          await moveToDlq(
            supabase,
            queue,
            msg,
            'Emails disabled for this project',
            runId,
            'forbidden'
          )
          stoppedReason = 'emails_disabled'
          logEvent(runId, 'info', 'run.stop', {
            reason: stoppedReason,
            processed: totalProcessed,
            duration_ms: Date.now() - runStartedAt,
            summaries,
          })
          return new Response(
            JSON.stringify({
              run_id: runId,
              processed: totalProcessed,
              stopped: stoppedReason,
              summaries,
            }),
            { headers: { 'Content-Type': 'application/json' } }
          )
        }

        // Generic send failure (template render, network, 5xx, etc.)
        summary.failed++
        logEvent(runId, 'error', 'message.failed', {
          ...baseLog,
          duration_ms: Date.now() - sendStart,
          status: errorStatus,
          error: errorMsg,
        })

        // Log non-429 failures to track real retry attempts.
        await supabase.from('email_send_log').insert({
          message_id: payload.message_id,
          template_name: payload.label || queue,
          recipient_email: payload.to,
          status: 'failed',
          error_message: errorMsg.slice(0, 1000),
        })
        if (payload?.message_id && typeof payload.message_id === 'string') {
          failedAttemptsByMessageId.set(payload.message_id, failedAttempts + 1)
        }

        // Non-429 errors: message stays invisible until VT expires, then retried
      }

      // Small delay between sends to smooth bursts
      if (i < messages.length - 1) {
        await new Promise((r) => setTimeout(r, sendDelayMs))
      }
    }

    logEvent(runId, 'info', 'queue.summary', summary as unknown as Record<string, unknown>)
  }

  logEvent(runId, 'info', 'run.complete', {
    processed: totalProcessed,
    duration_ms: Date.now() - runStartedAt,
    summaries,
  })

  return new Response(
    JSON.stringify({
      run_id: runId,
      processed: totalProcessed,
      duration_ms: Date.now() - runStartedAt,
      summaries,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
