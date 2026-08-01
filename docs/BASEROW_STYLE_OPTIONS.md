# Baserow style options and CSS translation

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
| Wide | `max-width: var(--max)`; exactly matches Section width |
| Full | Full available width with no maximum |

Legacy `Normal` and `Medium` values are treated as `Standard`.

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
