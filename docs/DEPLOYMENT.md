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
