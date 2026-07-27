# Baserow order-processing automation

This workflow processes each `Web Orders` row created by the website. Build and test it before publishing the V2.1 site.

## Prerequisites

Create the exact fields and select options in `BASEROW_SCHEMA.md`. Add an SMTP integration in the Automation settings. The Execute code node is required for parsing the basket JSON and generating the HTML email.

## Workflow outline

```text
Rows are created in Web Orders
→ Router: Status is Processing and Order source is Website
→ Execute code: Parse order and build email
→ Iterator over parsed items
    → Create Stock Movement
→ Create Account Transaction
→ Update Web Order to Confirmed
→ Send confirmation email
→ Update email-sent fields
```

## 1. Create the automation

1. Open **Automations** in the Rooted Commons workspace.
2. Create an automation called `Website order processing`.
3. Add a workflow called `Process new Web Order`.
4. Keep it in Draft until every node has passed a test.

## 2. Trigger

Choose **Rows are created**.

- Database: Rooted Commons database
- Table: `Web Orders`
- Label: `New Web Order`

Test the trigger using a genuine test row with:

- Status: `Processing`
- Order source: `Website`
- a valid linked Member and Collection point
- valid Item JSON
- an Order total
- an Email

## 3. Router guard

Add a Router immediately after the trigger.

Create a branch named `Process website order` whose condition is:

```text
Status equals Processing
AND
Order source equals Website
```

Leave the default branch empty. This prevents manually added or already processed rows from being charged.

## 4. Execute code: Parse order

Add an **Execute code** node named `Parse order and build email`.

### Data injections

Add these injections from the trigger row:

| Injection name | Trigger value |
|---|---|
| `itemJson` | Item JSON |
| `orderId` | Row ID |
| `orderNumber` | Order number |
| `orderTotal` | Order total |
| `submittedAt` | Submitted at |
| `email` | Email |
| `collectionPoint` | Collection point display value |
| `memberName` | Member display value, or First name lookup if available |

### JavaScript

```js
function main(context) {
  const escapeHtml = (value) => String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');

  let basket;
  try {
    basket = JSON.parse(String(context.itemJson || '[]'));
  } catch {
    throw new Error('Item JSON is not valid JSON.');
  }

  if (!Array.isArray(basket) || basket.length === 0) {
    throw new Error('Item JSON does not contain any basket items.');
  }

  const now = new Date().toISOString();
  const items = basket.map((raw, index) => {
    const productId = Number(raw.product_id);
    const quantity = Math.floor(Number(raw.quantity));
    const unitPrice = Math.round(Number(raw.unit_price) * 100) / 100;
    const lineTotal = Math.round(Number(raw.line_total) * 100) / 100;

    if (!Number.isInteger(productId) || productId < 1) {
      throw new Error(`Basket item ${index + 1} has an invalid product_id.`);
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      throw new Error(`Basket item ${index + 1} has an invalid quantity.`);
    }
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error(`Basket item ${index + 1} has an invalid unit_price.`);
    }
    if (Math.abs(lineTotal - Math.round(unitPrice * quantity * 100) / 100) > 0.001) {
      throw new Error(`Basket item ${index + 1} has an inconsistent line_total.`);
    }

    return {
      product_id: productId,
      product_name: String(raw.product_name || `Product ${productId}`),
      product_code: String(raw.product_code || ''),
      quantity,
      quantity_change: -quantity,
      unit_price: unitPrice,
      line_total: lineTotal,
      movement_date: now,
      movement_type: 'Order',
      reference: String(context.orderNumber || context.orderId),
      order_id: Number(context.orderId),
      idempotency_key: `website-order-${context.orderId}-product-${productId}`,
      notes: `Website order ${context.orderNumber || context.orderId}`
    };
  });

  const calculatedTotal = Math.round(
    items.reduce((sum, item) => sum + item.line_total, 0) * 100
  ) / 100;
  const storedTotal = Math.round(Number(context.orderTotal) * 100) / 100;

  if (!Number.isFinite(storedTotal) || Math.abs(calculatedTotal - storedTotal) > 0.001) {
    throw new Error(`Order total mismatch: JSON ${calculatedTotal}, row ${storedTotal}.`);
  }

  const rows = items.map((item) => `
    <tr>
      <td style="padding:10px;border-bottom:1px solid #ddd">${escapeHtml(item.product_name)}</td>
      <td style="padding:10px;border-bottom:1px solid #ddd;text-align:center">${item.quantity}</td>
      <td style="padding:10px;border-bottom:1px solid #ddd;text-align:right">£${item.unit_price.toFixed(2)}</td>
      <td style="padding:10px;border-bottom:1px solid #ddd;text-align:right">£${item.line_total.toFixed(2)}</td>
    </tr>`).join('');

  const emailHtml = `
    <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#2d2d2d">
      <h1 style="color:#5a2d4d">Your Rooted Commons order</h1>
      <p>Hi ${escapeHtml(context.memberName || 'there')},</p>
      <p>Your order <strong>${escapeHtml(context.orderNumber)}</strong> has been confirmed.</p>
      <table style="border-collapse:collapse;width:100%;margin:20px 0">
        <thead>
          <tr>
            <th style="padding:10px;text-align:left;border-bottom:2px solid #5a2d4d">Item</th>
            <th style="padding:10px;text-align:center;border-bottom:2px solid #5a2d4d">Qty</th>
            <th style="padding:10px;text-align:right;border-bottom:2px solid #5a2d4d">Price</th>
            <th style="padding:10px;text-align:right;border-bottom:2px solid #5a2d4d">Total</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <p style="font-size:18px"><strong>Order total: £${storedTotal.toFixed(2)}</strong></p>
      <p><strong>Collection:</strong> ${escapeHtml(context.collectionPoint || '')}</p>
      <p>Thank you for supporting local producers through Rooted Commons.</p>
    </div>`;

  return {
    items,
    processed_at: now,
    calculated_total: calculatedTotal,
    email_html: emailHtml,
    email_subject: `Rooted Commons order ${context.orderNumber} confirmed`
  };
}
```

