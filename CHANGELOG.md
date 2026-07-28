# Changelog

## 2.2.0

- Expanded the existing weekly-commitment card with extra top-up guidance.
- Preserved the existing standing-order increase recommendation and thresholds unchanged.
- Added BACS details and optional Mollie payment link for negative balances.
- Added recent positive payments and expandable full account activity.
- Added checkout and success-page warnings that balances must be £0.00 or above before collection.
- Added payment-reference and payment-setting schema fields.
- Added a private implementation guide for SMTP and itemised HTML confirmation emails.

## 2.1.2

- Added `Stock Movement JSON` to Web Orders.
- The order endpoint now generates a Baserow Batch create rows payload from authoritative server-side product data.
- Stock movement dates are emitted without fractional seconds for Baserow date compatibility.
- Updated the free-tier Baserow automation guide to use Batch create rows and no Execute code.
- Updated schema and import documentation.

## 2.1.0

- Simplified order intake to create one Processing Web Order.
- Removed Order Lines, Order Submissions and automatic replacement-order processing.
