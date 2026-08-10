# Baserow setup

This is the canonical Baserow setup reference for v2.9.15. Field names used by the API and automations are case-sensitive.

## Schema

Field names are case-sensitive in API and automation mappings. Use these exact names unless you also update the code.

## Products

Required by runtime ordering:

- `Product` — primary text field
- `Code` — text
- `Member price` — number/currency, 2 decimals
- `Available stock` — rollup of linked Stock Movement `Quantity change`
- `Available` — boolean
- `Category` — link/multiple select as currently configured
- `Available collection points` — optional link to Collection Points
- `Low stock threshold` — optional number; defaults to 5
- `Late collection` — single select: `Thursday only`, `Friday okay`, `Weekend okay`; blank/missing defaults to Thursday only

`Available stock` is the sole stock source used by the order endpoint.

## Members

Required:

- `First name`
- `Email`
- `Active`
- `Access link requested at` — optional date/time audit field written when a member asks for their current weekly access link to be resent
- `Current credit`
- `Weekly commitment`
- `Collection point`
- `Preferred collection day` — single select: Thursday / Friday / Saturday / Sunday
- `Member number` — primary Formula field: `concat('RC-', row_id())`; this is also the BACS/Xero payment reference
- `Mollie payment URL` — optional hosted payment URL shown only when the member is below zero
- `Phone` — required by signup for membership/order issues
- `Membership consent` — boolean; must be true at signup
- `Weekly newsletter` — optional boolean consent for including news/updates in the weekly service email
- `Monthly equivalent` — number/currency, 2 decimals
- `Contribution frequency` — single select: Weekly / Monthly
- `Product requests` — optional long text written from the signup Requests section
- `Email verified` — boolean; false on signup and set true from the emailed confirmation link
- `Email verified at` — date/time set when the confirmation link is opened

## Site Settings payment fields

Add:

- `Bank account name`
- `Bank sort code`
- `Bank account number`

These are shown to authenticated members in the dashboard and used in the confirmation-email template.

## Collection Points

Required:

- `Name`
- `Active`
- `Available to collect here`
- `Thursday collection time`
- optional `Friday collection time`, `Saturday collection time`, `Sunday collection time`
- optional `Latitude` and `Longitude` — decimal coordinates used by the `/collection-points/` map

Collection time fields contain **times only**, using 24-hour dotted notation such as `9.00-16.00`, `10.00-16.30` or `17.00-19.00`. Do not include the weekday in the field.
- address/content fields already used by the site

The website uses a single global deadline of Wednesday 18.00.

## Web Orders

Writable by the website:

- `Order number` — text
- `Member` — link to Members
- `Order week` — text
- `Collection point` — link to Collection Points
- `Collection date` — customer collection date
- `Collection day` — selected weekday
- `Collection time` — selected time/window, stored as single-line text in 24-hour dotted notation
- `Status` — single select
- `Client request ID` — text
- `Item JSON` — long text
- `Stock Movement JSON` — long text; server-generated payload for Batch create rows
- `Order total` — number/currency, 2 decimals
- `Submitted at` — date/time
- `Confirmed at` — date/time
- `Order source` — single select
- `Email` — email/text

Recommended automation/administration fields:

- `Processing error` — long text
- `Confirmation email sent` — boolean
- `Confirmation email sent at` — date/time

Exact `Status` options:

- `Processing`
- `Confirmed`
- `Rejected`
- `Cancelled`
- `Ledger error`

Exact `Order source` option:

- `Website`

Remove or ignore these old fields:

- `Replaces order`
- Order Lines links
- Order Submissions links

## Stock Movement

Required:

- `Product code` — writable link to Products
- `Product name` — lookup from Product code; do not write directly
- `Quantity change` — signed number
- `Unit price` — number/currency, 2 decimals
- `Movement type` — single select
- `Order` — link to Web Orders
- `Date` — date/time
- `Reference` — text
- `Idempotency key` — text, strongly recommended
- `Notes` — long text
- `Active` — boolean, if used by the Products rollup

Exact order movement option:

- `Order`

Other useful manual options:

- `Opening`
- `Delivery`
- `Adjustment`
- `Wastage`

There is no `Stock Movement` quantity field and no automatic `Release` movement in v2.1.

## Account Transactions

