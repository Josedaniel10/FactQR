const requiredVariables = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'FACTUS_API_BASE_URL',
  'FACTUS_CLIENT_ID',
  'FACTUS_CLIENT_SECRET',
  'FACTUS_USERNAME',
  'FACTUS_PASSWORD',
  'FACTUS_PAY_API_BASE_URL',
  'FACTUS_PAY_EMAIL',
  'FACTUS_PAY_PASSWORD',
  'FACTUS_PAY_WEBHOOK_KEY',
]

export function getConfig() {
  const missing = requiredVariables.filter((name) => !Deno.env.get(name)?.trim())

  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(', ')}`)
  }

  return Object.fromEntries(requiredVariables.map((name) => [name, Deno.env.get(name)]))
}
