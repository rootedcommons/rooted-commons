# Changelog

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
