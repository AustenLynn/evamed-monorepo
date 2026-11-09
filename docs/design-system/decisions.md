# Decisions

## 2026-11-09 — Material references are authoritative

Owner selected Explorar Material, Ficha and Edit Material as the foundation, then approved shared components and gradual migration. Preserve EVAMED palette/identity. Earlier equipment mockups are supporting material only.

## 2026-11-09 — Shared visual roles and two behavioural components

Use static opt-in attributes for purely visual roles, rather than directives without behaviour. Use real components for the menu projection/scroll layout and accessible selection tray. Angular Material retains native interaction; features retain data, API calls and validation.

## 2026-11-09 — Development reference excluded at build time

Use a lazy development route with production/docker file replacement to an empty route list, rather than only hiding a runtime route or putting synthetic examples in production navigation.

## 2026-11-09 — Preserve domain differences

Do not use material impact badges, unit assumptions or transport fields for equipment. Shared styling does not change source-only batch adds, null units, quantity precision, inline drafts, or stable-ID persistence.

## 2026-11-09 — Preserve rendered typography

Browser inspection confirmed reference headings use Roboto from the existing Material theme. `--ev-font-heading` preserves this while `--ev-font-family` retains the existing body stack. Card heading line-height stays 1.3; generic headings retain their existing Material line-height. Equipment quantity values retain their 26px/600 presentation, distinct from the catalogue impact-value role.
