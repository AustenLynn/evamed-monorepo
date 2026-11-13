# Usage stage concept

Status: visual concept approved by owner, 2026-11-13. No application implementation or production data changes. Proposed technical design: [Usage stage implementation design](../superpowers/specs/2026-11-13-usage-stage-design.md).

## Owner direction

Bring Usage close to Materials, Construction and End of Life. Use an Add Source catalogue dialog and editable source cards. Keep each source's percentage fixed when the annual consumption total changes, recalculating its quantity.

The concept proposes percentage-first inline editing with a read-only calculated quantity, a whole-building annual summary, and an allocation summary. Source-only multi-add starts at zero allocation; replacement is direct selection. Photovoltaics remain a separate generation option. Source cards use readable names and separate database/region badges; no unsupported impact badges or reference factors.

Example only: annual total 10,000 kWh, electricity 60% (6,000), gas 20% (2,000), and 20% remaining. Changing total to 12,000 preserves the shares and gives 7,200 / 2,400 with 2,400 remaining. These are synthetic preview values, not a saved project.

## Visual authority

Use the maintained foundations/components in this folder. The visual references are actual rendered equipment cards and the shared explorer catalogue, with EVAMED's exact logo, four stage images and DAUIC footer identity. Usage is global to the building: no building-element selector or Cimentación-specific copy. One main scroll owner in the catalogue, with a persistent selection tray; editing remains inside the selected card.

Supporting context and draft resume state live under `.superdesign/`. The full manifest is `.superdesign/usage-context-manifest.md`; it intentionally excludes environments, credentials, project exports and private keys. The design-tool snapshot is `.superdesign/design-system.md`; the maintained docs in this folder remain authoritative.

## Technical findings for the implementation plan

These are findings, not authorization for a migration:

- Current annual consumption is an integer; source quantities are decimal strings (20 total digits / 10 decimal places), and percentages are integers. Do not silently round values to fit a new UI. Fractional share support would need an explicit contract decision.
- Annual/source `unit_id` references Unit, while the old forms populate EnergyUnit choices and default ID 1. The fixture has EnergyUnit 1=kWh, Unit 1=Pz and no Unit kWh entry. Validate the actual live Unit catalogue before writing; do not equate IDs from different tables or automatically reinterpret existing rows. Correct unit handling/data additions need a scoped implementation decision.
- New and reopened-project forms have separate save paths; source loading currently collapses multiple rows into three family fields. A card implementation must retain all row IDs and avoid collapsing, duplicating, or silently deleting existing records.
- The current B6 loop sums typed source quantities and their matching factors. Photovoltaic rows have `source=panels,type=null`; do not fabricate a catalogue product, factor, zero-impact claim or database/region for them.
- Changing the annual total and all dependent quantities needs coherent persistence and partial-failure recovery; replacing delete/recreate or unawaited legacy saves belongs in the implementation plan. No calculation formula changes are implied by the mockup.

The owner approved the visual flow on 2026-11-13 and asked to continue. The technical design is drafted; the implementation plan and application changes remain pending.

## Review links and checks

[Interactive Usage mockup](https://p.superdesign.dev/draft/6cb2a85b-ad3c-423d-8a8f-9e2e4ea0a26f) · [Design canvas](https://superdesign.dev/teams/f83286a9-4785-46e1-932a-d0e94f28ca55/projects/18d030f8-69ec-49b9-99c4-d0f99287b85e?node=draft-variant-6cb2a85b-ad3c-423d-8a8f-9e2e4ea0a26f)

Draft 6cb2a85b-ad3c-423d-8a8f-9e2e4ea0a26f, version 2. The first model job failed HTML validation; a single faster-model retry generated the base. Literal corrections restored the exact header/footer, readable names, real catalogue metadata, region filters, selection tray and complete draft/save/cancel behaviour. Photovoltaics carry only their generation label.

Local browser checks at 1440px and 390px pass without document overflow or JavaScript errors. Checked fixed-share annual-total recalculation (10,000→12,000 gives 7,200/2,400), percentage validation, replacement cancellation, selection preservation through filters, source-only add, and photovoltaic allocation. Exact identity assets are present in the saved version. This remains a concept, not production implementation.
