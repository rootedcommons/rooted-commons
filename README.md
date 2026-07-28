# Rooted Commons website v2.1.2

Astro website and restricted server functions for Rooted Commons. Baserow is the operational data source; Xero is the payment source; the web host stores no authoritative business state.

## V2.1 architecture

The browser sends only product row IDs and quantities. The order endpoint reloads the member, current prices, `Available stock`, and collection-point rules from Baserow. It calculates the authoritative order total and creates one `Web Orders` row with `Status = Processing`, a readable price snapshot in `Item JSON`, and a batch-ready payload in `Stock Movement JSON`.

A published Baserow automation then:

1. batch-creates all Stock Movement rows from `Stock Movement JSON`;
2. creates one negative Account Transaction;
3. marks the Web Order `Confirmed`;
4. sends the confirmation email in a separate workflow;
5. records that the email was sent.

The website does not create Stock Movement or Account Transactions rows. There are no Order Lines, Order Submissions, automatic replacement orders, release movements, or automatic order reversals.

## Features

- Baserow-managed pages, sections, products and collection points.
- Member dashboard with credit, commitment, recent top-ups and unlocked benefits.
- Runtime product prices and availability on `/orders/` and checkout.
- Out-of-stock and low-stock states with quantity caps.
- Server-side price, stock, member and collection-point validation.
- Idempotent submission using `Client request ID`.
- Historical unit prices copied into Stock Movement by Baserow automation.
- Xero Receive Money design for 15-minute Baserow polling.
- Local collection deadlines displayed exactly as entered.

## Build from scratch

Requirements: Node.js 22, npm, a Baserow database, and optionally a Xero organisation for payment sync.

```bash
npm install
cp .env.example .env
npm run dev
```

Production build:

```bash
npm run build
```

Deploy `dist/` and `functions/` to a host that supports static output plus server functions. Cloudflare Pages works, but no Cloudflare database or state service is required.

## Baserow setup

Use [docs/BASEROW_SCHEMA.md](docs/BASEROW_SCHEMA.md) for exact field names and options. Build the order processor using [docs/BASEROW_ORDER_AUTOMATION.md](docs/BASEROW_ORDER_AUTOMATION.md).

Use two credentials:

1. Build-time read-only token for Site Settings, Pages, Sections, Products and Collection Points.
2. Restricted runtime token for Members, Products, Collection Points, Web Orders and read-only Account Transactions.

The runtime token needs no write access to Stock Movement or Account Transactions; Baserow's own automation writes those rows.

## Where to edit content

- Header, footer, interface labels, badges and perks: `Site Settings`.
- Page titles and hero settings: `Pages`.
- Page body blocks: `Sections`.
- Products, prices, categories and availability: `Products`.
- Addresses, slots and order-closing times: `Collection Points`.
- Member commitment and identity: `Members`.
- Member balance ledger: `Account Transactions`.

## Stock

`Products → Available stock` is a rollup of `Stock Movement → Quantity change`.

- Opening stock, deliveries and positive corrections are positive.
- Orders, wastage and negative corrections are negative.
- Adding an item to a browser basket does not reserve or change stock.
- Stock changes only when the Baserow order automation creates negative Stock Movement rows.
- The order endpoint rechecks current availability immediately before creating the Web Order.

## Prices

Browser prices are display values only. At confirmation, the server reloads `Products → Member price`, calculates the total, and stores this immutable snapshot:

```json
[
  {
    "product_id": 123,
    "product_name": "Organic oats",
    "product_code": "20660",
    "quantity": 2,
    "unit_price": 2.5,
    "line_total": 5
  }
]
```

The server also generates `Stock Movement JSON`, which the automation batch-creates in one action. It includes each historical `unit_price`, so later product-price changes do not rewrite historical sales.

## Orders

One member may place one `Processing` or `Confirmed` order per ordering week. Confirmed orders cannot be replaced automatically. Changes and refunds are handled manually by an administrator.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Baserow schema](docs/BASEROW_SCHEMA.md)
- [Order automation](docs/BASEROW_ORDER_AUTOMATION.md)
- [Xero sync](docs/XERO_SYNC.md)
- [Testing](docs/TESTING.md)
