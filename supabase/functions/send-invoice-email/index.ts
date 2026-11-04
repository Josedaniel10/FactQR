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
    const body = await request.json()
    const reference = String(body.reference || '').trim()
    const email = String(body.email || '').trim()

    if (!reference) {
      return jsonResponse({ error: { code: 'REFERENCE_REQUIRED' } }, 400)
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: { code: 'INVALID_EMAIL' } }, 400)
    }

    const invoiceResult = await supabaseRequest(
      `invoices?reference_code=eq.${encodeURIComponent(reference)}&select=number`,
    )
    const invoice = (invoiceResult.body as Array<{ number: string }>)[0]
    if (!invoice?.number) {
      return jsonResponse({ error: { code: 'INVOICE_NOT_FOUND' } }, 404)
    }

    const { baseUrl, accessToken } = await getFactusAccessToken()
    const response = await fetch(`${baseUrl}/v2/bills/${encodeURIComponent(invoice.number)}/send-email`, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email }),
    })
    const result = await response.json()

    if (!response.ok) {
      return jsonResponse({
        error: {
          code: 'FACTUS_EMAIL_FAILED',
          message: result.message || 'No se pudo enviar la factura por correo.',
        },
      }, response.status === 401 ? 502 : response.status)
    }

    return jsonResponse({
      data: {
        sent: true,
        email,
        invoiceNumber: invoice.number,
      },
    })
  } catch (error) {
    console.error('send-invoice-email failed', error)
    return jsonResponse({ error: { code: 'INVOICE_EMAIL_FAILED' } }, 500)
  }
})
