import { readFileSync } from 'node:fs'

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

const parseEnv = (content) =>
  Object.fromEntries(
    content
      .split(/\r?\n/)
      .filter((line) => line.trim() && !line.trim().startsWith('#'))
      .map((line) => {
        const separator = line.indexOf('=')
        return [line.slice(0, separator).trim(), line.slice(separator + 1)]
      })
      .filter(([key]) => key),
  )

let env

try {
  env = parseEnv(readFileSync('.env', 'utf8'))
} catch {
  console.error('Missing required .env file.')
  process.exit(1)
}

const missing = requiredVariables.filter((name) => !env[name]?.trim())

if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(', ')}`)
  process.exit(1)
}

try {
  const supabaseUrl = new URL(env.SUPABASE_URL)
  if (!['http:', 'https:'].includes(supabaseUrl.protocol)) {
    throw new Error('Invalid protocol')
  }
} catch {
  console.error('SUPABASE_URL must be a valid HTTP(S) URL.')
  process.exit(1)
}

console.log(`Environment validated: ${requiredVariables.length} variables configured.`)
