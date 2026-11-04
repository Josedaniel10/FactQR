import { corsHeaders, jsonResponse } from '../_shared/http.ts'
import { supabaseRequest } from '../_shared/supabase.ts'
import { createFactusPayCollection, factusPayToken } from '../factus-pay-client.ts'

const demoMerchantId = '00000000-0000-4000-8000-000000000001'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: { code: 'METHOD_NOT_ALLOWED' } }, 405)
  }

  try {
    const body = await request.json()
    const items = Array.isArray(body.items) ? body.items : []
    const total = items.reduce(
      (sum: number, item: { price?: number; quantity?: number }) =>
        sum + Number(item.price || 0) * Number(item.quantity || 0),
      0,
    )

    if (!items.length || total <= 0) {
      return jsonResponse(
        { error: { code: 'INVALID_CART', message: 'The cart is empty.' } },
        400,
      )
    }

    if (total < 10000) {
      return jsonResponse(
        { error: { code: 'AMOUNT_TOO_LOW', message: 'El cobro mínimo es $10.000 COP.' } },
        400,
      )
    }

    const paymentMethod = String(body.paymentMethod || 'FACTUS_PAY').toUpperCase()
    if (!['FACTUS_PAY', 'SIMULATION', 'CASH'].includes(paymentMethod)) {
      return jsonResponse(
        { error: { code: 'INVALID_PAYMENT_METHOD', message: 'Metodo de pago no valido.' } },
        400,
      )
    }

    const referenceCode = `FQR-${crypto.randomUUID()}`
    const orderResult = await supabaseRequest('orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: demoMerchantId,
        mode: body.mode || 'A',
        status: 'PAYMENT_PENDING',
        total,
      }),
    })
    const order = (orderResult.body as Array<{ id: string }>)[0]

    await supabaseRequest('order_items', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        items.map((item: {
          code: string
          name: string
          price: number
          quantity: number
          taxCode?: string
          taxRate?: number
        }) => ({
          merchant_id: demoMerchantId,
          order_id: order.id,
          code_reference: item.code,
          name: item.name,
          quantity: item.quantity,
          unit_price: item.price,
          tax_code: item.taxCode || '01',
          tax_rate: item.taxRate ?? 19,
        })),
      ),
    })

    const payBaseUrl = Deno.env.get('FACTUS_PAY_API_BASE_URL')?.trim()
    let qr = `SIMULATION:${referenceCode}`
    let provider = 'SIMULATION'
    let paymentStatus = 'READY'
    let collectedAt: string | null = null
    const factusPayAccessToken = factusPayToken()
    if (paymentMethod === 'CASH') {
      provider = 'CASH'
      paymentStatus = 'PAID'
      qr = ''
      collectedAt = new Date().toISOString()
    } else if (paymentMethod === 'SIMULATION') {
      provider = 'SIMULATION'
    } else if (payBaseUrl && factusPayAccessToken) {
      const token = factusPayAccessToken
      const collection = await createFactusPayCollection(payBaseUrl, token, referenceCode, Math.round(total))
      provider = 'FACTUS_PAY'
      qr = String(
        collection.qr ??
        collection.qr_code ??
        (collection.data as Record<string, unknown> | undefined)?.qr ??
        qr,
      )
    }

    await supabaseRequest('payments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: demoMerchantId,
        order_id: order.id,
        reference_code: referenceCode,
        amount: total,
        status: paymentStatus,
        qr_base64: qr,
        provider,
        collected_at: collectedAt,
        qr_expires_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      }),
    })

    if (paymentStatus === 'PAID') {
      await supabaseRequest(`orders?id=eq.${order.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'PAID', updated_at: new Date().toISOString() }),
      })
    }

    return jsonResponse({
      data: {
        orderId: order.id,
        referenceCode,
        amount: total,
        status: paymentStatus,
        qr,
        provider,
      },
    }, 201)
  } catch (error) {
    console.error('create-payment failed', error)
    return jsonResponse(
      {
        error: {
          code: 'PAYMENT_CREATION_FAILED',
          message: 'The payment could not be created.',
        },
      },
      500,
    )
  }
})
