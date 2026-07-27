# Release testing

## Before publishing the Baserow workflow

1. Create a test member with a valid Order token.
2. Confirm Products have numeric Member price and rollup Available stock.
3. Confirm exact select options exist.
4. Create a workflow test Web Order with a small basket.
5. Verify generated Stock Movement and Account Transaction rows.
6. Verify the order becomes Confirmed.
7. Verify the email renders and sends.

## Website tests

- `/orders/` loads current price and availability without a redeploy.
- Zero stock greys out the card.
- Stock 1–5 shows `Low stock — X left`.
- Basket quantity cannot exceed displayed stock.
- Confirm Order disables while submitting.
- Edited browser price data is ignored by the server.
- A repeated request with the same Client request ID returns the existing order.
- A second different order in the same ordering week is rejected.
- A successful submission creates only one Web Orders row initially.
- Baserow automation later creates one Stock Movement per basket item and one Account Transaction.

## Failure checks

- Pause the automation and submit a test order: it should remain Processing.
- Resume and manually test the workflow against that row.
- Break an SMTP setting: the order should remain Confirmed while `Confirmation email sent` remains false.
- Confirm the workflow History identifies the failing node.
