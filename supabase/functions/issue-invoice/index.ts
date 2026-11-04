import { corsHeaders, jsonResponse } from '../_shared/http.ts'
import { supabaseRequest } from '../_shared/supabase.ts'
import { getFactusAccessToken } from '../factus-client.ts'

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

    const paymentResult = await supabaseRequest(
      `payments?reference_code=eq.${encodeURIComponent(reference)}&select=id,order_id,status,amount`,
    )
    const payment = (paymentResult.body as Array<{
      id: string
      order_id: string
      status: string
      amount: number
    }>)[0]

    if (!payment) {
      return jsonResponse({ error: { code: 'PAYMENT_NOT_FOUND' } }, 404)
    }
    if (payment.status !== 'PAID') {
      return jsonResponse({ error: { code: 'PAYMENT_NOT_PAID' } }, 409)
    }

    const existingInvoice = await supabaseRequest(
      `invoices?reference_code=eq.${encodeURIComponent(reference)}&select=number,cufe,public_url,is_validated`,
    )
    const existing = (existingInvoice.body as Array<{
      number: string
      cufe: string | null
      public_url: string | null
      is_validated: boolean
    }>)[0]

    if (existing?.is_validated) {
      return jsonResponse({
        data: {
          number: existing.number,
          cufe: existing.cufe,
          publicUrl: existing.public_url,
        },
      })
    }

    const itemsResult = await supabaseRequest(
      `order_items?order_id=eq.${payment.order_id}&select=code_reference,name,quantity,unit_price,tax_rate`,
    )
    const items = itemsResult.body as Array<{
      code_reference: string
      name: string
      quantity: number
      unit_price: number
      tax_rate: number
    }>
    const { baseUrl, accessToken } = await getFactusAccessToken()
    const invoicePayload = {
      reference_code: reference,
      document: '01',
      numbering_range_id: 389,
      operation_type: '10',
      send_email: false,
      payment_details: [{
        payment_form: '1',
        payment_method_code: '10',
        reference_code: reference,
        amount: String(payment.amount),
      }],
      customer: {
        identification_document_code: '13',
        identification: '22222222222',
        names: 'Consumidor Final',
        email: 'cliente@demo.local',
      },
      items: items.map((item) => ({
        code_reference: item.code_reference,
        name: item.name,
        quantity: String(item.quantity),
        discount_rate: '0.00',
        price: (Number(item.unit_price) / 1.19).toFixed(2),
        unit_measure_code: '94',
        standard_code: '999',
        taxes: [{ code: '01', rate: String(item.tax_rate || 19) }],
      })),
    }

    const response = await fetch(`${baseUrl}/v2/bills/validate`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(invoicePayload),
    })
    const result = await response.json()

    if (!response.ok || result.status !== 'Created') {
      await supabaseRequest('orders?id=eq.' + payment.order_id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'INVOICE_FAILED',
          updated_at: new Date().toISOString(),
        }),
      })
      return jsonResponse({
        error: { code: 'FACTUS_VALIDATION_FAILED', message: result.message },
      }, 422)
    }

    const invoice = result.data
    await supabaseRequest('invoices', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        merchant_id: '00000000-0000-4000-8000-000000000001',
        order_id: payment.order_id,
        reference_code: reference,
        number: invoice.number,
        cufe: invoice.cufe || null,
        is_validated: invoice.is_validated === true,
        public_url: invoice.links?.public_url || null,
        errors: invoice.errors || null,
      }),
    })
    await supabaseRequest('orders?id=eq.' + payment.order_id, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'INVOICED', updated_at: new Date().toISOString() }),
    })

    return jsonResponse({
      data: {
        number: invoice.number,
        cufe: invoice.cufe || null,
        publicUrl: invoice.links?.public_url || null,
        status: invoice.is_validated ? 'INVOICED' : 'PENDING',
      },
    }, 201)
  } catch (error) {
    console.error('issue-invoice failed', error)
    return jsonResponse({ error: { code: 'INVOICE_ISSUE_FAILED' } }, 500)
  }
})
