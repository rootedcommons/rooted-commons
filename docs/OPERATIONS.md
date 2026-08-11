# Operations

This document describes the current operating behaviour of v2.9.52 rather than historical upgrade steps.

## Orders and stock
The browser basket is not authoritative and does not reserve stock. At confirmation the restricted order endpoint reloads the member, product prices, available stock and collection rules from Baserow. It creates one Processing Web Order. A published Baserow automation then creates the stock movements and account debit, confirms the order and sends the confirmation email.

One member may have one Processing or Confirmed order per ordering week. Confirmed-order amendments, cancellations, stock corrections and refunds are handled administratively rather than through automatic replacement logic.

Stock is ledger-based: positive movements add stock; orders, wastage and negative corrections reduce it. Historical movements should be reversed with compensating entries rather than deleted.

## Collection windows

Rooted Commons has one weekly order deadline: **Wednesday at 18.00**. Orders are delivered to collection points on Thursday, but customers may collect later where the collection point and basket allow it.

## Baserow setup

### Collection Points
Use these single-line text fields:
- `Thursday collection time` — e.g. `17.00-19.00`
- `Friday collection time` — e.g. `9.00-16.00`; blank if unavailable
- `Saturday collection time` — e.g. `10.00-16.30`; blank if unavailable
- `Sunday collection time` — blank if unavailable

Times are stored and displayed in **24-hour dotted notation**: `9.00-16.00`, `10.00-16.30`, `17.00-19.00`. Do not include the day name in these fields; the site adds it automatically. The legacy `Collection time` field is still accepted as a Thursday fallback during migration.

### Products
Use `Late collection` as a single select with exactly:
- `Thursday only`
- `Friday okay`
- `Weekend okay`

The code defaults to **Thursday only** if the field is blank or missing. Fresh produce that may be collected Friday should use `Friday okay`; it will never be offered for Saturday or Sunday collection. Cupboard staples/refills that can wait until the weekend can use `Weekend okay`.

### Members
Use `Preferred collection day` as a single select: `Thursday`, `Friday`, `Saturday`, `Sunday`. It is a preference only. Checkout validates it against the selected collection point and the most restrictive product in the basket.

### Web Orders
Use these immutable snapshot fields:
- `Collection date` — Date
- `Collection day` — Single line text
- `Collection time` — Single line text

There is no fulfilment-date field: operational delivery is always Thursday.

## Rollover notice
From Wednesday 18.00 until Monday, the Orders page displays a highlighted notice explaining that collection for the current week has closed and the order is for collection from the following Thursday.

## Member payments and Xero

OAuth connection setup is documented in `XERO_OAUTH_SETUP.md`.

Use Xero's standard OAuth 2.0 authorization-code flow. The private Xero Sync State row stores the tenant ID and current rotating refresh token. Client ID, Client Secret and the state-signing secret remain server environment secrets.

The payment sync will: load the current refresh token; exchange it for a fresh access token; immediately save the newly rotated refresh token; read the sync-state row; request reconciled Receive Money bank transactions modified since a small overlap before the previous successful sync; upsert Account Transactions by `BankTransactionID`; match the transaction Reference to Members using the canonical `Member number` (`RC-x`), with unmatched/review fallback; and advance `Last successful sync` only after all rows have been written.

Reconciliation in Xero updates the same transaction. It must not create a second Baserow credit because the upsert key is the Xero transaction ID.

The standard Accounting API does not expose ordinary unreconciled bank-feed statement lines, so this integration credits only transactions that have become visible as Xero bank transactions.

Do not expose OAuth client secrets, refresh tokens or access tokens in website HTML, GitHub, public Baserow views or browser-facing API responses.


## v2.9.3 member matching

Member payments use the single generic Xero contact `Rooted Commons Membership`. Personal member details are not required in Xero. For Receive Money transactions coded to `810 – Member Credit`, preserve the bank/Xero reference. Extract an `RC-<number>` token and match it to `Members → Member number`. Only import when exactly one member matches. Store the matched `RC-<number>` in `Payment reference`. Use `Xero BankTransactionsID` as the idempotency key for imported Receive Money / bank transactions. `Xero Reference` and `Xero PaymentID` are not required by the current member-payment architecture. Manual Receive Money transactions can be imported before the bank feed arrives; later reconcile the bank line against that existing Xero transaction rather than creating a second transaction.

## Welcome/service email template

Suggested subject:

**Welcome to Rooted Commons – confirm your email**

Suggested body:

> Hi {{ first_name }},
>
> Welcome to Rooted Commons. Your membership has been created successfully.
>
> Please confirm that this email address belongs to you by opening your weekly access link:
>
> **[Confirm my email and open my dashboard]**
>
> This is a unique private link to your membership account and member credit. Please do not share it with anyone or use it on someone else's device.
>
> We send a new weekly access link each Wednesday after orders close. The new link replaces the previous link for new sign-ins, while devices that are already signed in remain signed in for up to 90 days.
>
> Your member number and payment reference is **{{ member_number }}**.
>
> Rooted Commons

Use the webhook payload's `link` (or `verificationLink`) for the confirmation button.

The signup endpoint also supplies `dashboardLink`, `member.firstName`, `member.lastName`, `member.memberNumber`, and the selected contribution frequency/amount.
