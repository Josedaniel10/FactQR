import { corsHeaders, jsonResponse } from '../_shared/http.ts'
import { supabaseRequest } from '../_shared/supabase.ts'

const paymentStatusMap: Record<string, string> = {
  paid: 'PAID',
  paid_out: 'PAID',
  success: 'PAID',
  approved: 'PAID',
  expired: 'EXPIRED',
  failed: 'FAILED',
  cancelled: 'FAILED',
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: { code: 'METHOD_NOT_ALLOWED' } }, 405)
  }

  const key = new URL(request.url).searchParams.get('key')
  const expectedKey = Deno.env.get('FACTUS_PAY_WEBHOOK_KEY')

  if (!expectedKey || key !== expectedKey) {
    return jsonResponse(
      { error: { code: 'UNAUTHORIZED_WEBHOOK' } },
      401,
    )
  }

  try {
    const payload = await request.json()
    const referenceCode = String(
      payload.reference_code ||
        payload.referenceCode ||
        payload.payment?.reference_code ||
        payload.transaction?.reference_code ||
        '',
    )
    const rawStatus = String(payload.status || payload.payment?.status || '').toLowerCase()
    const status = paymentStatusMap[rawStatus]
    const eventId = String(
      payload.event_id ||
        payload.id ||
        `${referenceCode}:${rawStatus}:${payload.updated_at || payload.timestamp || ''}`,
    )

    if (!referenceCode || !status) {
      return jsonResponse(
        { error: { code: 'INVALID_WEBHOOK_PAYLOAD' } },
        400,
      )
    }

    await supabaseRequest('webhook_events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dedupe_key: eventId,
        reference_code: referenceCode,
        raw_body: payload,
        processed_at: new Date().toISOString(),
        result: { status },
      }),
    })

    const paymentResult = await supabaseRequest(
      `payments?reference_code=eq.${encodeURIComponent(referenceCode)}&select=order_id`,
    )
    const payment = (paymentResult.body as Array<{ order_id: string }>)[0]

    await supabaseRequest(
      `payments?reference_code=eq.${encodeURIComponent(referenceCode)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          payer: payload.payer || payload.payment?.payer || null,
          collected_at: status === 'PAID' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        }),
      },
    )

    if (payment?.order_id) {
      await supabaseRequest(
      `orders?id=eq.${encodeURIComponent(payment.order_id)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: status === 'PAID' ? 'PAID' : status === 'EXPIRED' ? 'PAYMENT_EXPIRED' : 'INVOICE_FAILED',
          updated_at: new Date().toISOString(),
        }),
      },
      ).catch(() => undefined)
    }

    return jsonResponse({ data: { received: true, referenceCode, status } })
  } catch (error) {
    if (String(error).includes('duplicate key')) {
      return jsonResponse({ data: { received: true, duplicate: true } })
    }

    console.error('payment-webhook failed', error)
    return jsonResponse(
      { error: { code: 'WEBHOOK_PROCESSING_FAILED' } },
      500,
    )
  }
})
