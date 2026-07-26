# Rooted Commons website v2.0

Astro website, secure order functions and Baserow templates for Rooted Commons. Baserow is the operational data source; Xero is the payment source; the web host stores no authoritative business data.

## Features

- Baserow-managed pages, sections, products and collection points.
- Member dashboard with credit, commitment, recent top-ups and unlocked benefits.
- Stock-aware catalogue: out-of-stock and low-stock states, quantity caps and server-side validation.
- Idempotent Confirm Order flow using `Client request ID`.
- Structured Order Lines and append-only stock movements.
- Replacement orders that release the old allocation before checking the new basket.
- Xero Receive Money design for 15-minute Baserow polling.
- Local collection deadlines displayed exactly as entered.

## Build from scratch

Requirements: Node.js 22, npm, a Baserow database, and optionally a Xero organisation for payment sync.

```bash
npm install
cp .env.example .env
npm run dev
```

For production:

```bash
npm run build
```

Deploy `dist/` and the `functions/` directory to a host that supports Astro static output plus server functions. Cloudflare Pages works, but no Cloudflare-specific database or state service is used.

## Configure Baserow

Import the CSVs in `baserow-imports/`, then set field types and select options using [docs/BASEROW_SCHEMA.md](docs/BASEROW_SCHEMA.md). Existing installations should add the new Order Lines and Xero Sync State tables and the v2 fields listed there.

Use two credentials:

1. A build-time read-only token for Site Settings, Pages, Sections, Products and Collection Points.
2. A restricted runtime token for Members, Web Orders, Order Lines, Stock Movement and Account Transactions.

Copy table IDs into `.env`. Never commit `.env` or tokens.

## Where to edit content

- Header, footer, interface labels, badges and perks: `Site Settings`.
- Page titles and hero settings: `Pages`.
- Page body blocks: `Sections`.
- Products, prices, categories and current availability: `Products`.
- Addresses, slots and order-closing times: `Collection Points`.
- Member credit and commitment: `Members` plus `Account Transactions`.

## Stock

`Available stock` is a Products-table rollup from the Stock Movement ledger. The catalogue is built with product descriptive data, then `/orders/` reloads current availability from `/api/products` at runtime on every visit. Use positive movements for deliveries/opening/adjustments and negative movements for orders/wastage. The low-stock threshold defaults to 5.

## Orders

Checkout sends one complete order and an opaque `Client request ID`. The server reloads all prices and stock from Baserow. Confirmed lines are written to Order Lines for every confirmed order. Stock Movement, Order Lines and Account Transactions table IDs and permissions are required.

## Xero

See [docs/XERO_SYNC.md](docs/XERO_SYNC.md). The normal operating method is: enter Receive Money in Xero; Baserow polls every 15 minutes; the member credit updates; later reconciliation updates the same imported record.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Baserow schema](docs/BASEROW_SCHEMA.md)
- [Xero sync](docs/XERO_SYNC.md)
- [Testing](docs/TESTING.md)

## Important limitations

Baserow remains authoritative, but Baserow Cloud does not necessarily provide a multi-row database transaction for an entire basket. Runtime stock revalidation, idempotency keys and integrity checks materially reduce overselling risk, but the system should flag and halt any product whose calculated stock becomes negative.

## Home-page “How it works” cards

The three card rows should use keys `how-1`, `how-2`, and `how-3`, Page `home`, Section type `Cards`, and the same Group key `how-it-works`. Set Order to `10`, `20`, and `30`. The first row controls the group heading and column count; set its Eyebrow to `How it works` only when you want to override the automatic title, and set Columns to `3`. Give each row an Image, use Image size `medium`, Image fit `cover`, and keep all three Visible. The code also recognises the `how-1`/`how-2`/`how-3` keys as one card group if a Group key is accidentally omitted.
