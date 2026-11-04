export async function getFactusAccessToken() {
  const baseUrl = Deno.env.get('FACTUS_API_BASE_URL')!
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: Deno.env.get('FACTUS_CLIENT_ID')!,
    client_secret: Deno.env.get('FACTUS_CLIENT_SECRET')!,
    username: Deno.env.get('FACTUS_USERNAME')!,
    password: Deno.env.get('FACTUS_PASSWORD')!,
  })

  const response = await fetch(`${baseUrl}/oauth/token`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })
  const result = await response.json()

  if (!response.ok || !result.access_token) {
    throw new Error('Factus authentication failed')
  }

  return { baseUrl, accessToken: result.access_token as string }
}
