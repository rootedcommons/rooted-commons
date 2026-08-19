# Changelog

## 2.9.87 — 2026-08-19

- Extracted the dashboard collection-point card into a single shared `CollectionPointCard.astro` component.
- Checkout now renders that same component instead of maintaining a copied collection card.
- Checkout keeps basket-specific availability warnings and its temporary collection selector inside the shared card's change state.
- Dashboard and checkout therefore share the same collection-point structure and base presentation going forward.

## 2.9.86 — 2026-08-19

- Simplified Network Partner activity fields again: renamed `Fresh fruit` to `Fruit`, renamed `Honey & Beeswax` to `Bees`, and removed `Cupboard staples`.
- Updated partner modal icon mappings, Baserow loaders/API, import CSVs, field specification, and network documentation to match.

## 2.9.85 — 2026-08-19

- Simplified Network Partner `What you can do here`: removed the separate `Offerings` selector entirely.
- Renamed the ten one-line offering fields to remove the ` text` suffix.
- A modal offering row now renders automatically whenever its corresponding Network Partner field contains text; blank fields render nothing.
- Icon choice is driven directly by the field name in code, so Baserow no longer needs to maintain both an offering selector and matching copy field.

## 2.9.84 — 2026-08-19

- Refined Network Partner modal layout while preserving partner Metrics.
- Added `What you can do here`, driven by Network Partners → `Offerings` plus one-line text fields for each offering.
- Added reusable inline SVG icons for partner actions/offerings and moved the campaign calendar icon into the shared Astro icon component.
- Added full-width Collection details for partners that match an active Collection Point, using the existing collection slots and `Available to collect here` data.
- Added Website, Follow and Directions icons; Directions focuses the matching location on the existing Collection Points map.
- Map return links now explicitly reopen the same partner modal.
- Moved partner-modal carousel dots into a compact overlay pill on the image.

## 2.9.83 — 2026-08-19

- Reworked member-requested closure so non-zero Member Credit must be resolved before an account can close.
- Positive Member Credit now starts with the recommended spend-down route: members can stop future regular commitment expectations, cancel the standing order at their bank, remain Active, keep receiving the weekly market email and continue ordering until their credit reaches £0.
- Added an immediate voluntary donation-and-close route for the full remaining balance, with Rooted Commons or an explicitly opted-in active Network Partner as recipient. Added `Accepts Member Credit donations` to Network Partners so only agreed recipients appear. The donation is recorded as an auditable negative Account Transactions `Adjustment` before the membership is closed and sessions are revoked.
- Removed the partner-voucher option and routine refund option from the self-service closure flow. Members can instead contact Rooted Commons to resolve remaining credit another way; statutory remedies remain preserved in the Membership Terms.
- Added `Regular commitment stopped at` so intentional spend-down is distinct from missed-payment inactivity. Lifecycle overdue/streak accrual is suppressed while it is set, and matching incoming payments do not silently restart the commitment. Saving a new commitment clears the stop marker.
- Self-service closure now refuses positive or negative unresolved balances; effectively-zero balances can close normally.

## 2.9.82 - 2026-08-19

- Added **Manage your membership** from the dashboard with editable name, email (double entry + verification before switching), phone number and weekly-email newsletter preference.
- Added member-initiated account closure with a styled confirmation dialog, session revocation, preserved Member Credit/order records and explicit Closed status.
- Changed consecutive-week progression to elapsed supported time: regular payments no longer add `+1`/`+4` directly; each full funded seven-day period adds one week for both weekly and monthly payers.
- Added `Streak credited through` to anchor elapsed-week calculation and `Streak frozen since` to represent one continuous freeze interval without double-counting overlapping pauses and overdue periods. The credit anchor is blank until the first qualifying commitment payment, so new members can order immediately while remaining at 0 weeks.
- Pauses and unresolved missed payments freeze the streak without crediting the frozen period; resumption shifts the streak anchor so skipped time is not added later.

## 2.9.81 — 2026-08-19

