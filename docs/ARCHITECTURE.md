# Architecture

## Responsibilities

### Astro/browser

- renders the public website;
- loads current product price and availability through `/api/products`;
- stores the unconfirmed basket in local storage;
- sends product IDs and quantities only.

### Restricted order endpoint

- validates the opaque member token;
- loads current Products and Collection Points from Baserow;
- checks `Available stock` and `Member price`;
- rejects a second order for the same member and ordering week;
- creates one Web Orders row with `Status = Processing`;
- returns immediately.

### Baserow automation

- parses the authoritative `Item JSON` snapshot;
- batch-creates Stock Movement rows;
- creates the Account Transaction;
- marks the order Confirmed;
- builds and sends the HTML email.

### Xero

- is the source for manual Receive Money transactions;
- is polled by Baserow every 15 minutes;
- updates the Account Transactions ledger by immutable Xero ID.

## No automatic replacement

Once a member has a Processing or Confirmed order for the current ordering week, the endpoint rejects another order. Administrators handle amendments, cancellation, stock correction and refunds manually.

## Concurrency

Basket contents do not reserve stock. The endpoint rechecks stock immediately before creating a Web Order. A narrow race remains if two members confirm the last units before either Baserow automation writes its Stock Movements. This is accepted as proportionate for the present scale. Monitor for negative `Available stock` and resolve any exceptional oversell manually.
