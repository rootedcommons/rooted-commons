# Formatting editable Baserow text

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
