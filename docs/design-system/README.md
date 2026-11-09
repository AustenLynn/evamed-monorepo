# EVAMED design system

Status: owner-approved system; first migration implemented locally, 2026-11-09.

This folder is the durable source of truth for EVAMED's design decisions. The approved visual references are Explorar Material, Ficha, and Edit Material. Their existing source code is the baseline; the earlier Superdesign equipment mockup is not authoritative.

The approved intent and scope are in [the design](design.md). Read [foundations](foundations.md), [components](components.md), [migration](migration.md), and [decisions](decisions.md) for the maintained rules. Working mockups under `.superdesign/` are supporting material, not the maintained specification.

For future changes:

1. Check this folder and the shared UI components before adding styles or controls.
2. Reuse the existing pattern. Document a justified new variant here alongside its implementation.
3. Verify keyboard interaction, loading/error/disabled states, long content, and mobile layouts.
4. Update the component reference and migration inventory when a component changes.

The current APIs are documented in components.md; migration.md identifies what is implemented and what remains deferred. Do not treat deferred patterns as available shared components.