Test this node. Confirm the output contains `items`, `processed_at`, `email_html`, and the expected total.

## 5. Iterator: basket items

Add an **Iterator** named `Each basket item`.

Set Source to:

```text
Parse order and build email → items
```

Inside the Iterator, add **Create a row** for `Stock Movement`.

Map fields from the current Iterator item:

| Stock Movement field | Current item value |
|---|---|
| Product code | `product_id` |
| Quantity change | `quantity_change` |
| Unit price | `unit_price` |
| Movement type | `movement_type` |
| Order | `order_id` |
| Date | `movement_date` |
| Reference | `reference` |
| Idempotency key | `idempotency_key` |
| Notes | `notes` |
| Active | `true` |

Do not map `Product name`; it is a lookup from `Product code`.

Test the Iterator using a one-item or two-item test basket. Confirm each item creates exactly one negative Stock Movement.

## 6. Create Account Transaction

After the Iterator, add **Create a row** for `Account Transactions`.

Map:

| Account Transactions field | Value |
|---|---|
| Date | Parse node → `processed_at` |
| Type | `Order charge` |
| Amount | negative of trigger `Order total` |
| Order | trigger Row ID |
| Member | trigger Member |
| Notes | `Website order ` + trigger Order number |
| Email | trigger Email |
| Transaction reference | trigger Order number |
| Included in credit | `true` |

Leave Xero Contact ID and every other Xero-only field blank.

For Amount, use advanced formula mode to multiply the Order total by `-1`, or inject a negative total from an additional Execute code return property.

## 7. Mark the order Confirmed

Add **Update a row** for `Web Orders`.

- Row ID: trigger Row ID
- Status: `Confirmed`
- Confirmed at: Parse node → `processed_at`
- Processing error: blank

This action must happen only after all stock rows and the account transaction succeed.

## 8. Send the HTML confirmation email

Add **Send email** after the Confirmed update.

- To: trigger Email
- Subject: Parse node → `email_subject`
- HTML body: Parse node → `email_html`
- From name: `Rooted Commons`
- Reply-to: your normal Rooted Commons address

Use a configured SMTP integration. Test delivery to your own address and check mobile and desktop rendering.

## 9. Record email success

Add a final **Update a row** action:

- Row ID: trigger Row ID
- Confirmation email sent: `true`
- Confirmation email sent at: Parse node → `processed_at`

If SMTP fails, the workflow stops before this action. The order remains Confirmed, while the unchecked field makes the failed email easy to find and resend manually.

## 10. Test and publish

1. Start a full test run.
2. Create a fresh Processing test order.
3. Inspect every node result in History.
4. Confirm stock fell by the ordered quantities.
5. Confirm one negative Account Transaction exists.
6. Confirm the order is Confirmed.
7. Confirm the email arrived.
8. Delete or reverse the test ledger rows manually.
9. Publish the workflow.

Draft workflows do not react to real rows. The workflow must be tested and explicitly published before the live website is used.

## Monitoring views

Create these Web Orders views:

- `Processing` — Status is Processing
- `Processing over 15 minutes` — Status is Processing and Submitted at is older than 15 minutes
- `Confirmed, email unsent` — Status is Confirmed and Confirmation email sent is unchecked
- `Ledger errors` — Status is Ledger error

A failed action leaves the order at Processing and is recorded in Automation History. Review the stale Processing view before each packing run.

## Manual correction

There are no automatic replacements or releases.

For a cancellation or amendment:

1. edit the Web Order status manually;
2. create compensating Stock Movement rows as required;
3. create a positive refund/adjustment Account Transaction as required;
4. email the member manually.

Never edit an old stock quantity merely to hide the audit trail; use a compensating signed movement.
