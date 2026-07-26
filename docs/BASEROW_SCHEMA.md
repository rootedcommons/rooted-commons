# Baserow schema reference

Field names are case-sensitive from the code's point of view. Use the names below exactly.

## Products
Required: `Product`, `Code`, `Member price`, `Available`, `Available stock`, `Low stock threshold`, `Category`, `Subcategory`, `Available collection points`. `Available stock` is numeric. `Low stock threshold` defaults to 5.

## Members
Required: `First name`, `Email`, `Active`, `Order token`, `Order token expiry`, `Current credit`, `Weekly commitment`, `Collection point`, `Member since`, `Founder badge`, `Payment reference`. Founder badge options: `Founder 10`, `Founder 25`, `Founder 50`.

## Web Orders
Required: `Order number`, `Member`, `Order week`, `Collection point`, `Status`, `Client request ID`, `Item JSON`, `Order total`, `Starting credit`, `Estimated closing credit`, `Submitted at`, `Confirmed at`, `Replaces order`, `Order source`, `Email`. Status options: `Pending`, `Processing`, `Confirmed`, `Rejected`, `Replaced`, `Cancelled`.

## Order Lines
Required: `Order`, `Product`, `Quantity`, `Unit price`, `Line total` (formula), `Status`, `Stock movement`, `Product name snapshot`, `Unit snapshot`. Status options: `Active`, `Released`, `Cancelled`.

## Stock Movement
Required: `Product name` (link to Products), `Quantity change`, `Movement type`, `Order`, `Order Line`, `Date`, `Idempotency key`, `Reference`, `Notes`, `Active`, `Created by`. `Quantity change` is signed: receipts and releases are positive; orders and wastage are negative. Movement type options: `Opening`, `Delivery`, `Order`, `Release`, `Adjustment`, `Wastage`.

## Order Submissions
Required: `Client request ID`, `Member`, `Collection point`, `Basket payload`, `Status`, `Submitted at`, `Processing started at`, `Processing completed at`, `Result order`, `Failure reason`, `Attempt count`. Status options: `Pending`, `Processing`, `Accepted`, `Rejected`.

## Account Transactions
Required: `Xero Transaction ID`, `Date`, `Imported at`, `Last updated from Xero`, `Amount`, `Type`, `Transaction reference`, `Contact name`, `Xero Contact ID`, `Bank account`, `Member`, `Match status`, `Reconciled`, `Status`, `Included in credit`, `Order`, `Notes`. Match status options: `Matched`, `Unmatched`, `Ambiguous`, `Ignored`. `Amount` is signed: credits/top-ups are positive and debits/order charges/refunds paid out are negative.

## Collection Points
Required: `Name`, `Address`, `Description`, `Image`, `Link`, `Active`, `Available to collect here`, `Collection time`, `Orders close`. Store `Orders close` as a local text value such as `18:00`; do not store it as UTC.

## Xero Sync State
Required: `Name`, `Last successful sync`, `Last attempted sync`, `Last error`, `Tenant ID`, `Consecutive failures`, `Connection status`. Connection status options: `Not connected`, `Connected`, `Error`, `Reauthorisation required`. Secrets and refresh tokens should use Baserow's secret storage or automation secrets, not a public table.
