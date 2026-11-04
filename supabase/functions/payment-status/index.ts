import { corsHeaders, jsonResponse } from '../_shared/http.ts'
import { supabaseRequest } from '../_shared/supabase.ts'
import { factusPayToken, getFactusPayCollection } from '../factus-pay-client.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'GET') {
    return jsonResponse({ error: { code: 'METHOD_NOT_ALLOWED' } }, 405)
  }

  const referenceCode = new URL(request.url).searchParams.get('reference')

  if (!referenceCode) {
    return jsonResponse(
      { error: { code: 'REFERENCE_REQUIRED' } },
      400,
    )
  }

  try {
    const result = await supabaseRequest(
      `payments?reference_code=eq.${encodeURIComponent(referenceCode)}&select=reference_code,status,amount,qr_base64,payer,collected_at,provider`,
    )
    const payments = result.body as Array<Record<string, unknown>>

    if (!payments.length) {
      return jsonResponse(
        { error: { code: 'PAYMENT_NOT_FOUND' } },
        404,
      )
    }

    const payment = payments[0]
    const provider = String(payment.provider || '')
    const payBaseUrl = Deno.env.get('FACTUS_PAY_API_BASE_URL')?.trim()

    if (provider !== 'SIMULATION' && payBaseUrl && payment.status === 'READY') {
      const token = factusPayToken()
      if (!token) return jsonResponse({ data: payment })
      const collection = await getFactusPayCollection(payBaseUrl, token, referenceCode)
      const data = (collection.data as Record<string, unknown> | undefined) || collection
      const rawStatus = String(data.status || collection.status || '').toLowerCase()

      if (rawStatus === 'paid') {
        payment.status = 'PAID'
        await supabaseRequest(`payments?reference_code=eq.${encodeURIComponent(referenceCode)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            status: 'PAID',
            collected_at: new Date().toISOString(),
          }),
        })
      }
    }

    return jsonResponse({ data: payment })
  } catch (error) {
    console.error('payment-status failed', error)
    return jsonResponse(
      { error: { code: 'PAYMENT_STATUS_FAILED' } },
      500,
    )
  }
})
