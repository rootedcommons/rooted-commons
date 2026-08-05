# Baserow schema expected by v2.9.4

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
- `Late collection` — single select: `Thursday only`, `Friday okay`, `Weekend okay`; blank/missing defaults to Thursday only

`Available stock` is the sole stock source used by the order endpoint.

## Members

Required:

- `First name`
- `Email`
- `Active`
- `Order token`
- `Token created` — date/time set whenever a new Order token is generated
- `Order token expiry` — date/time; next Wednesday at 18:05 Europe/London
- `Current credit`
- `Weekly commitment`
- `Collection point`
- `Preferred collection day` — single select: Thursday / Friday / Saturday / Sunday
- `Member number` — primary Formula field: `concat('RC-', row_id())`; this is also the BACS/Xero payment reference
- `Mollie payment URL` — optional hosted payment URL shown only when the member is below zero
- `Phone` — required by signup for membership/order issues
- `Membership consent` — boolean; must be true at signup
- `Weekly newsletter` — optional boolean consent for including news/updates in the weekly service email
- `Monthly equivalent` — number/currency, 2 decimals
- `Contribution frequency` — single select: Weekly / Monthly
- `Product requests` — optional long text written from the signup Requests section
- `Email verified` — boolean; false on signup and set true from the emailed confirmation link
- `Email verified at` — date/time set when the confirmation link is opened

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
- `Thursday collection time`
- optional `Friday collection time`, `Saturday collection time`, `Sunday collection time`
- optional `Latitude` and `Longitude` — decimal coordinates used by the `/collection-points/` map

Collection time fields contain **times only**, using 24-hour dotted notation such as `9.00-16.00`, `10.00-16.30` or `17.00-19.00`. Do not include the weekday in the field.
- address/content fields already used by the site

The website uses a single global deadline of Wednesday 18.00.

## Web Orders

Writable by the website:

- `Order number` — text
- `Member` — link to Members
- `Order week` — text
- `Collection point` — link to Collection Points
- `Collection date` — customer collection date
- `Collection day` — selected weekday
- `Collection time` — selected time/window, stored as single-line text in 24-hour dotted notation
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

`Amount` is negative for an order charge. There is no `Direction` field. Xero payment imports now identify members by the `RC-x` reference rather than personal Xero contacts.

## Removed tables

V2.1 does not use:

- Order Submissions
- Order Lines


## Interface Content (build-time CMS)

Set `BASEROW_INTERFACE_CONTENT_TABLE_ID` to a table containing `Key`, `Area`, `Label` and `Content`. The site reads `Key` and `Content`; the other fields are editorial aids. Missing rows use code fallbacks.
