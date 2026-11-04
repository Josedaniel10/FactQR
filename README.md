# FactQR

FactQR is a mobile-first mini POS that links sandbox payments from Factus
Pay with validated invoices from Factus Invoicing.

## MVP flows

### A: Collect first

1. Create an order.
2. Create a Factus Pay collection and display its QR.
3. Confirm payment in the sandbox simulator.
4. Process the Pay webhook.
5. Issue and validate the Factus invoice.

### B: Invoice first

1. Create an order.
2. Issue and validate the Factus invoice.
3. Create a Factus Pay collection.
4. Confirm payment in the sandbox simulator.

## Architecture

The frontend calls Supabase Edge Functions only. Edge Functions communicate with
Factus Pay and Factus Invoicing, write to shared Postgres tables, and publish
state changes through Supabase Realtime.

```text
React + TypeScript + Vite
             |
             v
Supabase Auth + Edge Functions
             |
    +--------+--------+
    |                 |
    v                 v
Factus Pay      Factus Invoicing
    |                 |
    +--------+--------+
             |
             v
Supabase Postgres + Realtime
```

## Planned stack

- React JavaScript, Vite, and CSS
- Supabase Auth, Postgres, Realtime, and Edge Functions
- Vercel or Netlify
- JavaScript/Deno Edge Functions

## Local setup

1. Copy `.env.example` to `.env`.
2. Replace the fake values with sandbox credentials when you reach the API
   integration phase.
3. Install the frontend dependencies:
   `cd frontend && npm install`
4. Start the Phase 0 prototype: `npm run dev`
5. Configure the Supabase project and deploy Edge Functions when implemented.

Validate the local environment without printing secret values:

```powershell
npm run check
```

## Phase 1 backend

- Postgres schema and Row Level Security policies are in
  `supabase/migrations/`.
- Shared configuration and HTTP utilities are in
  `supabase/functions/_shared/`.
- The sandbox health function is at `supabase/functions/health/`.
- No Docker is required. Use the linked Supabase Cloud project and:
  `npx supabase db push --remote`

## Phase 0 resources

- The React JavaScript frontend prototype is in `frontend/`.
- The core Factus Invoicing collection is in
  `docs/factus-postman-core.json`.

Never commit `.env`, real credentials, access tokens, or webhook secrets.

## Environment variables

See `.env.example` for the required variables. Every secret belongs in Supabase
secrets or in the local `.env` file only.

## Repository rules

- Sandbox APIs only.
- No real payment providers or money movement.
- Public GitHub repository.
- No application code should be added before each implementation phase starts.
