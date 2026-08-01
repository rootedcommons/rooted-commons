# Collection slots

Rooted Commons has one weekly order deadline: **Wednesday at 6pm**. Deliveries to collection points are made on Thursday. Individual collection points can then offer later customer collection windows.

## Baserow setup

### Collection Points
Add or use these text fields:
- `Thursday collection time` — e.g. `5–7pm`
- `Friday collection time` — leave blank if unavailable
- `Saturday collection time` — leave blank if unavailable
- `Sunday collection time` — leave blank if unavailable

The old `Collection time` field is still accepted as a fallback for Thursday during migration.

### Products
Add `Late collection` as a single select with exactly:
- `Thursday only`
- `Friday okay`
- `Weekend okay`

The code defaults to **Thursday only** if the field is blank or missing. This is deliberately conservative. Cupboard staples and refills can normally be set to `Weekend okay`; fresh or short-lived products should use the appropriate earlier limit.

### Members
Add `Preferred collection day` as a single select: `Thursday`, `Friday`, `Saturday`, `Sunday`. The dashboard and Orders member bar use this as the member's default preference. Checkout still validates the basket and only offers suitable slots.

### Web Orders
Add:
- `Fulfilment date` (Date)
- `Collection date` (Date)
- `Collection day` (Single line text)
- `Collection time` (Single line text)

These are immutable order snapshots.

## Rollover notice
From Wednesday 6pm until Monday, the Orders page displays a highlighted message explaining that this week's collection has closed and that the new order is for collection from the following Thursday. Dates are calculated dynamically.
