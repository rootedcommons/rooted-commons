# Collection slots

Rooted Commons has one weekly order deadline: **Wednesday at 18.00**. Orders are delivered to collection points on Thursday, but customers may collect later where the collection point and basket allow it.

## Baserow setup

### Collection Points
Use these single-line text fields:
- `Thursday collection time` — e.g. `17.00-19.00`
- `Friday collection time` — e.g. `9.00-16.00`; blank if unavailable
- `Saturday collection time` — e.g. `10.00-16.30`; blank if unavailable
- `Sunday collection time` — blank if unavailable

Times are stored and displayed in **24-hour dotted notation**: `9.00-16.00`, `10.00-16.30`, `17.00-19.00`. Do not include the day name in these fields; the site adds it automatically. The legacy `Collection time` field is still accepted as a Thursday fallback during migration.

### Products
Use `Late collection` as a single select with exactly:
- `Thursday only`
- `Friday okay`
- `Weekend okay`

The code defaults to **Thursday only** if the field is blank or missing. Fresh produce that may be collected Friday should use `Friday okay`; it will never be offered for Saturday or Sunday collection. Cupboard staples/refills that can wait until the weekend can use `Weekend okay`.

### Members
Use `Preferred collection day` as a single select: `Thursday`, `Friday`, `Saturday`, `Sunday`. It is a preference only. Checkout validates it against the selected collection point and the most restrictive product in the basket.

### Web Orders
Use these immutable snapshot fields:
- `Collection date` — Date
- `Collection day` — Single line text
- `Collection time` — Single line text

There is no fulfilment-date field: operational delivery is always Thursday.

## Rollover notice
From Wednesday 18.00 until Monday, the Orders page displays a highlighted notice explaining that collection for the current week has closed and the order is for collection from the following Thursday.
