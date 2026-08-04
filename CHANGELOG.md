# Changelog

## 2.9.1 — 2026-08-04

- Reworked signup into clearer personal, collection, commitment and communications sections.
- Moved phone help, collection help and map link onto their relevant label/section lines.
- Added Weekly/Monthly contribution frequency with penny increments; monthly minimum is £43.34, equivalent to £10/week.
- Signup writes Contribution frequency, Weekly commitment and Monthly equivalent while retaining Weekly commitment as the canonical weekly-equivalent value.
- Added collection-point images to OpenStreetMap marker popups at full popup width with proportional height.
- Updated editable Signup Interface Content and Baserow field specifications.

# 2.9.0 — 2026-08-04

- Reworked `/signup/` around preferred collection day first, followed by collection points filtered to locations available on that day and labelled with the relevant collection time.
- Added the agreed Friday/weekend late-collection explanation and a link to `/collection-points/`.
- Made phone required with operational-use help text.
- Enforced a minimum weekly commitment of £10 in whole-pound values in both browser and server validation.
- Reworked Keeping in touch around the Friday secure-link service email and a separate optional `Weekly newsletter` consent.
- Added Cloudflare Turnstile verification and basic per-worker signup rate limiting.
- Added an OpenStreetMap/Leaflet map to the Baserow-managed `/collection-points/` page using Collection Points latitude/longitude and day-specific opening times.
- Added a working-draft `/membership-terms/` page and linked it from signup and the footer.
- Updated the privacy notice for phone, collection-day, newsletter-preference and Turnstile processing.
- Added v2.9 Baserow/environment setup documentation.

# 2.8.2 — 2026-08-04

- Reused the dashboard collection-point presentation for the checkout collection summary, including image, preferred slot, address and order deadline.
- Made the saved member collection point the authenticated checkout default.
- Forced the “Not a member yet?” card to hide after member verification.
- Removed the “Paying for this order” explainer from the authenticated member checkout path.

## 2.8.1

- Fixed dashboard secure-payment button so it is only shown for a negative member balance.
- Restored the Founder badge to its larger presentation and centred it above membership details.
- Fixed checkout product amounts by passing product size into the checkout data model.
- Moved collection-point information to the top of checkout beside the basket on wider screens.
- Checkout now shows the existing collection choice first and reveals the full chooser only when Change collection point is selected.

# Changelog

## 2.8.0 — Signup and product information
- Added `/signup/` with editable Interface Content and secure Baserow member creation.
- Made catalogue search, filter and sort controls stack vertically on narrow screens.
- Reworked product detail popup around legally useful product information, with nutrition in a separate right-hand column.
- Added `May contain` and `FBO / importer` product fields; allergen terms are bolded within Ingredients.
- Checkout basket now uses `Product name – amount`.
- Founder badge now sits at the top of the membership card rather than occupying its own column.
- Secure payment/top-up button is hidden when member credit is positive.

## 2.7.6 - Dashboard hierarchy and collection controls

- Simplified the dashboard opening card to start with the member greeting and Member Credit; removed the redundant weekly-market eyebrow and “Orders are open” status.
- Moved the secure top-up prompt/link directly below Member Credit and removed duplicate “Current credit / No extra top-up needed” messaging.
- Swapped the membership and collection-point card positions so membership sits beside the greeting and collection details sit in the lower detail grid.
- Added the collection-point image to the dashboard card and made Change collection preferences a primary purple action.
- Moved member impact into the membership card with larger weeks-supported and amount-redirected figures; removed the smaller Redirected locally metric from Weekly Commitment.
- Added a clearer diagnostic when collection preferences cannot be saved because the Baserow runtime token lacks Update permission on Members.


## 2.7.5

- Added live Stats tokens for total active members, total visible network partner cards, and total member spending.
- Stats headings can use `{{members}}`, `{{network_partners}}`, and `{{member_spending}}`.
- Added `Historic total member spending` to Site Settings; member spending combines this baseline with the absolute sum of Account Transactions of type `Order charge`.
- Aggregate stats are calculated at build time; private member and transaction rows are not exposed to the browser.

## 2.7.4 — Grouped Stats sections

- Added `Stats` as a Sections-table renderer type without adding any new columns.
- Stats rows sharing a Group key now collapse into a single responsive tile grid, using Heading as the number/value and Subheading as the label.
- Added quiet divider-based Stats styling using the existing site colour tokens, with a two-column mobile layout.
- Updated the Sections Baserow specification and added `docs/STATS_SECTIONS.md`.

## 2.7.3 — Xero granular OAuth scopes

- Updated the Xero OAuth authorisation request for apps created after March 2026 to use Xero's granular Accounting API scopes.
- Replaced deprecated `accounting.transactions` with `accounting.banktransactions.read`.
- Replaced `accounting.contacts` with the least-privilege `accounting.contacts.read` scope.
- Updated the Xero OAuth setup documentation accordingly.

## 2.7.2 — Xero OAuth connection

