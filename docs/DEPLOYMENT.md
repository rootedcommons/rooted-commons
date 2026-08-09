# Deployment

## Build

```bash
npm install
npm run build
```

Deploy `dist/` together with `functions/` on a host that supports static output plus server functions.

## Environment

Start from `.env.example`. Keep runtime Baserow credentials and all Xero credentials server-side. Never expose secrets through `PUBLIC_` variables, generated HTML, public Baserow views or Git.

## Baserow credentials

Use separate credentials:

- build-time read-only access for public content tables;
- restricted runtime access for member/order operations and the minimum private tables required by enabled integrations.

See `BASEROW-SETUP.md` for exact permissions and table fields.

## Xero OAuth (optional)

Rooted Commons uses Xero's standard OAuth 2.0 authorization-code flow. The public website never receives the Xero client secret or refresh token.

## 1. Xero app settings

Use:

- Company/application URL: `https://rootedcommons.uk`
- Redirect URI: `https://rootedcommons.uk/api/xero/callback`
- Grant type: Authorization Code / Web App

The code requests these scopes by default:

`openid profile email offline_access accounting.banktransactions.read accounting.contacts.read`

`offline_access` is required so Xero returns a refresh token.

## 2. Cloudflare Pages secrets/environment variables

Add these to the Production environment:

- `XERO_CLIENT_ID` — from the Xero app
- `XERO_CLIENT_SECRET` — from the Xero app; secret
- `XERO_STATE_SECRET` — a long random value used to sign the OAuth state parameter; secret
- `BASEROW_XERO_SYNC_STATE_TABLE_ID` — numeric ID of the private Xero Sync State table
- `BASEROW_RUNTIME_TOKEN` — existing restricted server-side Baserow token; it now needs read/write access to Xero Sync State as well
- optional `XERO_REDIRECT_URI` — normally omit; the code derives `https://rootedcommons.uk/api/xero/callback`

Do not prefix Xero secrets with `PUBLIC_` and do not put them in Astro build-time variables.

## 3. Xero Sync State fields

The private Xero Sync State table must include:

- `Name`
- `Tenant ID`
- `Tenant name` (optional display convenience)
- `Refresh token` (Long text; private)
- `Connection status`
- the existing sync/error state fields

Keep a row named `Xero primary connection`.

The refresh token is deliberately stored in this private operational table because Xero rotates it whenever the sync refreshes access. It must never be exposed through public Baserow views or a browser-facing endpoint.

## 4. Connect once

After deploying, visit:

`https://rootedcommons.uk/api/xero/connect`

The server sends you to Xero. Choose the single organisation used by Rooted Commons and approve access. Xero redirects to `/api/xero/callback`, which:

1. verifies the signed `state` value;
2. exchanges the one-time authorization code server-side;
3. calls Xero `/connections`;
4. stores the tenant ID and rotating refresh token in Xero Sync State;
5. marks the connection `Connected`.

No token is displayed in the browser.

## 5. Security notes

- Keep the Xero Sync State table private.
- The Baserow runtime token must be server-side only.
- Never expose `Refresh token` in `/api/member`, site builds, public views or GitHub.
- The later payment-sync function must replace `Refresh token` in Baserow every time Xero returns a rotated refresh token.

## Automatic Xero member-payment sync

The website exposes a protected `POST /api/xero/sync` endpoint. Configure a secret named `XERO_SYNC_KEY` in the Cloudflare Pages project. The endpoint refreshes the existing Xero OAuth connection, imports reconciled `RC-number` Receive Money transactions, and updates the Xero Sync State record.

Cloudflare Pages Functions do not themselves provide a Cron Trigger configuration. Deploy `cloudflare/xero-sync-cron-worker.js` as a small separate Worker, configure `ROOTED_SYNC_URL` as `https://rootedcommons.uk/api/xero/sync`, give it the same `XERO_SYNC_KEY`, and add the Cron Trigger `*/15 * * * *`.

The sync is idempotent by Xero BankTransactionID. Payments with an exact RC reference but no matching member are recorded as Unmatched and excluded from member credit; unrelated receipts are ignored.


## v2.9.29 member-session security setup

Before deploying the session migration, create the **Member Sessions** table described in `BASEROW-SETUP.md`.

Add these encrypted secrets/variables to the Cloudflare Pages project:

- `BASEROW_MEMBER_SESSIONS_TABLE_ID` — the new table ID.
- `AUTH_SESSION_SECRET` — a long random value (at least 32 random bytes / 43+ base64url characters recommended). Never store this in Baserow or Git.
- `SMTP_HOST` — `smtp.mailbox.org` unless using another SMTP service.
- `SMTP_PORT` — `465`.
- `SMTP_USERNAME` — the mailbox.org sending mailbox.
- `SMTP_PASSWORD` — the mailbox password/app credential, stored as a Cloudflare secret.
- `ACCESS_EMAIL_FROM` — sender address for member access links.
- `EMAIL_FROM_NAME` — normally `Rooted Commons`.



Access-link requests are now sent directly from the Cloudflare Function through mailbox.org SMTP. The Baserow `Access link requested at` field remains a useful audit/rate-limit timestamp but no Baserow email automation is required for access links.

### Weekly access rotation

Set `WEEKLY_ACCESS_SYNC_KEY` as an encrypted secret on the Pages project. Create a small standalone Cloudflare Worker from `cloudflare/weekly-access-cron-worker.js` with `ROOTED_WEEKLY_ACCESS_URL=https://rootedcommons.uk/api/weekly-access/sync` and the same `WEEKLY_ACCESS_SYNC_KEY`. Give the Worker two Wednesday cron triggers, `10 17 * * 3` and `10 18 * * 3`. The Worker checks Europe/London time and only calls the site during the 18:05–18:35 local window, so this remains correct across GMT/BST. The endpoint is idempotent: `Email sent at` prevents duplicate weekly messages on retry.


## Live public CMS layer (v2.9.42)

`CMS` means **Content Management System**. Baserow is the CMS for editable Rooted Commons website content. The browser never talks to Baserow directly. It requests sanitised JSON from Cloudflare Pages Functions, which hold `BASEROW_RUNTIME_TOKEN` server-side.

`/api/public-content` reads Site Settings, Pages, Sections, Interface Content and Collection Points with strict public-field allowlists. `/api/public-network` independently reads Network Partners, Metrics and the aggregate inputs needed for approved calculated tokens. A failure in one optional table is reported in the endpoint `errors` array and no longer takes unrelated public content down.

Astro still writes the last deployed Baserow content into the HTML as a fallback. On page load the live hydrators refresh existing CMS-controlled content. This preserves a fast first render and useful HTML for search engines while allowing routine Baserow edits to appear without redeploying. A new Section row or a Section type change still requires deployment because it changes the component structure.

The runtime token should have the minimum permissions actually needed. For the live public CMS layer it needs **Read** on Site Settings, Pages, Sections, Interface Content, Collection Points, Metrics and Network Partners, in addition to the narrowly scoped permissions already required by member/order functions. Never expose this token in browser JavaScript.
