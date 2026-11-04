const jsonHeaders = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
}

async function readResponse(response: Response) {
  const text = await response.text()
  let body: Record<string, unknown> = {}

  if (text) {
    try {
      body = JSON.parse(text)
    } catch {
      body = { message: text }
    }
  }

  return { body, text }
}

export function factusPayToken(): string | null {
  return Deno.env.get('FACTUS_PAY_TOKEN')?.trim() || null
}

export async function getFactusPayToken(baseUrl: string): Promise<string> {
  const configuredToken = factusPayToken()
  if (configuredToken) return configuredToken

  const email = Deno.env.get('FACTUS_PAY_EMAIL')?.trim()
  const password = Deno.env.get('FACTUS_PAY_PASSWORD')?.trim()
  if (!email || !password) {
    throw new Error('Factus Pay is not configured.')
  }

  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/auth`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ email, password }),
  })
  const { body } = await readResponse(response)

  if (!response.ok) {
    throw new Error(String(body.message || `Factus Pay authentication failed (${response.status}).`))
  }

  const token = body.token ?? (body.data as Record<string, unknown> | undefined)?.token
  if (typeof token !== 'string' || !token.trim()) {
    throw new Error('Factus Pay authentication did not return a token.')
  }

  return token
}

export async function createFactusPayCollection(
  baseUrl: string,
  token: string,
  referenceCode: string,
  amount: number,
) {
  const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/v1/collections`, {
    method: 'POST',
    headers: {
      ...jsonHeaders,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      reference_code: referenceCode,
      amount,
    }),
  })
  const { body } = await readResponse(response)

  if (!response.ok) {
    throw new Error(String(body.message || `Factus Pay collection failed (${response.status}).`))
  }

  return body
}

export async function getFactusPayCollection(baseUrl: string, token: string, referenceCode: string) {
  const response = await fetch(
    `${baseUrl.replace(/\/+$/, '')}/v1/collections/${encodeURIComponent(referenceCode)}`,
    {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    },
  )
  const { body } = await readResponse(response)

  if (!response.ok) {
    throw new Error(String(body.message || `Factus Pay status failed (${response.status}).`))
  }

  return body
}
