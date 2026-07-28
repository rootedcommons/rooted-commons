# Baserow schema expected by v2.1

Field names are case-sensitive in API and automation mappings. Use these exact names unless you also update the code.

## Products

Required by runtime ordering:

- `Product` — primary text field
- `Code` — text
- `Member price` — number/currency, 2 decimals
- `Available stock` — rollup of linked Stock Movement `Quantity change`
- `Available` — boolean
- `Category` — link/multiple select as currently configured
- `Available collection points` — optional link to Collection Points
- `Low stock threshold` — optional number; defaults to 5

`Available stock` is the sole stock source used by the order endpoint.

## Members

Required:

- `First name`
- `Email`
- `Active`
- `Order token`
- `Order token expiry`
- `Current credit`
- `Weekly commitment`
- `Collection point`
- `Payment reference` — unique BACS reference; code falls back to `RC-{row ID}`
- `Mollie payment URL` — optional hosted payment URL shown only when the member is below zero

## Site Settings payment fields

Add:

- `Bank account name`
- `Bank sort code`
- `Bank account number`

These are shown to authenticated members in the dashboard and used in the confirmation-email template.

## Collection Points

Required:

- `Name`
- `Active`
- `Available to collect here`
- `Orders close`
- address/content fields already used by the site

## Web Orders

Writable by the website:

- `Order number` — text
- `Member` — link to Members
- `Order week` — text
- `Collection point` — link to Collection Points
- `Status` — single select
- `Client request ID` — text
- `Item JSON` — long text
- `Stock Movement JSON` — long text; server-generated payload for Batch create rows
- `Order total` — number/currency, 2 decimals
- `Submitted at` — date/time
- `Confirmed at` — date/time
- `Order source` — single select
- `Email` — email/text

Recommended automation/administration fields:

- `Processing error` — long text
- `Confirmation email sent` — boolean
- `Confirmation email sent at` — date/time

Exact `Status` options:

- `Processing`
- `Confirmed`
- `Rejected`
- `Cancelled`
- `Ledger error`

Exact `Order source` option:

- `Website`

Remove or ignore these old fields:

- `Replaces order`
- Order Lines links
- Order Submissions links

## Stock Movement

Required:

- `Product code` — writable link to Products
- `Product name` — lookup from Product code; do not write directly
- `Quantity change` — signed number
- `Unit price` — number/currency, 2 decimals
- `Movement type` — single select
- `Order` — link to Web Orders
- `Date` — date/time
- `Reference` — text
- `Idempotency key` — text, strongly recommended
- `Notes` — long text
- `Active` — boolean, if used by the Products rollup

Exact order movement option:

- `Order`

Other useful manual options:

- `Opening`
- `Delivery`
- `Adjustment`
- `Wastage`

There is no `Stock Movement` quantity field and no automatic `Release` movement in v2.1.

## Account Transactions

Required for website order charges:

- `Date` — date/time
- `Type` — single select
- `Amount` — signed number/currency
- `Order` — link to Web Orders
- `Member` — link to Members
- `Notes` — long text
- `Email` — email/text
- `Transaction reference` — text
- `Included in credit` — boolean

Exact website type option:

- `Order charge`

`Amount` is negative for an order charge. There is no `Direction` field. Leave `Xero Contact ID` and other Xero-only fields blank for website orders.

## Removed tables

V2.1 does not use:

- Order Submissions
- Order Lines