Required for website order charges:

- `Date` — date/time
- `Type` — single select
- `Amount` — signed number/currency
- `Order` — link to Web Orders
- `Member` — link to Members
- `Notes` — long text
- `Email` — email/text
- `Transaction reference` — text
- `Included in credit` — boolean

Exact website type option:

- `Order charge`

`Amount` is negative for an order charge. There is no `Direction` field. Xero payment imports now identify members by the `RC-x` reference rather than personal Xero contacts.

## Removed tables

V2.1 does not use:

- Order Submissions
- Order Lines


## Interface Content (build-time CMS)

Set `BASEROW_INTERFACE_CONTENT_TABLE_ID` to a table containing `Key`, `Area`, `Label` and `Content`. The site reads `Key` and `Content`; the other fields are editorial aids. Missing rows use code fallbacks.

## Order automation

This workflow processes each `Web Orders` row created by the website. It does not require Execute code.

## Prerequisites

Create the exact fields and select options in `BASEROW_SCHEMA.md`.

The website writes two server-generated JSON fields:

- `Item JSON`: readable order snapshot.
- `Stock Movement JSON`: rows already shaped for Baserow's Batch create rows action.

Prices, quantities and totals in both fields are generated server-side from current Baserow product data. Browser-supplied prices are ignored.

## Workflow outline

```text
Rows are created in Web Orders
→ Router: Status = Processing AND Order source = Website
→ Batch create Stock Movement rows
→ Create Account Transaction
→ Update Web Order to Confirmed
```

Use a separate workflow for email so an SMTP failure cannot interfere with stock or member-credit processing.

## 1. Trigger

Create an automation and choose **Rows are created**:

- Table: `Web Orders`
- Label: `New Web Order`

Test it with a genuine website order.

## 2. Router

Create a branch named `Processing website order`.

In basic mode use:

```text
Status → value equals Processing
AND
Order source → value equals Website
```

For single-select fields choose their `value`, not `[All]`.

## 3. Batch create Stock Movement rows

Add **Batch create rows** and select `Stock Movement`.

Set Rows to this formula, inserting the field token from the Data panel:

```text
from_json([New Web Order → Stock Movement JSON])
```

The JSON already uses the destination field names and contains rows like:

```json
[
  {
    "Product code": [123],
    "Quantity change": -2,
    "Unit price": 2.5,
    "Movement type": "Order",
    "Order": ["RC-202631-123456"],
    "Date": "2026-07-28T09:00:00Z",
    "Idempotency key": "order-RC-202631-123456-product-123",
    "Active": true
  }
]
```

Do not map fields individually in the batch node. Test it and confirm one Stock Movement is created per item.

`Product name` is a lookup from `Product code`; it must not be written directly.

## 4. Create Account Transaction

Add **Create a row** for `Account Transactions` after the batch action.

Map:

| Field | Value |
|---|---|
| Date | `now()` |
| Type | `Order charge` |
| Amount | `0 - [New Web Order → Order total]` |
| Order | `New Web Order → Order number` |
| Member | `New Web Order → Member → [0] → id` |
| Included in credit | `true` |

Leave `Xero Contact ID`, Xero transaction fields, Notes and other optional fields blank unless you need them.

For linked fields that hold exactly one row, use `[0]` to select the first linked record. `[All]` returns the whole array and is not appropriate where the action expects one linked row identifier.

## 5. Mark the Web Order Confirmed

Add **Update a row** for `Web Orders`:

- Row: triggering `New Web Order` row ID
- Status: `Confirmed`
- Confirmed at: `now()`

Run this only after Batch create and Account Transaction succeed. If either fails, the order remains `Processing` and is visible for investigation.

## 6. Email workflow

Create a second automation triggered when a Web Order is updated.

Conditions:

```text
Status = Confirmed
AND
Confirmation email sent = false
```

Send an HTML email using the existing fields, for example:

- Member name
- Order number
- Order summary
- Order total
- Collection point

After successful sending, update:

- `Confirmation email sent` = true
- `Confirmation email sent at` = `now()`

Keeping email separate means an SMTP failure does not invalidate a confirmed order.

## Credits

The core workflow uses a fixed number of action credits per order:

- Batch create Stock Movement rows: 1 action
- Create Account Transaction: 1 action
- Update Web Order: 1 action

