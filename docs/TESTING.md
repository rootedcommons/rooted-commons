# Release testing

- Build succeeds with Node 22.
- Public pages render with fallback data when Baserow is unavailable.
- Zero-stock products cannot be added.
- Products with 1-5 units show a low-stock warning and cannot exceed stock.
- Confirm Order disables while processing.
- Retrying the same client request ID returns the same order.
- Replacing an order releases the previous allocation before validating the replacement.
- Failed replacements leave the original order active.
- Stock movement totals reconcile to Available stock.
- A manually entered Xero Receive Money transaction imports within 15 minutes.
- Re-running the sync does not duplicate it.
- An unmatched payment does not affect member credit.
- `18:00` renders as `6:00pm` without timezone conversion.
