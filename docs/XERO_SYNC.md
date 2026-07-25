# Xero Receive Money synchronisation

Use a standard OAuth 2.0 app with `offline_access` and the minimum bank-transaction read scope available to the app. The Baserow automation runs every 15 minutes.

Workflow: refresh access token; read the sync-state row; request Receive Money bank transactions modified since five minutes before the previous successful sync; upsert Account Transactions by `BankTransactionID`; match to Members using `Payment reference` or a stored Xero Contact ID; mark unmatched records as `Unmatched`; advance `Last successful sync` only after all rows have been written.

Reconciliation in Xero updates the same transaction. It must not create a second Baserow credit because the upsert key is the Xero transaction ID.

Do not expose OAuth client secrets, refresh tokens or access tokens in the website, GitHub, public Baserow views or public API tokens.
