# Baserow schema reference

Field names are case-sensitive from the code's point of view. Use the names below exactly.

## Products
Required: `Product`, `Code`, `Member price`, `Available`, `Available stock`, `Low stock threshold`, `Category`, `Subcategory`, `Available collection points`. `Available stock` is numeric. `Low stock threshold` defaults to 5.

## Members
Required: `First name`, `Email`, `Active`, `Order token`, `Order token expiry`, `Current credit`, `Weekly commitment`, `Collection point`, `Member since`, `Founder badge`, `Payment reference`. Founder badge options: `Founder 10`, `Founder 25`, `Founder 50`.

## Web Orders
Required writable fields: `Order number`, `Member`, `Order week`, `Collection point`, `Status`, `Client request ID`, `Item JSON`, `Order total`, `Submitted at`, `Confirmed at`, `Replaces order`, `Order source`, `Email`. `Starting credit` and `Estimated closing credit` may remain as Baserow lookup/formula fields, but the website does not write to them. Status options: `Pending`, `Processing`, `Confirmed`, `Rejected`, `Replaced`, `Cancelled`.

## Order Lines
Required: `Order`, `Product`, `Quantity`, `Unit price`, `Line total` (formula), `Status`, `Stock movement`, `Product name snapshot`, `Unit snapshot`. Status options: `Active`, `Released`, `Cancelled`.

## Stock Movement
Required: `Product code` (link to Products); `Product name` should be a lookup from that link, `Quantity change`, `Movement type`, `Order`, `Order Line`, `Date`, `Idempotency key`, `Reference`, `Notes`, `Active`, `Created by`. `Quantity change` is signed: receipts and releases are positive; orders and wastage are negative. Movement type options: `Opening`, `Delivery`, `Order`, `Release`, `Adjustment`, `Wastage`.


## Account Transactions
Required for all rows: `Date`, `Amount`, `Type`, `Member`, `Included in credit`, `Transaction reference`, `Order`, `Notes`. `Amount` is signed: credits/top-ups and order reversals are positive; order charges and outgoing payments are negative. Website order types: `Order charge`, `Order reversal`. Xero-only fields may remain blank on website rows: `Xero Transaction ID`, `Xero Payment ID`, `Xero Contact ID`, `Contact name`, `Bank account`, `Imported at`, `Last updated from Xero`, `Reconciled`, `Status`. Match status options for imported Xero rows: `Matched`, `Unmatched`, `Ambiguous`, `Ignored`.

## Collection Points
Required: `Name`, `Address`, `Description`, `Image`, `Link`, `Active`, `Available to collect here`, `Collection time`, `Orders close`. Store `Orders close` as a local text value such as `18:00`; do not store it as UTC.

## Xero Sync State
Required: `Name`, `Last successful sync`, `Last attempted sync`, `Last error`, `Tenant ID`, `Consecutive failures`, `Connection status`. Connection status options: `Not connected`, `Connected`, `Error`, `Reauthorisation required`. Secrets and refresh tokens should use Baserow's secret storage or automation secrets, not a public table.
