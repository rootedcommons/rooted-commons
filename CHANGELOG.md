# Changelog

## 2.9.31

- Fixed an Astro build-breaking quote in the signup success security fallback copy.
- Changed the existing-member signup button fallback to “Send me my access link” to match the non-rotating resend behaviour.

## 2.9.30

- Finalised the clean secure-session architecture for a pre-launch installation: Member Sessions now uses only `Weekly access` and `Device session`.
- Removed legacy plaintext-token migration code and documentation.
- Added scheduled Wednesday weekly-access rotation and service-email delivery through Cloudflare/mailbox.org.
- Added `Email sent at` to Member Sessions so retries do not duplicate the weekly email.
- Added `cloudflare/weekly-access-cron-worker.js`, with Europe/London time checking to handle GMT/BST safely.
- On-demand access-link requests continue to resend the current weekly credential without rotating it or signing out existing devices.
- Standardised outgoing mail display name on `EMAIL_FROM_NAME` (with backwards-compatible fallback).

## v2.9.29 — 8 August 2026

- Separated weekly access credentials from remembered-device sessions. Opening a weekly access link now creates a distinct 90-day `Device session`, so the next Wednesday link rotation does not sign out an already-authenticated device.
- Email verification now creates the same 90-day device session.
- Sign out now revokes the current device-session row as well as clearing the HttpOnly cookie.
- Updated signup, FAQ, checkout, membership terms, privacy/cookie wording and welcome-email copy to describe weekly access links and remembered-device sessions accurately.
- Updated Baserow import/specification CSVs: removed plaintext `Order token`, `Token created` and `Order token expiry` from Members; added `Access link requested at`; added the new `Member Sessions` table specification/import.

## 2.9.28

- Added a header Sign in / Sign out control alongside the existing membership button.
- Added a dedicated sign-in page that resends the member’s current access link without rotating it.
- Added a sign-out endpoint that clears the secure authentication cookie and returns to the home page.

## v2.9.27 — 2026-08-07

### Security hardening
- Added a separate `Member Sessions` authentication layer. New access links use HMAC-signed session IDs; no reusable bearer secret is stored in Baserow.
- Added a protected migration endpoint that hashes legacy member tokens into `Member Sessions`, creates a signed current session, then removes plaintext `Order token`, `Token created`, and `Order token expiry` values from `Members`. Existing already-sent links continue to work until their original expiry via the stored hash.
- Member authentication now resolves a single session and linked member rather than downloading the whole Members table to find a plaintext token.
- Authenticated browsing now uses an HttpOnly, Secure, SameSite=Lax session cookie. Legacy/token URLs are exchanged at `/api/access` and redirected to a clean URL; the browser no longer persists member tokens in localStorage.
- `/api/request-link` now sends the current signed access link directly from Cloudflare through the configured mailbox.org SMTP account and no longer needs a Baserow email automation. Repeated requests within one minute are suppressed.
- Baserow error response bodies are logged server-side only; member/signup/request-link APIs now return generic server errors rather than backend details.

## 2.9.26 — 2026-08-07

- Corrected the access-link request flow so it **does not rotate or replace the member's existing Order token**.
- `/api/request-link` now updates only `Access link requested at`, allowing Baserow/mailbox.org to resend the member's current link.
- This preserves links already issued in weekly emails and avoids invalidating a member's previously supplied access link.
- Updated signup fallback copy and the generic endpoint response to say the existing access link is being resent rather than a new link being created.
- Retained the one-minute repeat-request guard and non-enumerating public response.

## 2.9.25 — 2026-08-07

- Reworked the existing `/api/request-link` flow to trigger Baserow-managed access-link email instead of sending through the legacy magic-link webhook.
- A successful active-member match now rotates the secure `Order token`, refreshes its expiry, and updates the new `Access link requested at` date/time field.
- The existing checkout and signup access-link forms continue to use the same endpoint and keep the same non-enumerating public response.
- Added a one-minute repeat-request guard so repeated submissions do not repeatedly trigger the Baserow email automation.
- The Baserow automation can now send the email through the existing mailbox.org SMTP connection using the member row's current `Order token`.
- Existing Baserow import/specification folders remain unchanged pending the v3.0 rebuild.