This remains approximately three action credits regardless of the number of products in the basket. Email actions consume additional credits.

## Monitoring views

Create these Web Orders views:

- `Processing` — Status is Processing
- `Processing over 15 minutes` — stale Processing rows
- `Confirmed, email unsent` — Confirmed and email-sent checkbox is false
- `Ledger errors` — Status is Ledger error, if used manually

## Manual changes and cancellations

There are no automatic replacements, releases or reversals.

For a change or refund:

1. amend the order manually;
2. add compensating signed Stock Movement rows;
3. add a compensating Account Transaction where needed;
4. contact the member manually.

## CMS style options

The site uses plain-language Baserow select options. The loader normalises those labels into CSS classes or CSS values, so editors do not need to know CSS terminology. Select labels are case-insensitive.

## Upgrade changes for the Pages table

Make these minimal schema changes in Baserow before using the new controls:

1. Delete **Hero image height**.
2. Add **Hero image shape** as a single-select field with: Landscape, Square, Portrait, Natural.
3. Add **Hero gap** as a single-select field with: Compact, Normal, Wide.
4. Replace the **Hero image fit** options with: Fill frame, Show whole image. Legacy Cover and Contain values are still understood by the code during transition.
5. Expand **Hero image alignment** to the nine positions listed below.
6. Expand **Title size**, **Subtitle size** and **Intro size** to: Very small, Small, Medium, Large, Very large.
7. Set **Hero width** options to: Narrow, Standard, Wide, Full. Legacy Normal and Medium are treated as Standard.
8. Add **Hero button size** as a single-select field with: Small, Medium, Large.

The current `baserow-imports/02-pages.csv` and `baserow-table-specification/02-pages-fields.csv` reflect this schema.

## Pages: hero controls

### Hero layout

| Baserow option | CSS/layout result |
|---|---|
| Text left | Text and image use two responsive columns; image sits on the right |
| Text right | Text and image use two responsive columns; image sits on the left |
| Text only | No image column |
| Banner | Image fills the hero background with text over it |
| None | Hero is hidden |

### Hero width

| Baserow option | CSS result |
|---|---|
| Narrow | `max-width: 760px` |
| Standard | `max-width: 1040px` |
| Wide | `max-width: var(--max)`; exactly matches the shared 1400px site content width |
| Full | Full available width with no maximum |

Legacy `Normal` and `Medium` values are treated as `Standard`. The shared site maximum is now `1400px`, matching the Orders product grid. Hero, Sections, navigation wrappers and the member summary use the same inner-wrapper alignment.

### Hero button size

| Baserow option | Result |
|---|---|
| Small | Compact hero CTA |
| Medium | Standard hero CTA |
| Large | Larger, more prominent hero CTA |

The hero button is centred within the text column while the text itself keeps the selected hero text alignment.

### Hero gap

| Baserow option | Responsive CSS gap |
|---|---|
| Compact | `clamp(1.25rem, 2.5vw, 2.5rem)` |
| Normal | `clamp(1.75rem, 4vw, 4rem)` |
| Wide | `clamp(2.5rem, 6vw, 6rem)` |

When the hero stacks on screens below 900px, all three choices use a consistent 2rem vertical gap. This prevents a desktop spacing choice from creating an excessive space between stacked mobile content.

### Hero image shape

| Baserow option | CSS result |
|---|---|
| Landscape | `aspect-ratio: 4 / 3` |
| Square | `aspect-ratio: 1 / 1` |
| Portrait | `aspect-ratio: 4 / 5` |
| Natural | Uses the uploaded image's natural ratio |

These are responsive ratios, not fixed heights. The image frame grows and shrinks with its column on laptops and phones.

### Hero image fit

| Baserow option | CSS value | Meaning |
|---|---|---|
| Fill frame | `object-fit: cover` | Fills the frame; may crop the image |
| Show whole image | `object-fit: contain` | Shows the complete image; may leave empty space |

Legacy `Cover` and `Contain` values remain supported.

### Hero image alignment

| Baserow option | CSS `object-position` |
|---|---|
| Top left | `left top` |
| Top centre | `center top` |
| Top right | `right top` |
| Centre left | `left center` |
| Centre | `center center` |
| Centre right | `right center` |
| Bottom left | `left bottom` |
| Bottom centre | `center bottom` |
| Bottom right | `right bottom` |

