# Stats sections

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