## 2.9.24 — 2026-08-06

- Added production Xero member-payment sync endpoint at `/api/xero/sync`, protected by a dedicated `XERO_SYNC_KEY` and accepting POST only.
- Sync scans recent Xero `RECEIVE` BankTransactions, imports all safe reconciled `RC-number` payments, and uses `Xero BankTransactionsID` to prevent repeat imports.
- Exact member references are credited automatically; valid `RC-number` payments with no member match are recorded as `Unmatched` and excluded from credit for manual review.
- Other business receipts without an exact Rooted Commons `RC-number` reference are ignored.
- Xero Sync State now records last attempted/successful sync and sync errors.
- Added a minimal separate Cloudflare Cron Worker script (`cloudflare/xero-sync-cron-worker.js`) for a `*/15 * * * *` schedule, because Pages Functions themselves do not expose a Cron Trigger handler.
- Existing manual diagnostic/import-test endpoints remain available for troubleshooting.
- Existing Baserow import/specification folders remain unchanged pending the v3.0 rebuild.

## 2.9.23 — 2026-08-06

- Simplified Xero member-payment imports: `Type` is now `Payment` and `Source` is `Xero`.
- Removed the importer dependency on the redundant `Xero Reference` field; the canonical member payment reference remains `Payment reference`.
- `Xero BankTransactionsID` remains the sole Xero idempotency key for Receive Money / bank transaction imports.
- `Xero PaymentID` is not used by the current member-payment architecture and may be removed from Baserow.
- The existing `baserow-imports` and `baserow-table-specification` folders are intentionally left unchanged pending the v3.0 Baserow rebuild.

## 2.9.22 — 2026-08-06

- Added a protected manual Xero member-payment import test at `/api/xero/import-test`.
- Imports only the newest recent reconciled, AUTHORISED, positive Xero `RECEIVE` transaction whose Reference is an exact `RC-number`.
- Matches that reference to the Baserow `Members` table, creates one linked `Account Transactions` row, and marks it included in credit.
- Uses `Xero BankTransactionsID` as the idempotency key, so rerunning the test cannot create the same payment twice.
- Refactored recent Xero RECEIVE retrieval into a shared helper used by both the diagnostic and import test.
- The 15-minute scheduled sync is still intentionally not enabled until the manual import is verified.

## v2.9.21

- Added a protected, read-only Xero bank-transaction diagnostic at `/api/xero/diagnostic` for testing the first reconciled member payment before ledger writes are enabled.
- The diagnostic refreshes Xero OAuth tokens safely and immediately persists the newly rotated refresh token in the private Xero Sync State table.
- It retrieves recent `RECEIVE` BankTransactions and shows only a deliberately limited diagnostic view, including any `RC-*` reference values and their JSON paths; it does not create or alter Account Transactions.
- Added the Xero server-side environment variables to `.env.example`, including a temporary `XERO_DIAGNOSTIC_KEY` used to protect the diagnostic page.

## v2.9.20

- Fixed the Astro build failure introduced by the bold/italic `FormattedText` update: inline elements are now rendered in the Astro template rather than JSX inside frontmatter.
- Retained `**bold**`, `*italic*`, and Markdown link support in Baserow body text.
- Retained the v2.9.19 Stats highlight-colour and rounded CTA/Campaign styling changes.
- Updated the package version to 2.9.20.

## v2.9.19

- Changed the grouped Stats panel to use the configured Highlight colour directly.
- Added the same rounded corners used by Cards/Stats to Call to action and Campaign boxes.
- Preserved all existing v2.9.18 behaviour, including bold/italic body formatting.

## 2.9.18

- Added `*italic*` formatting support to Baserow rich text alongside existing `**bold**` and Markdown links.

## 2.9.17

- Fixed Baserow rich-text rendering so `**bold text**` in section/card bodies renders as bold instead of showing the Markdown asterisks.

## v2.9.16 — dedicated campaign section

