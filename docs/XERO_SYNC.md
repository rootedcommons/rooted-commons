# Xero Receive Money synchronisation

OAuth connection setup is documented in `XERO_OAUTH_SETUP.md`.

Use Xero's standard OAuth 2.0 authorization-code flow. The private Xero Sync State row stores the tenant ID and current rotating refresh token. Client ID, Client Secret and the state-signing secret remain server environment secrets.

The payment sync will: load the current refresh token; exchange it for a fresh access token; immediately save the newly rotated refresh token; read the sync-state row; request reconciled Receive Money bank transactions modified since a small overlap before the previous successful sync; upsert Account Transactions by `BankTransactionID`; match to Members using a stored Xero Contact ID (with review fallback); and advance `Last successful sync` only after all rows have been written.

Reconciliation in Xero updates the same transaction. It must not create a second Baserow credit because the upsert key is the Xero transaction ID.

The standard Accounting API does not expose ordinary unreconciled bank-feed statement lines, so this integration credits only transactions that have become visible as Xero bank transactions.

Do not expose OAuth client secrets, refresh tokens or access tokens in website HTML, GitHub, public Baserow views or browser-facing API responses.