- Rebuilt checkout collection selection around the dashboard collection-card styling, removed the generic basket-dependency explainer, retained basket-specific point/day warnings, and made map-return selections immediately authoritative for the current checkout.
- Fixed dashboard pause editor visibility so it is collapsed by default, opens only from `Pause your membership`, closes and clears unsaved dates on Cancel, and no longer leaves an empty gap below the action buttons.
- Replaced the native browser pause-cancellation confirmation with a Rooted Commons-styled dialog; future pauses are cancelled, while active pauses are ended early.
- Preserved genuine pre-pause overdue state, excused payment dates that fall inside an approved pause, and keep the streak frozen after an early/automatic resume when a payment date was skipped until the next qualifying regular payment arrives.
- Corrected pause cadence boundaries so a payment due on the day membership resumes is not treated as having fallen inside the pause.
- Changed nullable lifecycle Date/Date-time clears from empty strings to `null` across member updates, lifecycle processing and Xero matching, preventing Baserow typed-field validation failures when changing commitments or lifecycle state.
- Removed the duplicated `Please update your standing order` heading.
- If a pending commitment change is changed back to the last payment-confirmed contribution amount before a new matching contribution arrives, the pending state is cancelled and the regular-payment card returns to normal.

## 2.9.80 — 2026-08-16

- Converted membership policy/lifecycle dates to date-only values: `Regular payment expected at`, `Regular payment overdue since`, `Membership inactive at`, `Membership closed at`, and `Data minimisation due at`. Pause start/end were already date-only.
- Overdue detection now allows the entire expected calendar day to pass; a payment expected on 7 September can first be marked overdue on 8 September.
- One-calendar-month streak protection now expires only after the matching calendar date has fully elapsed (for example 7 September → inactive from 8 October).
- Kept email idempotency fields as Date/time audit timestamps.
- Removed the redundant `Data minimisation due` boolean. `Data minimisation due at` is now the sole retention-review marker and remains blank until the 12-month review becomes due.
- Updated signup, commitment changes, Xero payment matching, pause progression, Baserow specifications/imports and operations documentation to use the date-only model.
- Calendar-date lifecycle calculations now use Europe/London for current-date decisions, avoiding time-of-day and BST/GMT boundary effects.

## 2.9.79 — 2026-08-16

- Replaced all member-level uses of the legacy `Active` boolean with the `Membership status` single-select.
- `Active` is now the only status eligible for the weekly market email; `Paused`, `Inactive`, and `Closed` are suppressed.
- Authentication and manually requested sign-in links remain available to `Active`, `Paused`, and `Inactive` members; `Closed` members are blocked.
- Member metrics/founder counts treat any membership other than `Closed` as an existing member, preserving the previous boolean semantics.
- Removed writes to the obsolete Members `Active` field from signup, Xero reactivation, and closure logic.


## 2.9.78 — Membership pauses, consecutive streaks and inactivity lifecycle

- Replaced membership-age perk progression with an explicit `Consecutive weeks` streak driven by matching regular payments: weekly payments add 1 week and monthly payments add 4.
- Added editable self-service notified pauses on the dashboard, using fields on the Members row rather than a separate pause table. Pauses freeze the streak and regular commitment for up to 8 weeks per calendar year while keeping unlocked perks and ordering available.
- Added `Active`, `Paused`, `Inactive` and `Closed` membership lifecycle states plus separate `Active`, `Frozen` and `Ended` streak states.
- Added a one-calendar-month missed-payment grace period. The streak freezes immediately; unresolved memberships become Inactive after one calendar month, receive a gentle two-calendar-month follow-up, and close after six calendar months from the first missed expected payment.
- Added a 12-month data-minimisation review flag. No automatic destructive erasure is performed because financial/legal retention and outstanding Member Credit require a case-specific review.
- Added editable dashboard Highlight copy for pause, overdue-payment and inactive states in Interface Content.
- Added `#pauses` and `#member-streaks` FAQs and linked the consecutive-weeks wording from the dashboard/welcome email.
- Scheduled weekly market emails now send only to Active members. Active-but-overdue members receive the normal weekly email with the missed-payment Highlight block; Paused, Inactive and Closed members do not receive the weekly market email.
- Added editable Site Settings HTML fields and paste-ready templates for pause confirmation, pause ending, payment overdue, inactive, still-inactive and closure emails.
- Updated the welcome email renderer to support the member badge/balance placeholders used by the latest welcome template, retained the `Let us know` pause FAQ link, added the streak FAQ link, and corrected the passwordless-login copy to reflect 90-day device sessions.
- Updated Membership Terms and Privacy Notice copy to describe pauses, streaks, grace/inactivity/closure and the retention review lifecycle.

