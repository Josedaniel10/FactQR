# CobroFactura

CobroFactura is a mobile-first mini POS that links sandbox payments from Factus
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

- React, TypeScript, Vite, and Tailwind CSS
- Supabase Auth, Postgres, Realtime, and Edge Functions
- Vercel or Netlify
- TypeScript/Deno Edge Functions

## Local setup

1. Copy `.env.example` to `.env`.
2. Replace the fake values with sandbox credentials.
3. Configure the Supabase project and deploy Edge Functions when implemented.

Never commit `.env`, real credentials, access tokens, or webhook secrets.

## Environment variables

See `.env.example` for the required variables. Every secret belongs in Supabase
secrets or in the local `.env` file only.

## Repository rules

- Sandbox APIs only.
- No real payment providers or money movement.
- Public GitHub repository.
- No application code should be added before each implementation phase starts.
