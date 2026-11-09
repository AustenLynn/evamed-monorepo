# Foundations

Authority: Explorar Material, Ficha and Edit Material. These values preserve EVAMED's existing identity. Definitions live in `frontend/evamed/src/styles/_tokens.scss`, imported once from `styles.scss`.

## Colour

| Role / CSS token | Value | Usage |
| --- | --- | --- |
| `--ev-bg` | #f8f8f8 | Page/menu background |
| `--ev-surface` | #ffffff | Cards, panels, headers and trays |
| `--ev-surface-muted` | #efefef | Muted surfaces |
| `--ev-border` / `--ev-divider` | #cbcbcb / #ededed | Outlines / internal dividers |
| `--ev-text` | #000000 | Main copy |
| `--ev-text-muted` | #767676 | Supporting copy on white |
| `--ev-text-muted-on-bg` | #595959 | Supporting copy on page background |
| `--ev-green-light` | #a8d024 | Primary action background with black text |
| `--ev-green` | #7fa20b | Accents and selected borders |
| `--ev-green-text` | #5b7408 | Readable green text and focus rings |
| `--ev-yellow` / `--ev-melon` | #edc903 / #ed8484 | Existing stage/brand accents |

Existing `--ev-impact-low-*`, `--ev-impact-mid-*`, `--ev-impact-high-*` pairs remain for impact badges and semantic notices. Do not invent impact values for equipment. Use supported Angular Material tokens for filled buttons so disabled states continue to work.

## Typography

`--ev-font-family`: Helvetica Neue, Helvetica, Arial, sans-serif. `--ev-font-heading`: Roboto, sans-serif, matching the reference screens’ rendered Angular Material typography. Material controls retain their existing typography. Roboto is already loaded in `index.html`; no additional font download.

| Token | Value | Use |
| --- | --- | --- |
| `--ev-font-menu` | 20px | Menu heading, weight 700, readable green |
| `--ev-font-detail` | 24px | Ficha heading, weight 700 |
| `--ev-font-section` | 16px | Section/card heading, weight 700 |
| `--ev-font-body` | 14px | Field/search copy |
| `--ev-font-support` | 13px | Context and supporting copy |
| `--ev-font-caption` | 12px | Units/captions |
| `--ev-font-value` | 30px | Catalogue impact value |

Cards use `--ev-line-heading: 1.3`. Compact material summaries retain 24px and 20px variants. Quantities use tabular numerals. Font sizes are roles, not a reason to make every title identical.

## Spacing, shape and density

`--ev-space-1` through `--ev-space-8`: **4, 6, 8, 12, 16, 20, 24, 32px**. Prefer these values over new one-off spacing.

- `--ev-radius-card: 12px`, 1px outline; standard card padding 16px.
- Ficha panels use 20px padding; compact form/inline variants retain their documented smaller padding.
- `--ev-radius-search: 10px`; `--ev-radius-alert: 8px`; selection chips are pill-shaped.
- Menu header/tray: 12px vertical, 24px horizontal; 16px horizontal below 600px.
- Form density: `--ev-field-height: 44px`, `--ev-field-padding: 10px`. Search/sort may retain their existing compact variants.

## Responsive and accessibility rules

At 900px, explorer/Ficha columns collapse. At 600px, compact grids/forms and trays stack. Existing complex material forms also adjust at 1100px. Keep long names wrapping and grid/flex children shrinkable. Wide tables may scroll within their container.

A menu has one main scroll owner: the shared shell body. Edit forms do not introduce nested scrolling. A long selection chip list may use bounded scrolling so the action remains visible. Keep native buttons, labels, fieldsets, disabled states, focus rings and real `role=status`/`role=alert` announcements. Colour cannot be the only signal of selection or failure.