## 2.9.77 — 2026-08-14

- Added an editable signup welcome email from Site Settings → `Welcome email HTML`, sent directly through the existing SMTP connection with safe placeholders for member, commitment, access-link and bank details; included the full editable template under `docs/email-templates/`.
- Added the passwordless-sign-in FAQ at stable anchor `/faqs/#passwords` and simplified the signup-success explanation to link to it.
- FAQ anchor links now automatically open the targeted question and scroll it into view, so `/faqs/#passwords` lands on the actual answer.
- Added lightweight Interface Content authoring guidance: `Content` should be Long text, formatted prose supports line breaks, `**bold**`, `*italic*` and Markdown links, and the existing public stat tokens are resolved before rendering.
- Added the Terms of Sale acknowledgement directly above checkout confirmation.
- Refined the product modal: Packaging/disposal now sits in the right column below How to cook and renders as one sentence; How to store and Once opened render as one continuous sentence.
- Tightened expanded FAQ answer top spacing.

## 2.9.76 — 2026-08-14

- Collection-point map selections now return to dashboard/checkout with `?collection_point=ID#collection-point`; dashboard previews the unsaved point, including its image, and reopens the editor at that card.
- Checkout uses the same targeted return pattern and reopens the collection editor with the selected point.
- Dashboard collection editor label is fixed to `and collection day`.
- `/orders/` no longer flashes the build-time product grid before live availability is applied; the catalogue is revealed only after the live availability pass finishes.
- FAQ page top and bottom spacing is balanced with simple fixed padding rather than viewport-height centring.

## 2.9.75 — 2026-08-14

- Fixed the static-build regression introduced by the How it works original-image change: empty Section `Group key` values no longer reach `normalized()` without a fallback, preventing the `Cannot read properties of undefined (reading 'trim')` build failure.

## 2.9.74 — 2026-08-14

- Fixed signup commitment validation by restoring the missing penny-precision and money helpers.
- Fixed `/api/public-network` metric rendering so Stats bars and network partner cards load again, while partner photos continue to use original uploads.
- Made How it works cards use original uploaded images rather than generated Baserow thumbnails.
- Refreshed the palette while preserving Brand Purple and Cloudy Day: Surface `#faf7f2`, Highlight `#f8f2e9`, Accent `#3f6b3d`.
- Standardised Highlight backgrounds for form fields, selectors, search/filter/sort controls, inset utility panels, CTA cards and FAQ answers; vertically centred FAQ answers.
- Standardised quantity/amount steppers across product cards, baskets, checkout, dashboard commitment and signup commitment, and removed native number spinners.
- Increased standard button rounding while retaining full-pill treatment for steppers, tags and badges.
- Replaced checkout collection-day radio cards with the dashboard-style dropdown editor, labelled `and collection day`, while preserving basket-specific conditional warnings above the change button.
- Added map-return selection flow for dashboard and checkout so choosing a point on `/collection-points/` returns to the originating editor with that point selected.

## 2.9.73 — 2026-08-14

- Added a live Baserow-controlled temporary ordering lock with a reusable closure message, overriding the normal /orders rollover notice while active and preventing checkout confirmation in both the browser and authoritative order API.
- Fixed Cards `Heading alignment` so individual card headings, including How it works, honour the CMS field.
- Reworked FAQs into one continuous accordion with thin dividers and a clearer pale-sage expanded answer state derived from the existing Accent colour.
- Made the checkout collection chooser expand inside the existing collection card; changed the checkout label to `Collection day`, placed `(see our map)` immediately after the collection-point label, retained basket-eligibility warnings, and aligned the dashboard map-link placement.
- Changed the checkout `Become a member` action to `/signup/`.
- Applied the existing Cloudy Day/page-background colour to interactive fields and inset utility panels, with nested controls returning to Surface where useful for contrast.
- Changed /our-network partner galleries to request original uploaded Baserow file URLs only, never generated thumbnails.
- Added persistent standing-order update reminders after commitment changes, cleared automatically by the Xero sync only when a matching weekly/monthly payment is received on or after the change.

## 2.9.72

