const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

export async function supabaseRequest(
  path: string,
  options: RequestInit = {},
) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...options,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      Prefer: 'return=representation',
      ...options.headers,
    },
  })

  const text = await response.text()
  let body: unknown = null

  if (text) {
    body = JSON.parse(text)
  }

  if (!response.ok) {
    throw new Error(
      typeof body === 'object' && body !== null && 'message' in body
        ? String(body.message)
        : `Supabase request failed (${response.status})`,
    )
  }

  return { body, status: response.status }
}
