# Rooted Commons website — v1

This repository contains the public Rooted Commons website and weekly ordering interface.

## What it does

- Builds public pages from **Site Settings**, **Pages**, and **Sections** in Baserow.
- Supports section types: **Text**, **Image and text**, **Banner**, **Cards**, **Grid**, **Call to action**, and **Gallery**.
- A Grid section only displays records from **Products**.
- Lets any visitor browse `/orders/`, filter categories, search, and build a basket stored in their browser.
- Lets members arrive through a weekly token link, see current credit and collection point, and submit an order.
- Lets an unverified visitor enter an email at `/checkout/`; an optional webhook can send the member link or a joining invitation.
- On confirmed submission, checks current prices, stock and collection-point availability, creates a **Web Order**, creates negative **Stock Movement** rows, and creates a negative **Account Transaction**.
- Replacing an order reverses the previous stock and account movements before creating the new order.

## Baserow tables

The `baserow-imports/` folder contains the latest exported structures:

1. Site Settings
2. Pages
3. Sections
4. Products
5. Collection Points
6. Members
7. Web Orders
8. Stock Movement
9. Account Transactions

CSV exports do not preserve Baserow field types or links. Keep the linked fields configured in Baserow.

### Required relationships

- Products ↔ Stock Movement
- Members ↔ Account Transactions through the linked field **Xero Contact ID**
- Members ↔ Web Orders through **Member**
- Web Orders ↔ Stock Movement through **Stock Movement**
- Web Orders ↔ Account Transactions through **Account Transactions**
- Members and Products ↔ Collection Points

`Products.Current stock` should be a rollup that sums `Stock Movement.Stock movement`.
`Members.Current credit` should be a rollup that sums `Account Transactions.Amount`.

## GitHub upload

Upload the **contents** of this repository to the root of the GitHub repository. The root should contain:

```text
src/
functions/
public/
baserow-imports/
package.json
astro.config.mjs
README.md
.env.example
.gitignore
```

Do not upload `node_modules`, `dist`, or a real `.env` file.

## Cloudflare Pages build settings

```text
Build command: npm run build
Build output directory: dist
Root directory: /
Node version: 22
```

This project deliberately does not include `package-lock.json`, because the previous Cloudflare environment repeatedly failed inside `npm clean-install`. Cloudflare should therefore use `npm install`.

## Cloudflare variables

Add these as ordinary production variables unless marked **Secret**.

### Build-time public content

```text
BASEROW_API_URL=https://api.baserow.io
BASEROW_SITE_SETTINGS_TABLE_ID=
BASEROW_PAGES_TABLE_ID=
BASEROW_SECTIONS_TABLE_ID=
BASEROW_PRODUCTS_TABLE_ID=
BASEROW_COLLECTION_POINTS_TABLE_ID=
```

Add `BASEROW_TOKEN` as a **Secret**. It only needs read permission for those five tables.

### Runtime ordering

```text
BASEROW_MEMBERS_TABLE_ID=
BASEROW_WEB_ORDERS_TABLE_ID=
BASEROW_STOCK_MOVEMENT_TABLE_ID=
BASEROW_ACCOUNT_TRANSACTIONS_TABLE_ID=
```

Add `BASEROW_RUNTIME_TOKEN` as a **Secret**. Give it only the permissions needed:

- Members: read
- Products: read
- Collection Points: read
- Web Orders: read, create, update
- Stock Movement: read, create
- Account Transactions: read, create

The runtime token is never sent to the browser.

### Optional email webhook

`MAGIC_LINK_WEBHOOK_URL` is optional. It should point to an automation endpoint that accepts JSON containing:

```json
{
  "email": "member@example.com",
  "link": "https://your-domain/orders/?token=...",
  "member": { "firstName": "..." },
  "basketSummary": []
}
```

You can connect this to your existing MailerLite/Baserow workflow. `SITE_URL` is not needed; the function derives the website origin from the request.

## Weekly member links

Send members to:

```text
https://your-domain/orders/?token=THEIR_ORDER_TOKEN
```

The token is checked against `Members.Order token`, `Members.Active`, and `Members.Order token expiry`.

## Editing content

- Global logos, colours and footer text: **Site Settings**
- Hero content and SEO: **Pages**
- Page content and layouts: **Sections**
- Sellable items: **Products**
- Stock balance: calculated from **Stock Movement**
- Member credit: calculated from **Account Transactions**

Blank presentation settings use sensible responsive defaults.