- Restored the How it works card width to 1400px and increased the founder campaign maximum width to 1240px.
- Switched product-card images from cropped `card_cover` thumbnails to Baserow `large` thumbnails.
- Restyled FAQs as bordered Surface-colour boxes with Highlight-colour answer panels.
- Reworked the detailed product modal: centred Product – amount title, image in the left column, nutrition aligned to the image in the right column, conditional provenance/ingredients/may-contain/storage/cooking/FBO/packaging fields, automatic bolding of all-caps allergen terms, and trimmed nutrition decimals.
- Added optional Products fields: Once opened, How to cook, Packaging and Disposal.
- Reworked checkout collection selection to use a dashboard-style summary card plus a compact eligible-options chooser instead of a grid of collection-point cards.
- Preserved basket-wide point/day eligibility and added explicit Highlight warnings when the member’s preferred point or day is unavailable, with expandable reasons.
- Matched the checkout vertical card gap to the horizontal grid gap.

## 2.9.71 — 2026-08-12

- Pass 2 performance/scalability refactor: `/api/member` now asks Baserow only for the authenticated member’s linked Web Orders and Account Transactions and fetches only their linked Collection Point, rather than downloading whole operational tables and filtering them in Cloudflare. Filtered Baserow reads can now paginate safely for members with more than 200 historical rows.
- Added optional Metrics → `Computed value` caching for token-based public statistics. `/api/public-network` no longer reads Account Transactions unless a displayed metric actually requires `{{member_spending}}`; once `Computed value` exists, member-count/commitment metrics are resolved and stored so public Stats requests can avoid scanning Members. Signup and commitment changes refresh the member-derived cache, and Xero imports refresh transaction-derived metrics when needed.
- Moved the large Weekly Shop, Checkout, Dashboard and Signup browser programs out of inline HTML into cacheable module files under `public/scripts/`, leaving only small page-specific JSON configuration in the document.
- Replaced every product card’s hidden product-detail template and hidden price-breakdown UI with one lightweight JSON data payload per Product Grid plus lazily-created shared product and price dialogs. This removes dozens of hidden modal DOM trees from the Weekly Shop.
- Rebuilt `Where your money goes` on the shared native dialog: help text is normal-flow content directly beneath the clicked row inside the same cream modal, and partner-specific copy still loads only on first use.
- Kept product-card/search/basket behaviour and authoritative order-time stock validation unchanged while reducing HTML/DOM duplication and making the main interaction scripts browser-cacheable across visits.

## 2.9.70 — 2026-08-12

- Retired the general live public-content hydrator and `/api/public-content`; Site Settings, Pages, Sections, Interface Content, Products and Collection Points now publish only through the Astro/Cloudflare Pages build, eliminating the second Baserow read and DOM reconstruction on every page load.
- Memoised `getSiteData()` so one build shares one Baserow CMS snapshot across generated pages, and stopped static builds reading private Members / Account Transactions merely for public Metrics placeholders.
- Added a small shared browser request cache (`RootedData`) for auth status, member data, product availability, live Network data and partner price help to deduplicate same-page requests.
- Weekly Shop now renders product cards immediately while live availability is checked; quantity buttons remain disabled until current stock has been confirmed.
- Added short public caching for `/api/products` and `/api/public-network`, while authoritative stock validation on order submission remains unchanged.
- Removed the full `/api/public-network` fetch from ordinary Weekly Shop loads. Partner-specific `Price explanation` is now fetched only when that source-row help is opened, through cached `/api/partner-help`.
- Product cards now prefer Baserow `card_cover` thumbnails while the detailed product view uses the larger image variant, reducing catalogue image transfer.
- Rebuilt the `Where your money goes` CSS as one canonical modal implementation and removed all legacy price-popover/grid rules. Help text is structurally and visually part of the same centred product modal, directly beneath the clicked row, with no nested panel or positioned overlay.

## 2.9.69 — 2026-08-12

- Replaced the global header's cached full `/api/member` probe with a lightweight, no-store `/api/auth-status` endpoint and shared `rooted:auth-state` event, so header account state can recover from transient member-data failures and stays in sync with pages that successfully load member data.
- Updated Weekly Shop, Dashboard and Checkout member loads to publish definitive authentication state, and moved the Collection Point map's boolean auth check to `/api/auth-status`.
- Removed legacy nested price-help positioning/framing so price explanations now render as plain inline content immediately beneath the selected price row inside the single centred product breakdown modal.
- Tightened the mobile basket clearance and category-nav spacing while preserving the sticky basket control.

