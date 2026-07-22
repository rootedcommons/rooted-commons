# Rooted Commons website v1.1

This repository contains the Astro website, Cloudflare Pages Functions and Baserow templates for Rooted Commons.

## What this version provides

- Public pages assembled from **Pages** and **Sections** in Baserow.
- Section types: Text, Image and text, Banner, Cards, Grid, Call to action and Gallery.
- A public shop at `/orders/` that anyone can browse.
- Products may belong to multiple categories.
- Category tabs are generated automatically from Products.
- A browser-side basket that persists on the visitor's device.
- A sticky desktop basket and a floating mobile basket drawer.
- Checkout at `/checkout/` with member-token and email handoff support.
- Baserow-backed stock, orders and account-ledger functions from v1.

## Repository contents

```text
src/                 Astro pages and components
functions/           Cloudflare Pages Functions
public/              Static files
baserow-imports/     Complete current CSV templates
baserow-updates/     Small CSVs containing only the new v1.1 columns/rows
.env.example         Environment-variable names
```

## Baserow tables

The code expects these tables:

1. Site Settings
2. Pages
3. Sections
4. Products
5. Collection Points
6. Members
7. Web Orders
8. Stock Movement
9. Account Transactions

The complete CSV exports are in `baserow-imports/`. The v1.1 additions are also supplied separately in `baserow-updates/` so they can be copied into existing tables.

## Applying the v1.1 Baserow updates

### Products: multiple categories

Change the **Category** field in Products to a Baserow **Multiple select** field. A product can then have, for example:

```text
Cupboard Staples
Breakfast
Organic
```

The code also understands comma-separated exported values such as `Cupboard Staples, Breakfast`, but Multiple select is safer for editing in Baserow.

No extra Products column is required. See `baserow-updates/04-products-category-examples.csv` for examples.

### Orders page and product-grid width

Add the rows from:

```text
baserow-updates/02-pages-new-rows.csv
baserow-updates/03-sections-new-rows.csv
```

The `orders-products` Section row has:

```text
Section type: Grid
Grid source: Products
Columns: 3
```

Change **Columns** in that row to 2, 3 or 4 to alter the desktop grid. Mobile layouts automatically reduce the number of columns.

### Basket and checkout wording

Add the columns from:

```text
baserow-updates/01-site-settings-new-columns.csv
```

These fields control short interface labels, including:

- basket heading and empty message
- estimated-total label
- checkout button wording
- floating-basket label
- checkout email and confirmation wording

Longer explanatory copy belongs in the `orders` and `checkout` rows of **Pages**, or in Sections linked to those pages.

## Editing the Orders page

- Page title and introductory hero text: **Pages → orders**.
- Explanatory content before or after the shop: **Sections → Page = orders**.
- Product grid configuration: the Section with Key `orders-products`.
- Product data: **Products**.
- Basket button and interface labels: **Site Settings**.

The product Grid section is used as the insertion point for the interactive shop. Other Sections with an Order below it appear before the catalogue; Sections with a larger Order appear after it.

## Editing Checkout

- Page title and hero introduction: **Pages → checkout**.
- Longer explanatory content: **Sections → Page = checkout**.
- Short form/button labels: **Site Settings**.

## Cloudflare build settings

```text
Build command: npm run build
Build output directory: dist
Root directory: /
NODE_VERSION: 22
```

This project deliberately does not include `package-lock.json`, so Cloudflare uses `npm install` rather than the `npm clean-install` path that previously failed.

## Environment variables

The required names are listed in `.env.example`. Keep API tokens as Cloudflare Secrets. Table IDs can be ordinary environment variables.

## Uploading to GitHub

Upload the contents of this folder to the repository root. You should see `src`, `functions`, `public`, `baserow-imports`, `baserow-updates`, `package.json` and `astro.config.mjs` at the top level.
