export async function getAuthenticatedUser(request: Request): Promise<{ id: string; email?: string }> {
  const authorization = request.headers.get('Authorization') || ''
  if (!authorization.startsWith('Bearer ')) {
    throw new Error('UNAUTHENTICATED')
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: authorization,
      apikey: anonKey || serviceRoleKey || '',
    },
  })

  if (!response.ok) {
    throw new Error('UNAUTHENTICATED')
  }

  const user = await response.json()
  return { id: String(user.id), email: user.email }
}