- Added `Campaign` as a dedicated Sections renderer type for time-limited membership and launch campaigns.
- Campaign sections use one text column and can display up to three images in a responsive row after the body copy.
- Replaced the old countdown label with optional `Pre-countdown text` and `Post-countdown text` fields while retaining `Countdown date`.
- Campaign timing now renders the pre-countdown line above the live day count and leaves a deliberate gap before the CTA button.
- Existing Call to action sections remain supported and can use the same new countdown text fields.

## v2.9.15 — stats campaign presentation

- Added `{{total_commitments}}` public stats token, calculated from active members' `Weekly commitment` values.
- Added optional `Group heading` support for grouped Cards, Stats and Gallery sections; blank means no visible group heading and the internal group key is never displayed.
- Styled grouped Stats as one rounded highlight panel, matching the signup/dashboard visual language.
- Added reusable CTA countdown support through optional Baserow `Countdown date` and `Countdown label` fields. The countdown renders days remaining, then `Launch day`, then `Now launched`.
- Kept the existing Baserow import/specification folders unchanged pending the v3.0 database rebuild.

# Documentation packaging note

The restructured v2.9.14 download contains no runtime code changes. Historical setup/design notes were consolidated into five current documentation files; version history remains below. Future releases should update the canonical documents in place rather than adding version-specific setup notes.

# v2.9.14
- Added statutory cancellation-refund timing to Terms of Sale.
- Removed duplicated Member Credit/top-up mechanics from Terms of Sale and cross-referenced Membership Terms.
- Added ICO website and telephone contact details to the Privacy Notice.
- Added an internal Member Credit regulatory-perimeter note, distinguishing the current closed-loop retailer-credit model from e-money and documenting LNE review triggers.

# v2.9.13
- Revised the Privacy Notice for clearer UK GDPR transparency: controller identity, required data, lawful purposes, recipient categories, retention, local storage and rights.
- Removed obsolete MailerLite references and the public named-provider list from the Privacy Notice.
- Reworked Membership Terms from 11 sections to 7, separating the ongoing membership relationship from the Terms of Sale.
- Replaced blanket non-withdrawable Member Credit wording with a fairer leaving arrangement, including partner vouchers only by agreement.
- Tightened significant-change provisions and simplified liability wording.

# v2.9.12
- Made `/collection-points/` a dedicated coded route so it no longer depends on a Baserow Pages row.
- Confirmed `/membership-terms/` and `/privacy/` are already dedicated coded routes.
- Added dedicated `/terms-of-sale/` with concise consumer-friendly terms that also cover small direct B2B sales and a voluntary 14-day cancellation period for eligible non-perishable distance purchases.
- Added a public but `noindex,follow` `/contact/` page with contact email and Roots to Fruits CIC legal information.
- Added Contact and Terms of Sale to the footer legal links.
- Excluded contact/legal/special routes from the generic Baserow `[slug]` page generator to prevent duplicate routes.
- Removed dedicated-route slugs from the bundled Pages import.
- Moved Collection points title/intro editing to Interface Content.
- Added `docs/V3.0_README.md` explaining the dashboard as `I belong → I commit → I connect locally → I get involved → together, we create wider change`.

# v2.9.11
- Anchored Member credit immediately above Browse this week's market at the bottom of the Membership card's right-hand 40% column.
- Moved membership weeks back into Your Membership immediately above the perks section; removed the duplicate weeks counter from the lower participation card.
- Renamed the lower-right card to `Your Involvement`.
- Changed Your Involvement counters to a 50/50 two-column grid.
- Added `Events attended` as the fourth involvement counter alongside redirected locally, volunteer days and workshops attended.
- Added the collective-impact bridge: `You're part of something bigger` with an editable link to the network story.
- Reused `dashboard.reference_help` directly below the RC-x reference in Your Weekly Commitment and removed the deprecated regular-payment note.
- Removed the redundant `dashboard.collection_view` link without affecting Change collection point.
- Updated Interface Content and Members schema/import files.

# v2.9.10
- Moved `Browse this week’s market` into the 40% Member Credit column so it uses the vertical space beside the badge; the 60/40 layout remains on mobile.
- Removed the `workshops` unit after the Workshops attended number, leaving the explanatory label below.
- Tightened Collection point typography and spacing between collection time, address, title and change button.
- Added `(see our map)` beside `Choose your collection point` in the dashboard change form; the link text is editable through Interface Content.
- Changed the collection-map top button to `Back`; it now returns to the browser’s previous page, with a safe fallback if no previous page exists.

