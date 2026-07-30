# Changelog

## 2.5.0

- Reworked product-card metadata and purchasing layout.
- Added Origin, Secondary origin, Crop info, Packaging and disposal, and nutrition support.
- Simplified the expanded product popup to one description and removed Why we stock it.
- Added a comprehensive Baserow table field specification.

# v2.4.0

- Calm, provenance-led product cards and expanded product information dialog.
- Compact redesigned member summary with collection-point editing.
- New Baserow product information fields and import CSV.

# Changelog

## 2.3.0 — 2026-07-29

- Added multi-select certification logo support for Gluten Free and Organic Food Federation.
- Added Moldova, Bulgaria and Argentina country flags.
- Shortened weekly customer order references to a collision-checked three-digit suffix.
- Added distinct Order confirmed and Order reserved checkout outcomes.
- Removed positive-balance reassurance text from checkout.
- Fixed the member information bar collection-point object display.
- Hid the join card for authenticated members and renamed the checkout heading to Your member order.
- Added a dashboard collection-point editor backed by the Baserow Members table.
- Added a complete /privacy notice.


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