- Added `/api/xero/connect` and `/api/xero/callback` for Xero's standard OAuth 2.0 authorization-code flow.
- Added signed, short-lived OAuth `state` validation.
- The callback exchanges the one-time code server-side, reads the authorised Xero connection, and stores the tenant ID plus rotating refresh token in the private Xero Sync State table.
- Added `Tenant name` and private `Refresh token` fields to the Xero Sync State schema/import.
- Added `BASEROW_XERO_SYNC_STATE_TABLE_ID` to the runtime Baserow configuration.
- Added `docs/XERO_OAUTH_SETUP.md` and updated the Xero sync documentation.


## 2.7.1 — 2026-08-01

- Removed the Web Orders fulfilment-date snapshot; Thursday delivery remains an operational constant.
- Standardised collection windows on 24-hour dotted notation such as `9.00-16.00` and `10.00-16.30`; day names are now added by the interface rather than stored in time fields.
- Fixed duplicated day labels such as `Thursday · Thursday 17.00-19.00`.
- Replaced the horizontal product subcategory tabs with a `Filter` dropdown beside `Sort by`.
- Added product amount/weight immediately after product names in the basket and checkout summaries.
- Kept member preferred collection day as a preference while checkout validates the basket against Thursday/Friday/weekend suitability.

## 2.7.0 — Shared layout and flexible collection slots

- Standardised the site-wide content maximum to the Orders catalogue width and aligned hero, sections, category navigation, member summary and product grid through shared inner wrappers.
- Added `Hero button size` and centred the hero CTA within its text column.
- Added optional images to Call to Action sections using the existing image fields and responsive left/right layouts.
- Moved product weight/size onto its own line below the title and tightened the certification-to-price spacing.
- Expanded the Orders member bar with available credit, collection point/day/time and the fixed Wednesday 6pm order deadline.
- Added collection-point day/time slots for Thursday through Sunday and a member preferred collection day.
- Added product-level `Late collection` rules: Thursday only, Friday okay, or Weekend okay. Checkout only offers collection slots compatible with every item in the basket.
- Web Orders now snapshot fulfilment date, selected collection date, day and time.
- Added a prominent rollover notice from Wednesday 6pm through Sunday clarifying that new orders are for collection from the following Thursday.

## 2.6.6 — Product card layout refinement

- Combined `Origin` and `Secondary origin` into one sentence on product cards, separated by a comma and ending with a full stop.
- Moved product weight/size to the top-right of the product name and increased its visual prominence slightly.
- Moved the price to the bottom-left of the card, aligned on the same row as the quantity control.
- Kept certification logos above the purchasing row.

## 2.6.5 — Optional card image galleries

- Added optional `Image 2` and `Image 3` fields for grouped content cards.
- Cards with two or three images now become swipeable, scroll-snap mini-galleries with desktop arrows and position dots.
- Cards with one image retain the existing static image layout.
- Added separate alt-text fields for the second and third images.
- Updated the complete Baserow imports and table specification files.

## 2.6.4 — Editable links and lists

- Added safe Markdown-style links in formatted Baserow text using `[link text](/path/)`.
- Added simple bullet-list rendering for lines beginning with `-`, `*` or `•`.
- Product cards now display the `Origin` field exactly as entered, followed by `Secondary origin`, with no generated “Grown in” fallback.

## 2.6.3 — Editable FAQ accordion

- Added an accessible FAQ accordion for the `/faqs/` page.
- Opening one question automatically closes any other open question.
- Added ten editable question-and-answer pairs to the Interface Content import.
- Added the FAQs page to the Pages import and fallback content.
- Kept FAQ structure and behaviour in code while all wording remains editable in Baserow.

## 2.6.2 — Responsive hero controls and clearer cards

- Replaced fixed hero image heights with responsive Landscape, Square, Portrait and Natural image shapes.
- Added Compact, Normal and Wide responsive hero gaps.
- Added nine-position hero image focal alignment.
- Renamed image-fit choices to Fill frame and Show whole image while retaining legacy value support.
- Expanded title, subtitle and intro sizing to five responsive choices.
- Made Wide heroes align exactly with the standard Section width.
- Added visible highlighted containers to grouped content cards.
- Added a guide explaining how Baserow select labels are translated into CSS.

## 2.6.1 — Natural paragraph breaks

- Added a shared safe text formatter for CMS long-text fields.
- A blank line in Baserow now starts a new paragraph.
- A single newline now creates a visible line break.
- Applied the formatter to page introductions, section bodies, interface explanatory copy, product information, and header/footer long text.

## 2.6.0 — Interface content

- Added a dedicated Baserow **Interface Content** table for editable basket, checkout and dashboard wording.
- Kept application layout and behaviour in code while allowing text to be edited by stable keys.
- Removed migrated basket and checkout copy fields from Site Settings.
- Removed reserved checkout content rows from Sections.
- Recreated the complete `baserow-imports` folder as the current import source and added table 13.
- Removed release-note files and retained this changelog as the release history.


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