# v2.9.9
- Simplified Your Membership: `Your membership` now sits immediately below the greeting, followed by a responsive 60/40 badge + Member Credit row.
- Removed the repeated Founder text beneath the badge; the badge image itself communicates Founder/Member status.
- Member Credit remains left-aligned in its 40% column and does not stack beneath the badge on mobile.
- Removed the previous/last-order line entirely.
- Restored the membership-weeks counter (`0 weeks` is valid) and moved it with `£ redirected locally` into a new bottom-right `Your impact` card.
- Added Volunteer days and Workshops attended participation counters to Your impact.
- Kept `redirected locally` wording unchanged.
- Added optional Members fields `Volunteer days` and `Workshops attended`; blank/missing values render as 0.
- Changed the Collection point image to natural proportional sizing instead of a fixed-height crop.
- Updated Interface Content and Baserow schema/import files.

# v2.9.8
- Fixed founder badge assignment to use the current Active member count already loaded during signup, matching the public Total members statistic and requiring no extra Baserow read.
- Removed the row-ID-based founder badge fallback from the dashboard/member API.
- Added support for the Site Settings `Member badge` image for members outside Founder 10/25/50.
- Changed the dashboard to a genuine two-column top row: Membership alongside Weekly commitment, with Collection point beneath at card width.
- Restored `No orders made yet` for members with no previous website order instead of displaying `0 weeks`.
- Restored `Browse this week’s market` for every member regardless of current weekly order state.
- Added an editable italic payment-reference explanation beneath the BACS top-up reference.
- Removed the redundant selected-regular-payment summary from the Weekly commitment card.
- Updated Interface Content and Baserow Site Settings specifications.

# v2.9.7
- Restored the signup form to the plain-body layout with thin section dividers instead of highlighted internal boxes.
- Kept the newsletter and Membership Terms/Privacy consent checkboxes together with no divider between them.
- Removed all use of the deleted `Membership consent at` field.
- Signup now writes the membership/consent timestamp to `Member since`, restoring the dashboard membership-weeks calculation.
- Added `Token created` writes whenever signup or the login-link endpoint generates a token.
- Order tokens now expire at the next Wednesday 18:05 Europe/London; tokens generated at or after Wednesday 18:05 expire the following Wednesday.
- Updated signup/security copy from Sunday token renewal to Wednesday after orders close.
- Updated Baserow member schema/import documentation for `Member since`, `Token created` and Wednesday token expiry.

# v2.9.6
- Stacked the negative-credit payment choices vertically.
- Split secure online payment into three top-level choices: Bank transfer, Card, and Open Banking.
- Changed the online labels to `Pay securely by card` and `Pay securely from your bank (Open Banking)`.
- Restored the centred Founder badge to a larger maximum size.
- Added editable Interface Content rows for the new Card/Open Banking labels and placeholders.

# v2.9.5
- Removed the separate dashboard welcome/credit card and consolidated greeting, founder badge, membership identity and Member Credit into the main Membership card.
- New members with no positive account payments see `Welcome {name}` and do not see previous-order, perks, average-order, payment-history or account-activity sections.
- Negative credit now opens a highlighted payment chooser spanning the Membership card, with BACS as the recommended option and placeholders for future Card / Open Banking checkout.
- The market button is positioned below membership impact and changes wording when a current Processing/Confirmed weekly order exists.
- Weekly commitment is now card 2; its regular-payment heading changes to `Set up your regular payment` for new members.
- Collection point is card 3 and no longer shows the preferred-slot explainer or Wednesday order-close line.
- Founder badge display is automatically derived from member row ID (Founder 10 / Founder 25 / Founder 50) when no explicit badge is stored.
- Existing members now see every upcoming membership perk with a weeks-remaining countdown, not only the next perk.
- Added current-week order status and total positive payments to the member API response.
- Expanded Dashboard Interface Content rows so all new dashboard copy is editable.

