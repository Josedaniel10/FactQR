import { corsHeaders, jsonResponse } from '../_shared/http.ts'
import { getConfig } from '../_shared/config.ts'

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    getConfig()
    return jsonResponse({
      data: {
        service: 'factqr',
        status: 'healthy',
        environment: 'sandbox',
        phase: 1,
      },
    })
  } catch (error) {
    return jsonResponse(
      {
        error: {
          code: 'CONFIGURATION_ERROR',
          message: error instanceof Error ? error.message : 'Invalid configuration',
        },
      },
      503,
    )
  }
})
