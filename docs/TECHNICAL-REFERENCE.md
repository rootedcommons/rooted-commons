# Technical reference

Developer/reference material for the current v2.9.15 release.

## Architecture

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

- batch-creates stock ledger rows from the authoritative `Stock Movement JSON` payload;
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

## Testing

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

## Formatted text

Long-text fields rendered through the shared `FormattedText` component support a small, safe set of formatting rules.

## Paragraphs

Leave a blank line between paragraphs.

```text
First paragraph.

Second paragraph.
```

## Line breaks

Use a single newline to keep text within the same paragraph but display it on a new line.

## Links

Use Markdown-style link syntax:

```text
Still have questions? [Browse our FAQs →](/faqs/)
```

Allowed link destinations are internal paths beginning with `/`, page anchors beginning with `#`, `http://`, `https://`, `mailto:` and `tel:` links. Other protocols are blocked.

## Bullet lists

Write each list item on its own line beginning with `-`, `*` or `•`:

```text
- One weekly order
- One collection bag
- Multiple local producers
```

A list should be separated from surrounding paragraphs by a blank line.

## Card image galleries

Grouped **Cards** sections support up to three images per card. The feature is optional and does not change cards that use only one image.

## Baserow fields

Use the existing `Image` field for the first image. The additional optional fields are:

- `Image 2`
- `Image 2 alt text`
- `Image 3`
- `Image 3 alt text`

The existing `Image caption` is shown once beneath the whole gallery.

## Behaviour

- **One image:** the existing static card image is shown.
- **Two or three images:** the image area becomes a horizontal mini-gallery.
- On phones and touch devices, visitors swipe between images.
- On desktop, visitors can scroll or use the previous/next arrows.
- Dots beneath the image indicate the current position.
- The gallery never advances automatically.

## Recommended network-card settings

For producer and retailer cards, a good starting point is:

- Section type: `Cards`
- Columns: `3`
- Alignment: `Left`
- Background style: `Default`
- Space above: `Medium`
- Space below: `Large`
- Image size: `Medium`
- Image fit: `Cover`

Use the images to show different aspects of the same producer: for example, the people, the place and the produce. One strong photograph is preferable to filling every image field with weaker photographs.

## Accessibility

Add concise alt text for every meaningful image. Describe what is visible rather than repeating the producer name alone. For example: `Two growers harvesting salad leaves inside a polytunnel`.

## Stats sections

`Stats` is a groupable Sections-table type for compact number/label tiles. It reuses existing fields; no new Baserow columns are required.

## Baserow setup

Add `Stats` to the **Section type** single-select options alongside:

- Text
- Image and text
- Banner
- Cards
- Grid
- Call to action
- Gallery
- Stats

For each stat row use:

- **Section type**: `Stats`
- **Group key**: the same value for every tile in the group, for example `impact-stats`
- **Heading**: the large value, for example `£12,500` or `24`
- **Subheading**: the short label, for example `spent with local producers`
- **Alignment**: Left / Centre / Right
- **Columns**: normally set on the first row in the group; use 2–4
- **Order**: controls the tile order
- **Space above / Space below / Background style / Heading size**: the first row controls the grouped section, just as with Cards and Gallery

Rows sharing both `Section type = Stats` and the same **Group key** render as one responsive tile row. On screens up to 640px wide the grid becomes two columns.

The group heading is derived in the same way as existing grouped Cards/Gallery sections: use the first row's **Eyebrow** to set an explicit group title, or let the Group key provide the fallback label.

## Dynamic values

The Heading field can contain these build-time tokens:

- `{{members}}` — number of active rows in Members.
- `{{network_partners}}` — number of visible `Cards` rows on the `our-partners` page.
- `{{member_spending}}` — `Site Settings → Historic total member spending` plus the absolute sum of `Account Transactions → Amount` where Type is `Order charge`.

Example headings: `{{members}}`, `{{network_partners}}`, `£{{member_spending}}`.

The build-time Baserow token must be able to read the public CMS tables as before. `BASEROW_RUNTIME_TOKEN` additionally needs Read access to Members and Account Transactions so the site can calculate the aggregate values. Individual private rows are not rendered into the site.

## Homepage grouped headings, stats and campaign countdown

Grouped Cards, Stats and Gallery sections use `Group key` only as an internal grouping identifier. `Group heading` is the optional visible heading; leave it blank for no group heading.

Public Stats headings support `{{members}}`, `{{network_partners}}`, `{{member_spending}}` and `{{total_commitments}}`. `{{total_commitments}}` is the sum of `Weekly commitment` for active Members.

A `Campaign` section is intended for launch/member campaigns. It uses a single text column, then renders up to three images (`Image`, `Image 2`, `Image 3`) in one responsive row where space allows, followed by optional countdown timing and the CTA button. Add `Campaign` to the **Section type** single-select options in Baserow.

Countdown fields are `Countdown date` (date), `Pre-countdown text` (single-line text) and `Post-countdown text` (single-line text). For example, pre-text `First online market: Thursday 3rd – Wednesday 9th September`, date `2026-09-03`, and post-text `to go` renders the market line followed by `28 days to go`. The day count updates in the visitor's browser and disappears after the target date. Existing Call to action sections can use the same countdown fields.