# v2.9.4
- Changed `Member number` to the Baserow formula `concat('RC-', row_id())`; signup no longer performs a second write or rollback.
- Reordered signup collection controls so Collection point is chosen before Preferred collection day; days are then filtered to that point's actual collection slots.
- Added right-aligned italic collection-point help: `Only some locations support late collection.`
- Added highlight-colour section boxes while retaining the existing main form background.
- Moved Requests above Keeping in touch and restyled the optional textarea.
- Changed monthly minimum/default to £43.33. +/- controls move to whole-pound landmarks: £43.33 → £44.00 → £45.00 and back.
- Added email confirmation fields and `/api/verify-email`; signup can send a welcome/verification webhook containing the secure verification link.
- Existing-email signups now show a specific existing-member state with a button to send a fresh secure login link.
- Login-link requests now rotate the member's Order token before sending the new link.
- Replaced the hard-to-see Leaflet back control with a normal purple `Back to form` button above the collection-point map.
- Revised Membership Terms to distinguish Rooted Commons membership from statutory/company membership of Roots to Fruits CIC and to cover weekly/monthly commitments.
- Updated Interface Content rows, Baserow schema documentation, setup instructions and welcome-email template.

# v2.9.3
- Signup now generates canonical `Member number` values as `RC-{Baserow row ID}` and no longer relies on a separate Payment reference or Xero ContactID.
- Signup writes an `Order token expiry` for the following Sunday; rotating the token on Sunday invalidates the previous link immediately.
- Added Confirm email address validation and an optional Product requests section.
- Refined signup layout/help text and changed commitment controls to custom £1 +/- buttons while still accepting penny amounts by typing.
- Collection point label now reads `Collection point (see our map)`.
- Collection-point map supports returning to signup, selecting a collection point back into the signup form, and changing the saved point for authenticated members.
- Signup form state is preserved while visiting the collection-point map.
- Updated Interface Content rows and Baserow schema documentation.
- Removed runtime dependence on Xero ContactID; member-payment matching is documented around generic Xero contact + `RC-x` reference.

# v2.9.2
- Signup confirmation now links directly to the newly created member dashboard using the generated Order token.
- Added editable dashboard-link label and security guidance to Interface Content.

# Changelog

## v2.9.21

- Added a protected, read-only Xero bank-transaction diagnostic at `/api/xero/diagnostic` for testing the first reconciled member payment before ledger writes are enabled.
- The diagnostic refreshes Xero OAuth tokens safely and immediately persists the newly rotated refresh token in the private Xero Sync State table.
- It retrieves recent `RECEIVE` BankTransactions and shows only a deliberately limited diagnostic view, including any `RC-*` reference values and their JSON paths; it does not create or alter Account Transactions.
- Added the Xero server-side environment variables to `.env.example`, including a temporary `XERO_DIAGNOSTIC_KEY` used to protect the diagnostic page.

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

## v2.9.21

- Added a protected, read-only Xero bank-transaction diagnostic at `/api/xero/diagnostic` for testing the first reconciled member payment before ledger writes are enabled.
- The diagnostic refreshes Xero OAuth tokens safely and immediately persists the newly rotated refresh token in the private Xero Sync State table.
- It retrieves recent `RECEIVE` BankTransactions and shows only a deliberately limited diagnostic view, including any `RC-*` reference values and their JSON paths; it does not create or alter Account Transactions.
- Added the Xero server-side environment variables to `.env.example`, including a temporary `XERO_DIAGNOSTIC_KEY` used to protect the diagnostic page.

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

## v2.9.21

- Added a protected, read-only Xero bank-transaction diagnostic at `/api/xero/diagnostic` for testing the first reconciled member payment before ledger writes are enabled.
- The diagnostic refreshes Xero OAuth tokens safely and immediately persists the newly rotated refresh token in the private Xero Sync State table.
- It retrieves recent `RECEIVE` BankTransactions and shows only a deliberately limited diagnostic view, including any `RC-*` reference values and their JSON paths; it does not create or alter Account Transactions.
- Added the Xero server-side environment variables to `.env.example`, including a temporary `XERO_DIAGNOSTIC_KEY` used to protect the diagnostic page.

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
