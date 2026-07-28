# Baserow order-processing automation (Free tier)

This workflow processes each `Web Orders` row created by the website. It does not require Execute code.

## Prerequisites

Create the exact fields and select options in `BASEROW_SCHEMA.md`.

The website writes two server-generated JSON fields:

- `Item JSON`: readable order snapshot.
- `Stock Movement JSON`: rows already shaped for Baserow's Batch create rows action.

Prices, quantities and totals in both fields are generated server-side from current Baserow product data. Browser-supplied prices are ignored.

## Workflow outline

```text
Rows are created in Web Orders
→ Router: Status = Processing AND Order source = Website
→ Batch create Stock Movement rows
→ Create Account Transaction
→ Update Web Order to Confirmed
```

Use a separate workflow for email so an SMTP failure cannot interfere with stock or member-credit processing.

## 1. Trigger

Create an automation and choose **Rows are created**:

- Table: `Web Orders`
- Label: `New Web Order`

Test it with a genuine website order.

## 2. Router

Create a branch named `Processing website order`.

In basic mode use:

```text
Status → value equals Processing
AND
Order source → value equals Website
```

For single-select fields choose their `value`, not `[All]`.

## 3. Batch create Stock Movement rows

Add **Batch create rows** and select `Stock Movement`.

Set Rows to this formula, inserting the field token from the Data panel:

```text
from_json([New Web Order → Stock Movement JSON])
```

The JSON already uses the destination field names and contains rows like:

```json
[
  {
    "Product code": [123],
    "Quantity change": -2,
    "Unit price": 2.5,
    "Movement type": "Order",
    "Order": ["RC-202631-123456"],
    "Date": "2026-07-28T09:00:00Z",
    "Idempotency key": "order-RC-202631-123456-product-123",
    "Active": true
  }
]
```

Do not map fields individually in the batch node. Test it and confirm one Stock Movement is created per item.

`Product name` is a lookup from `Product code`; it must not be written directly.

## 4. Create Account Transaction

Add **Create a row** for `Account Transactions` after the batch action.

Map:

| Field | Value |
|---|---|
| Date | `now()` |
| Type | `Order charge` |
| Amount | `0 - [New Web Order → Order total]` |
| Order | `New Web Order → Order number` |
| Member | `New Web Order → Member → [0] → id` |
| Included in credit | `true` |

Leave `Xero Contact ID`, Xero transaction fields, Notes and other optional fields blank unless you need them.

For linked fields that hold exactly one row, use `[0]` to select the first linked record. `[All]` returns the whole array and is not appropriate where the action expects one linked row identifier.

## 5. Mark the Web Order Confirmed

Add **Update a row** for `Web Orders`:

- Row: triggering `New Web Order` row ID
- Status: `Confirmed`
- Confirmed at: `now()`

Run this only after Batch create and Account Transaction succeed. If either fails, the order remains `Processing` and is visible for investigation.

## 6. Email workflow

Create a second automation triggered when a Web Order is updated.

Conditions:

```text
Status = Confirmed
AND
Confirmation email sent = false
```

Send an HTML email using the existing fields, for example:

- Member name
- Order number
- Order summary
- Order total
- Collection point

After successful sending, update:

- `Confirmation email sent` = true
- `Confirmation email sent at` = `now()`

Keeping email separate means an SMTP failure does not invalidate a confirmed order.

## Credits

The core workflow uses a fixed number of action credits per order:

- Batch create Stock Movement rows: 1 action
- Create Account Transaction: 1 action
- Update Web Order: 1 action

This remains approximately three action credits regardless of the number of products in the basket. Email actions consume additional credits.

## Monitoring views

Create these Web Orders views:

- `Processing` — Status is Processing
- `Processing over 15 minutes` — stale Processing rows
- `Confirmed, email unsent` — Confirmed and email-sent checkbox is false
- `Ledger errors` — Status is Ledger error, if used manually

## Manual changes and cancellations

There are no automatic replacements, releases or reversals.

For a change or refund:

1. amend the order manually;
2. add compensating signed Stock Movement rows;
3. add a compensating Account Transaction where needed;
4. contact the member manually.
