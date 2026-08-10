# Rooted Commons v2.9.15

Rooted Commons is an Astro website backed by Baserow. Baserow is the operational source of truth; the web host stores no authoritative business state. Xero can be used as the source for reconciled member payments.

This package has been reorganised so that documentation describes the **current release**, rather than retaining a separate setup note for every historical version. Historical changes remain in `CHANGELOG.md` and Git history.

## Start here

1. Read [`docs/GETTING-STARTED.md`](docs/GETTING-STARTED.md).
2. Build or verify Baserow using [`docs/BASEROW-SETUP.md`](docs/BASEROW-SETUP.md).
3. Configure and deploy using [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
4. Use [`docs/OPERATIONS.md`](docs/OPERATIONS.md) for the live weekly workflow.
5. Use [`docs/TECHNICAL-REFERENCE.md`](docs/TECHNICAL-REFERENCE.md) for architecture, CMS options and testing.

## Application

Requirements: Node.js 22 and npm.

```bash
npm install
cp .env.example .env
npm run dev
```

Production build:

```bash
npm run build
```

The existing `baserow-imports/` and `baserow-table-specification/` folders are retained unchanged in this housekeeping release. They will be rebuilt from clean live exports for v3.0.


## Access-link email flow

Checkout, signup and the Sign in page post to `/api/request-link`. For a matching active member, Cloudflare reconstructs the current weekly access link from the non-secret Member Sessions record plus the Cloudflare signing secret and sends it directly through mailbox.org SMTP. Baserow never stores a usable bearer link. Opening a weekly link creates a separate 90-day HttpOnly device session. A Wednesday scheduler replaces only the `Weekly access` credential and emails it to active members; existing device sessions are unaffected.

### Our Network data model (v2.9.38+)

The Our Network page can now use two dedicated Baserow tables rather than treating partners as generic page cards: **Network Partners** for profiles and **Metrics** for measurable outcomes. Use `Stats` and `Network` section rows to place those datasets anywhere in the page flow. See `docs/BASEROW-SETUP.md` for the migration steps.


### Live CMS

From v2.9.42, most editorial Baserow content is refreshed at runtime through sanitised Cloudflare public endpoints. See `docs/TECHNICAL-REFERENCE.md` for the public/private boundary and runtime-token permissions.


### Transparent product price breakdown (v2.9.43)

Products can optionally link `Source value recipient` to one `Network Partners` row and store a numeric `Source value`. When both are present, the product detail modal shows the source recipient, the calculated Commons contribution/subsidy, and the member price. `Commons contribution/subsidy` is not stored: it is always calculated as `Member price - Source value`. A zero result is hidden. The source recipient links to its Network Partner profile. Existing `Origin` and `Secondary origin` fields are unchanged.

### Inline price transparency help (v2.9.45)

The product-card price `ⓘ` opens an inline `Where your money goes` panel. Add `Price explanation` (Long text) to Network Partners for partner-specific source-value help. Price help copy is otherwise managed in Interface Content with keys `price_breakdown.source_help`, `price_breakdown.contribution_help`, `price_breakdown.subsidy_help`, `price_breakdown.member_price_help`, `price_breakdown.partner_link_label`, `price_breakdown.commons_link_label`, and `price_breakdown.commons_link_url`. These values are fetched live through the public-content/public-network APIs.

