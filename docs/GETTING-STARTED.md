# Getting started

This is the shortest path from a clean download to a working v2.9.52 instance.

## 1. Requirements

- Node.js 22
- npm
- a Baserow database
- an email/SMTP setup for service emails
- optionally Xero for member-payment synchronisation

## 2. Install locally

```bash
npm install
cp .env.example .env
npm run dev
```

Do not commit `.env` or secrets.

## 3. Prepare Baserow

Use `BASEROW-SETUP.md` as the current source of truth for field names, options, token permissions and the order automation. The legacy version-by-version setup notes have deliberately been removed from this package.

The existing import/specification folders are retained for v2.9.52. For v3.0 they are intended to be replaced from clean exports of the live database.

## 4. Configure environment variables

Copy `.env.example` to `.env` and add the relevant Baserow table IDs and tokens. Use separate build-time and runtime credentials and keep server-side secrets out of browser-facing variables.

## 5. Deploy

Follow `DEPLOYMENT.md`. The site requires static Astro output plus server functions. Cloudflare Pages is known to work, but the application does not require Cloudflare-hosted business state.

## 6. Verify before live use

Follow the test checklist in `TECHNICAL-REFERENCE.md`, including member authentication, current price/stock checks, order idempotency, Baserow automation, confirmation email and payment reconciliation where enabled.