## 2.9.68 — 2026-08-12

- Added a shared Pages normaliser used by both Astro initial rendering and `/api/public-content`, removing duplicate Pages field mapping and fixing live hero-heading alignment snap-back.
- Fixed mobile header auth state so `Sign out` and `Become a member` cannot be shown together after live-content hydration.
- Price-breakdown help now expands as ordinary inline content directly beneath the tapped row inside the single centred product modal; no nested popup positioning remains.
- Reserved mobile vertical space for the sticky basket shortcut so it no longer overlaps the shop category tabs.

## 2.9.67 — 2026-08-11

- Added the product name as the title of the centred `Where your money goes` modal.
- Replaced the modal's separate explanation screen / back interaction with inline expandable help directly beneath each price-breakdown row.
- Each info control now toggles its own explanation while the modal grows naturally; existing Baserow-managed help copy and links are preserved.

## 2.9.66 — 2026-08-11

- Increased the mobile Rooted Commons header logo modestly without increasing the compact header padding.
- Moved the Weekly Shop basket shortcut out of the top-right viewport overlay and into a shop-specific sticky bar immediately below the global header, restoring unobstructed access to Sign in / Sign out and the mobile navigation toggle.
- Reduced the mobile basket pill size and shadow while retaining its live item count, total, drawer behaviour and sticky availability while browsing.

## 2.9.65 — 2026-08-11

- Replaced the anchored price-transparency popover with a true centred overlay on both desktop and mobile.
- Price breakdowns are temporarily moved to the document root while open so they render above every product card, basket control and catalogue layer regardless of card position or stacking context.
- Added a dimmed backdrop behind the open price breakdown; tapping the backdrop or pressing Escape closes it.
- Preserved the existing `Where your money goes` breakdown and internal explanation / `Back to price breakdown` interaction.

## 2.9.64 — 2026-08-11

- Added Pages → `Hero heading alignment` (Left / Centre / Right), independent of the existing Hero alignment; the Home hero heading defaults to centred until the field is populated.
- Aligned the Home hero and How it works card section to the same 1240px content grid while preserving their existing responsive padding.
- Reduced the Founder campaign frame to the same 1050px maximum width and framing language as the compact CTA sections, with tighter internal padding.
- Updated the Baserow Pages import/specification and current setup/technical documentation for the new hero heading field.

## 2.9.63 — 2026-08-11

- Reworked the mobile site header into a compact two-column layout with the Rooted Commons logo on the left and persistent account actions on the right.
- Kept the existing Sign in / Sign out text link unchanged, placed the mobile navigation toggle beside it, and placed the membership CTA directly beneath them.
- Added a true mobile hamburger menu for the main navigation links only; account and membership actions are no longer duplicated inside the expanded menu.
- Reduced mobile header padding/logo height while leaving desktop navigation and header behaviour unchanged.

## 2.9.62 — 2026-08-11

- Pinned product certification marks to the bottom content area of each product card so they sit consistently immediately above the purchase divider and price/quantity footer.
- Replaced the in-card expanding price breakdown with a floating “Where your money goes” popover that does not change product-card dimensions.
- Changed the breakdown’s internal information controls to switch the same popover into an explanation view, with a `Back to price breakdown` control; outside click, Escape and resize close the popover.
- Rounded the catalogue search field to match the product-card visual language while keeping text search catalogue-wide.
- Scoped category browsing and subcategory filter options to each product’s primary broad category, and retained the existing reset-to-All behaviour when changing category.
- Removed the unused collection-points hero from the map page, tightened the space below the site header and made the map Back control smaller and more discreet on mobile.

## 2.9.61 — 2026-08-11

- Redesigned the dashboard commitment card with a permanent purple `Change` button beside the member’s chosen commitment amount.
- Added inline Weekly/Monthly commitment editing using the existing Members fields: `Weekly commitment`, `Monthly equivalent` and `Contribution frequency`. Weekly commitments have a £10 minimum; monthly commitments have a £43.33 minimum; manual penny amounts remain valid and the `+`/`−` controls step to whole-pound values in £1 increments.
- Existing members now see regular-payment bank details only while changing a commitment (and after saving); new members with no payments still see the setup details automatically.
- Delayed `Average weekly orders` and the increase-commitment nudge until membership week 8. The nudge retains the existing spend threshold but no longer checks whether commitment is above zero.
- Updated the nudge copy to compare average weekly orders with the member’s weekly-equivalent commitment and open the same commitment editor.
- Restricted `Recent payments` to Account Transactions where `Type = Payment`, so Opening Balance and other positive ledger entries no longer appear there. Full account activity remains available separately.
- Removed the obsolete Site Settings fields `Increase commitment button text` and `Increase commitment button URL` from runtime settings, imports and the coded-field specification.

