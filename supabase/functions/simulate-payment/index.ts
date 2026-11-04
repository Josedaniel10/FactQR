import { corsHeaders, jsonResponse } from '../_shared/http.ts'
import { supabaseRequest } from '../_shared/supabase.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: { code: 'METHOD_NOT_ALLOWED' } }, 405)
  }

  try {
    const { reference } = await request.json()
    if (!reference) {
      return jsonResponse({ error: { code: 'REFERENCE_REQUIRED' } }, 400)
    }

    const result = await supabaseRequest(
      `payments?reference_code=eq.${encodeURIComponent(reference)}&select=order_id`,
    )
    const payment = (result.body as Array<{ order_id: string }>)[0]
    if (!payment) {
      return jsonResponse({ error: { code: 'PAYMENT_NOT_FOUND' } }, 404)
    }

    await supabaseRequest(
      `payments?reference_code=eq.${encodeURIComponent(reference)}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'PAID',
          payer: { name: 'Consumidor Final Demo', type: 'simulation' },
          collected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }),
      },
    )

    await supabaseRequest(`orders?id=eq.${payment.order_id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'PAID', updated_at: new Date().toISOString() }),
    })

    return jsonResponse({ data: { reference, status: 'PAID' } })
  } catch (error) {
    console.error('simulate-payment failed', error)
    return jsonResponse({ error: { code: 'SIMULATION_FAILED' } }, 500)
  }
})
