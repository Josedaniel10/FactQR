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
    const requestedInvoiceNumber = String(body.invoiceNumber || '').trim()
    const email = String(body.email || '').trim()

    if (!reference && !requestedInvoiceNumber) {
      return jsonResponse({ error: { code: 'REFERENCE_REQUIRED' } }, 400)
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: { code: 'INVALID_EMAIL' } }, 400)
    }

    let invoiceNumber = requestedInvoiceNumber
    if (!invoiceNumber) {
      const invoiceResult = await supabaseRequest(
        `invoices?reference_code=eq.${encodeURIComponent(reference)}&select=number`,
      )
      const invoice = (invoiceResult.body as Array<{ number: string }>)[0]
      invoiceNumber = String(invoice?.number || '').trim()
    }
    if (!invoiceNumber) {
      return jsonResponse({ error: { code: 'INVOICE_NOT_FOUND' } }, 404)
    }

    const { baseUrl, accessToken } = await getFactusAccessToken()
    const numberCandidates = [invoiceNumber]
    const numericInvoiceNumber = invoiceNumber.replace(/^SETP/i, '')
    if (numericInvoiceNumber !== invoiceNumber) {
      numberCandidates.push(numericInvoiceNumber)
    }

    let lastResponse: Response | null = null
    let lastResult: Record<string, unknown> = {}
    let sentInvoiceNumber = invoiceNumber

    for (const candidate of numberCandidates) {
      const response = await fetch(`${baseUrl}/v2/bills/${encodeURIComponent(candidate)}/send-email`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })
      const result = await response.json().catch(() => ({})) as Record<string, unknown>
      lastResponse = response
      lastResult = result

      if (response.ok) {
        sentInvoiceNumber = candidate
        break
      }

      if (response.status !== 404) {
        break
      }
    }

    if (!lastResponse?.ok) {
      return jsonResponse({
        error: {
          code: 'FACTUS_EMAIL_FAILED',
          message: String(lastResult.message || lastResult.detail || 'No se pudo enviar la factura por correo.'),
          details: lastResult.errors || lastResult.error || lastResult,
          invoiceNumber,
          triedInvoiceNumbers: numberCandidates,
        },
      }, lastResponse?.status === 401 ? 502 : (lastResponse?.status || 502))
    }

    return jsonResponse({
      data: {
        sent: true,
        email,
        invoiceNumber: sentInvoiceNumber,
      },
    })
  } catch (error) {
    console.error('send-invoice-email failed', error)
    return jsonResponse({ error: { code: 'INVOICE_EMAIL_FAILED' } }, 500)
  }
})