## 2.9.60 — 2026-08-11

- Added Site Settings → `Weekly orders closed email HTML` (Long text) as the live editable source for the Wednesday orders-closed email.
- Added a constrained HTML template renderer for the documented member, balance, badge, collection and order placeholders/conditional blocks; values are escaped before insertion.
- Added a simpler built-in fallback weekly email when the Baserow template is blank, missing its secure-link placeholder or cannot be rendered.
- Included both the current Baserow HTML template and an exact inspection copy of the fallback under `docs/email-templates/`.
- Changed user sign-out so the current `Device session` row is deleted from Baserow; the browser cookie is still cleared even if the Baserow deletion fails.

## 2.9.59 — 2026-08-11

- Replaced the plain Wednesday weekly-access message with the full orders-closed member email design.
- The weekly email now pulls the member name, live balance, founder/member badge, Site Settings logos and bank details, and the just-closed confirmed Web Order.
- Order collection day/time and item rows come from the immutable Web Orders snapshot (`Collection day`, `Collection time` and `Item JSON`), while the linked Collection Point supplies the saved name/address.
- Negative balances show the conditional top-up warning; members with no confirmed order in the just-closed week receive the no-collection variant.
- Preserved the existing weekly session rotation, per-member retry behaviour and `Email sent at` duplicate-send protection.

## 2.9.58 — 2026-08-11

- Added RFC-compliant `Date` and unique `Message-ID` headers to emails sent through the shared Cloudflare SMTP helper, preventing Gmail from rejecting requested and weekly access-link emails as malformed.

## 2.9.57 — 2026-08-11

- Tightened the mobile product-card buying row so the price information icon no longer collides with the `− 0 +` quantity pill on two-column phone layouts.
- Removed the automatic category-name fallback heading on Orders categories with no configured intro section.
- Removed the empty intro spacing for those categories so the search/filter toolbar sits directly beneath the category buttons.

## 2.9.56 — 2026-08-11

- Reduced the maximum desktop width of Campaign sections to 1180px so the campaign card sits more closely in line with the card grid above it. Mobile sizing is unchanged.


## v2.9.55

- Changed Campaign/CTA `Pre-countdown text` to normal body weight by default; inline `**bold**` markup can still be used selectively.

## v2.9.54

- Added Pages → `Hero split` with 70:30, 60:40, 50:50, 40:60 and 30:70 text:image options; blank remains 50:50 and split heroes still stack on smaller screens.
- Anchored the product-card divider, price and quantity control to the bottom of every card for consistent row alignment.
- Removed the hard-coded `How it works` heading from desktop/laptop while retaining a mobile-only heading inside the How it works carousel panel when no CMS group heading is supplied.
- Removed the residual card shadow/fade from the mobile How it works carousel slides.
- Folded `Post-countdown text` (for example `to go`) into the main dynamic countdown phrase so it renders as `23 days to go`.


## v2.9.53

- On mobile, moved the How it works heading visually inside the shared carousel panel, with Join / Choose / Collect swiping beneath it in the same rounded frame.
- Enlarged the campaign calendar icon and vertically centred it against the launch-date/countdown copy.
- Reduced Founder badge artwork on wider/laptop layouts while preserving the existing mobile badge size.


## 2.9.51

- Refined product-card buying rows: price information remains beside the price, the quantity control is slimmer and outlined, and both scale responsively on narrow phones.
- Separated the divider from the price/quantity controls with consistent vertical clearance.
- Ensured the Orders membership summary remains completely hidden for signed-out visitors.
- Made Network section grids honour the Baserow `Columns` field on wide screens, while retaining responsive two- and one-column fallbacks.

## v2.9.50