Alignment controls which part of a photograph stays visible when **Fill frame** crops it. It does not control which side of the hero the image occupies; that is controlled by **Hero layout**.

### Title, subtitle and intro sizes

The shared labels are:

- Very small
- Small
- Medium
- Large
- Very large

The code applies a responsive `clamp()` scale appropriate to the element. A Large page title is therefore much larger than a Large introductory paragraph. Large title sizing is deliberately between the previous Medium and Large settings; Very large preserves the previous largest title scale.

## Cards

Every grouped Cards section now displays each `.content-card` as a visible highlighted container using:

- the site Highlight colour as its background;
- a one-pixel Line colour border;
- responsive internal padding;
- a subtle rounded corner;
- equal card height within each row.

No additional Baserow field is needed. Keep the overall section background on **Default** when you want the individual highlighted cards to remain distinct.

## Secure Member Sessions (v2.9.29+)

Create a table named **Member Sessions** before enabling the secure-session release. Use these fields exactly:

| Field | Type | Notes |
| --- | --- | --- |
| Name | Single line text / primary | Human-readable label |
| Member | Link to table → Members | One member |
| Session ID | Single line text | Non-secret random identifier |
| Created at | Date/time | Session creation time |
| Expires at | Date/time | Weekly access: next Wednesday 18:05; device session: 90 days |
| Revoked at | Date/time | Blank unless deliberately revoked |
| Last used at | Date/time | Optional audit field; currently not written on every request |
| Purpose | Single select | `Weekly access` or `Device session` |
| Active | Checkbox | Enabled for usable sessions |

Do **not** add a plaintext access-token field. The `Session ID` is deliberately not sufficient to sign in: Cloudflare signs it with `AUTH_SESSION_SECRET`, which never enters Baserow.

After the table exists, add its table ID to Cloudflare as `BASEROW_MEMBER_SESSIONS_TABLE_ID`. Add `AUTH_SESSION_SECRET` as encrypted Cloudflare secrets.



### Theme colours

The default Rooted Commons palette uses taupe `#ded8cc` for the page backdrop, warm ivory `#faf8f1` for content surfaces, plum `#5a2d4d` for primary text/buttons, pale sage `#f5f6ed` for highlights, sage `#d9dec5` for borders, and botanical green `#71856a` for decorative accents. Campaign and Call to action sections can use an optional `Watermark image` plus `Watermark opacity`, and Site Settings can provide an optional `Eyebrow icon`.

Site Settings separates the page backdrop from content surfaces: `Background colour` controls the overall page backdrop, `Surface colour` controls normal cards/forms/boxed sections, `Highlight colour` controls emphasized/inset panels, `Primary colour` controls main text and buttons, `Border colour` controls lines/borders, and `Accent colour` controls secondary botanical/decorative details.

`Watermark image` and `Watermark opacity` belong to Sections and are rendered only by `Campaign` and `Call to action` section types. Other section types ignore them. `Watermark opacity` is a percentage from 0 to 100 and defaults to 8 when blank. `Pre-countdown label` provides the small label above `Pre-countdown text` (for example `First online market:`). `Eyebrow icon` belongs to Site Settings and is used beside Campaign and Call to action eyebrows.


## Network and impact tables (v2.9.38+)

Create a **Network Partners** table using `baserow-table-specification/15-network-partners-fields.csv`, then add its table ID to Cloudflare as `BASEROW_NETWORK_PARTNERS_TABLE_ID`. The public website token needs read access to this table.

Create a **Metrics** table using `baserow-table-specification/16-metrics-fields.csv`, then add its table ID to Cloudflare as `BASEROW_METRICS_TABLE_ID`. The public website token needs read access to this table. `Value` is a Single line text field so it can hold either a literal value or a build-time `{{...}}` calculation token. Use `Display value` only when you need a different public format. `TOM Theme`, `TOM Outcome`, `TOM Measure`, `Calc method`, and `Evidence / source` are internal impact-data metadata and are not rendered publicly.

On the Our Network page, add a Section with `Section type = Stats` and explicitly link the Metrics you want to show using **Sections → Metrics**. Add another Section with `Section type = Network` to render active Network Partners as clickable cards. A partner metric appears inside that partner's detail modal when it links the relevant Network Partner and `Placement` contains `Partner`.

