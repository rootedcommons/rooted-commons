# Architecture

Rooted Commons v2.0 keeps Baserow as the operational source of truth. Astro renders the public site. The narrow `/api/*` functions protect member and order data; they contain no permanent business state. Xero remains the accounting source for payments.

## Data flow

1. Public catalogue data is read from Baserow during the site build.
2. A member verifies through a secure opaque token.
3. Checkout posts one complete order with a client request ID.
4. The order adapter validates member, collection point, prices and stock against Baserow.
5. Confirmed orders create Order Lines and stock ledger movements.
6. A Baserow automation polls Xero every 15 minutes and upserts Receive Money transactions by BankTransactionID.

The host may be replaced if it supports Astro and equivalent secure server functions. No Cloudflare database, queue or Durable Object is required.