- Changed the site header and footer backgrounds to the live Baserow `Primary colour`.
- Reused the live Baserow `Background colour` for header/footer text and navigation.
- Reversed the header membership button so it uses `Background colour` with `Primary colour` text, preserving contrast against the primary-colour header.
- Added a full-width header colour shell while preserving the existing constrained header layout and live logo/navigation behaviour.

## v2.9.49

- Fixed Campaign eyebrow icons so they can come from either the Section-level `Eyebrow icon` field or the Site Settings fallback.
- Changed image CTAs so body copy sits above the CTA button instead of being squeezed beside it.
- Strengthened the unified section/card shadow to match the founder-campaign treatment more closely.

## v2.9.48

- Added an optional `Icon` file field for Call to action sections.
- Resized CTAs into a narrower, proportionate supporting strip with responsive icon/text/button layout.
- Standardised the quiet rounded border/shadow treatment across CTA, Cards, Campaign and Stats presentation.
- Removed Metric titles from Stats tiles, retaining the value and explanatory description.
- Added rounded corners and matching borders to Product Grid cards without changing Network Partner card styling.



## 2.9.47 — Live section component architecture

- Replaced fragile field-by-field section DOM mutation with a constrained client-side renderer for approved section templates.
- Sections can now be added, removed, reordered, or changed between supported presentation types live from Baserow.
- CTA and image-and-text templates treat images as optional slots, so adding/removing an image does not require a deployment.
- Text, rich text, images, image fit/position, spacing, alignment, background, buttons, watermark and campaign timing are rendered from the same live section payload.
- Live rich text now matches the Baserow Markdown subset used by the static FormattedText component, including lists and links.
- Campaign/CTA eyebrow icons are preserved because the live renderer owns the complete approved component template rather than overwriting icon-bearing nodes.
- Live section creation emits an event so Metrics and Network Partners rehydrate after new Stats/Network sections are instantiated.
- Product Grid remains on the Astro renderer for now because its cart, stock and modal behaviour is substantially stateful; existing Product Grid sections remain intact and can still receive live product data through their existing APIs.
- Standardised rounded corners on text-only and image CTAs.

## 2.9.46
- Preserve live CMS body-text size classes during hydration, preventing text from shrinking after page load.
- Fix desktop price-help popover positioning by anchoring coordinates to the price-breakdown box.
- Opening a product price breakdown now closes any price breakdown already open on another product card.


## 2.9.45

- Changed price-breakdown help from inline expanding panels to small floating popovers; opening one closes the previous popover.
- On phones, help popovers float centrally above the page rather than stretching product cards.
- Improved mobile price-breakdown rendering: a card temporarily spans the full product grid while its breakdown is open, preventing cramped labels and values.
- Added the product image to the expanded product-information modal.

## 2.9.44 — Inline price transparency help

- Moved `Where your money goes` out of the expanded product modal and into an expandable highlight panel on each product card, opened from a small `ⓘ` beside the member price.
- Only the Member price row is bold; source recipient and Commons contribution/subsidy rows use normal weight.
- Each price line has its own `ⓘ` help panel; opening one closes any previously open price help panel.
- All help-panel links open in a new tab. The source-value help links to the relevant Network Partner profile, while Commons contribution/subsidy links to the configurable FAQ URL.
- Price-transparency help copy is editable through Interface Content. Network Partners also gain an optional `Price explanation` field so the source-value explanation can be tailored per producer/wholesaler and reused across all linked products.
- Price-transparency help copy and partner explanations refresh live from Baserow through the hardened public APIs; no deploy is needed for copy edits.

## 2.9.43 — Transparent product value flows

- Added optional `Source value recipient` (link to Network Partners) and `Source value` fields to Products.
- Product detail modals now show a simple `Where your money goes` breakdown: source recipient, Commons contribution/subsidy when non-zero, and Member price.
- Commons contribution/subsidy is calculated at render time as `Member price - Source value`; no duplicate margin field is stored.
- Added compact `ⓘ` disclosures explaining Commons contribution/subsidy and Member price, with a link from the Commons explanation to FAQs.
- Source-recipient names link to the corresponding Network Partner profile, and the Our Network page can open a requested partner modal from `?partner=<id>`.
- Existing Origin and Secondary origin provenance fields are unchanged.

## 2.9.42 — Live CMS public-content layer + resilient public APIs

