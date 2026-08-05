# Xero Receive Money synchronisation

OAuth connection setup is documented in `XERO_OAUTH_SETUP.md`.

Use Xero's standard OAuth 2.0 authorization-code flow. The private Xero Sync State row stores the tenant ID and current rotating refresh token. Client ID, Client Secret and the state-signing secret remain server environment secrets.

The payment sync will: load the current refresh token; exchange it for a fresh access token; immediately save the newly rotated refresh token; read the sync-state row; request reconciled Receive Money bank transactions modified since a small overlap before the previous successful sync; upsert Account Transactions by `BankTransactionID`; match the transaction Reference to Members using the canonical `Member number` (`RC-x`), with unmatched/review fallback; and advance `Last successful sync` only after all rows have been written.

Reconciliation in Xero updates the same transaction. It must not create a second Baserow credit because the upsert key is the Xero transaction ID.

The standard Accounting API does not expose ordinary unreconciled bank-feed statement lines, so this integration credits only transactions that have become visible as Xero bank transactions.

Do not expose OAuth client secrets, refresh tokens or access tokens in website HTML, GitHub, public Baserow views or browser-facing API responses.


## v2.9.3 member matching

Member payments use the single generic Xero contact `Rooted Commons Membership`. Personal member details are not required in Xero. For Receive Money transactions coded to `810 – Member Credit`, preserve the bank/Xero reference. Extract an `RC-<number>` token and match it to `Members → Member number`. Only import when exactly one member matches. Store the raw reference in `Xero Reference` and use `Xero BankTransactionsID` / `Xero PaymentID` for idempotency. Manual Receive Money transactions can be imported before the bank feed arrives; later reconcile the bank line against that existing Xero transaction rather than creating a second transaction.
