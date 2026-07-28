# Changelog

## 2.1.2

- Added `Stock Movement JSON` to Web Orders.
- The order endpoint now generates a Baserow Batch create rows payload from authoritative server-side product data.
- Stock movement dates are emitted without fractional seconds for Baserow date compatibility.
- Updated the free-tier Baserow automation guide to use Batch create rows and no Execute code.
- Updated schema and import documentation.

## 2.1.0

- Simplified order intake to create one Processing Web Order.
- Removed Order Lines, Order Submissions and automatic replacement-order processing.