- Added `/api/public-content`, a runtime-token-backed, strict allowlist endpoint for Site Settings, Pages, Sections, Interface Content and Collection Points.
- Added `LiveContentHydrator` so existing page heroes, section copy/buttons/images/styles, header/footer branding/navigation and theme colours refresh from Baserow without a deploy.
- Preserved Astro-generated HTML as the fast/SEO-friendly fallback if the runtime endpoint is unavailable.
- Existing Sections can be edited, hidden and reordered live; adding a brand-new Section row or changing its renderer type still requires a deploy because the component shell must exist in the generated HTML.
- Hardened `/api/public-network`: table reads are isolated, so a Sections/Members/Transactions failure no longer blanks Network Partners and Metrics.
- Both public endpoints expose only explicit public field allowlists and never expose the Baserow runtime token or raw private rows.
- Public runtime responses remain `cache-control: no-store` so Baserow edits are visible on refresh.

# v2.9.41 — Live Stats section links

- Stats sections now read their current `Metrics` links from Baserow at runtime through the public-network Cloudflare endpoint.
- Changing which Metrics are linked to a Stats section no longer requires a site redeploy.
- Stats `Columns` is also refreshed live from the current Sections row.
- The runtime token now requires Read permission on Sections in addition to Metrics and Network Partners.
- Only the Stats section ID/key, linked Metric IDs/names, and column count are exposed publicly; the endpoint does not expose general Sections content.

## 2.9.40 - 2026-08-08

- Metrics and Network Partners now load live through `/api/public-network` using `BASEROW_RUNTIME_TOKEN`; changes in Baserow appear without an Astro redeploy.
- Static builds no longer require `BASEROW_TOKEN` read access to Metrics or Network Partners.
- Live metric values resolve the existing aggregate tokens server-side and expose only aggregate/public data.
- Stats sections retain their linked Metrics selection while values are hydrated at page load.
- Network sections render active partners and partner modal metrics from the live endpoint.

## v2.9.39 — metrics consolidation

- Consolidated homepage and network impact statistics into the single `Metrics` table.
- `Stats` remains the reusable presentation section; Sections now link directly to the Metrics they display.
- Renamed the Sections `Grid source` link to `Products` and added a separate `Metrics` link.
- Renamed `Impact Metrics` to `Metrics` and `BASEROW_IMPACT_METRICS_TABLE_ID` to `BASEROW_METRICS_TABLE_ID` (the old environment name remains a temporary code fallback).
- Added `Placement`, `TOM Theme`, `TOM Outcome`, `TOM Measure`, `Calc method`, `Evidence / source`, and `Last updated` support.
- Metrics support both literal values and existing build-time `{{...}}` calculation tokens, including `{{total_members}}`.
- Partner modals now show only Metrics linked to that partner with `Placement = Partner`.
- Removed the special `Impact stats` renderer; existing legacy grouped Stats rows remain a fallback during migration.

# v2.9.38

- Added a dedicated Baserow-backed Network Partners model and `Network` section type with clickable partner cards and accessible detail modals.
- Added an `Impact Metrics` table and reusable `Impact stats` section type for funder-ready network-wide measures and partner-level impact.
- Added partner roles, longer descriptions, relationship copy, addresses and participation links to network modals.
- Added optional partner-level metrics inside network detail modals.
- Reduced Campaign heading sizes on mobile so founder-campaign copy no longer overwhelms narrow screens.
- Network partner count now prefers the dedicated Network Partners table, while retaining the old Cards fallback during migration.

## v2.9.37
- Refined Campaign launch panel to use one calendar icon with label, market date and countdown aligned in one text column.
- Added `Pre-countdown label` support for Campaign and Call to action sections.
- Added editable `Watermark opacity` (0–100%) for Campaign and Call to action watermarks only.
- Added Site Settings `Eyebrow icon` upload for Campaign and Call to action eyebrows, replacing the hard-coded campaign leaf.
- Made Campaign heading and body typography respect the existing Baserow size controls, and slightly reduced founder badge size to better match the approved mock-up.

## v2.9.36
- Fixed Pages Functions auth import regression in access-link requests.
- Restored validated return paths so checkout access-link requests return members to checkout.
- Reused an existing remembered device session when a signed-in member opens a weekly access link, avoiding redundant active device-session rows.
- Limited current weekly-access session lookup to the member's linked session rows instead of scanning the full Member Sessions table.