The recommended page order is: introductory Text section → Stats → Network → Call to action. The final Call to action can use the existing watermark/image controls.

During migration, the old grouped Cards rows can remain visible while the new Network Partners table is populated. Once the Network section looks correct, hide the old partner Cards rows to avoid displaying the same organisations twice.


## Metrics consolidation (v2.9.39)

Use one **Metrics** table for public network-level measures shown on Home, Our Network, partner profiles, or (later) the member dashboard. Member-specific calculations such as credit, weeks supporting the network, and individual spending remain dashboard calculations and are not Metric rows.

In **Sections**, the field formerly called `Grid source` is now **Products** (link to Products). Add a separate **Metrics** link field allowing multiple linked Metric rows. A `Stats` section renders its explicitly linked Metrics in `Display order`. This keeps `Stats` as a presentation type rather than creating a separate impact-stats section type.

Metrics may use literal values or the supported build-time `{{...}}` tokens. `Placement` is a multiple select (`Home`, `Network`, `Partner`, `Dashboard`) used as metadata; a Stats section's explicit Metrics links control what it displays. Partner modal metrics additionally require `Placement = Partner` and a linked `Network Partner`.

The TOM fields are governance metadata only: `TOM Theme` (`Work`, `Economy`, `Community`, `Planet`), `TOM Outcome`, and `TOM Measure`. Leave outcome/measure blank unless there is a defensible mapping to the current external TOM taxonomy. Record methodology in `Calc method` and evidence provenance in `Evidence / source`.


### Live Stats links (v2.9.41)
Stats sections are hydrated at runtime. The public endpoint reads the current `Metrics` links and `Columns` from the Sections table with `BASEROW_RUNTIME_TOKEN`, so adding/removing linked Metrics does not require a redeploy. Grant the runtime token **Read** permission on Sections, Metrics, and Network Partners. Only a narrow Stats-section projection is returned publicly.


## Live public CMS layer (v2.9.42)

`CMS` means **Content Management System**. Baserow is the CMS for editable Rooted Commons website content. The browser never talks to Baserow directly. It requests sanitised JSON from Cloudflare Pages Functions, which hold `BASEROW_RUNTIME_TOKEN` server-side.

`/api/public-content` reads Site Settings, Pages, Sections, Interface Content and Collection Points with strict public-field allowlists. `/api/public-network` independently reads Network Partners, Metrics and the aggregate inputs needed for approved calculated tokens. A failure in one optional table is reported in the endpoint `errors` array and no longer takes unrelated public content down.

Astro still writes the last deployed Baserow content into the HTML as a fallback. On page load the live hydrators refresh existing CMS-controlled content. This preserves a fast first render and useful HTML for search engines while allowing routine Baserow edits to appear without redeploying. A new Section row or a Section type change still requires deployment because it changes the component structure.

The runtime token should have the minimum permissions actually needed. For the live public CMS layer it needs **Read** on Site Settings, Pages, Sections, Interface Content, Collection Points, Metrics and Network Partners, in addition to the narrowly scoped permissions already required by member/order functions. Never expose this token in browser JavaScript.


### Transparent product price breakdown (v2.9.43)

Products can optionally link `Source value recipient` to one `Network Partners` row and store a numeric `Source value`. When both are present, the product detail modal shows the source recipient, the calculated Commons contribution/subsidy, and the member price. `Commons contribution/subsidy` is not stored: it is always calculated as `Member price - Source value`. A zero result is hidden. The source recipient links to its Network Partner profile. Existing `Origin` and `Secondary origin` fields are unchanged.

### Inline price transparency help (v2.9.44)

The product-card price `ⓘ` opens an inline `Where your money goes` panel. Add `Price explanation` (Long text) to Network Partners for partner-specific source-value help. Price help copy is otherwise managed in Interface Content with keys `price_breakdown.source_help`, `price_breakdown.contribution_help`, `price_breakdown.subsidy_help`, `price_breakdown.member_price_help`, `price_breakdown.partner_link_label`, `price_breakdown.commons_link_label`, and `price_breakdown.commons_link_url`. These values are fetched live through the public-content/public-network APIs.

