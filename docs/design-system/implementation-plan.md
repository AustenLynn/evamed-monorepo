# EVAMED Design System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Establish the material explorer, Ficha and Edit Material as shared foundations, then migrate equipment UI without changing behaviour.

**Architecture:** Global neutral tokens and scoped visual roles supply surfaces, actions, fields and typography. A projected menu shell owns layout only; features retain state and events. A reusable selection tray renders names and emits removal IDs, leaving saving to callers.

**Tech Stack:** Existing Angular, Angular Material, Sass, Vitest. No new dependencies.

**Spec:** `docs/design-system/design.md`, approved 2026-11-09.

## Global Constraints

- Preserve business behaviour, API contracts, calculations, navigation, labels and approved inline editing.
- Existing material screens are visual authority; no new fonts or brand.
- Production excludes development reference; no live API required for examples.
- No commit/push without request. Implement inline as authorized by owner; preserve local Superdesign files.

## Review Focus

- Pending saves must still disable close and prevent duplicate submissions: retain picker regressions and test projected close button.
- Selection removal must return the exact domain ID and remain keyboard operable: test shared tray removal and disabled state.
- Replacement must not display a multi-add tray: retain material/equipment choose-mode tests.
- Long names and expanded forms must shrink at 390px without a second form scroll: built-app visual checks.
- Existing nullable quantities, decimals and draft focus must survive styling migration: retain equipment regression suite.

## Task 1: Foundations and primitives

Files: create `frontend/evamed/src/styles/_tokens.scss`, `_ui.scss`; create `src/app/shared/ui/ui.module.ts`; edit `styles.scss`, `_explorer.scss`.

Interfaces: `EvUiModule` exports the shared shell and tray. Static visual attributes `evSurface`, `evHeading` (menu/detail/section), `evAction` (primary/secondary/tertiary/destructive), `evForm`, `evFieldGroup`, `evActions`, `evStatus` are opt-in CSS roles. Native semantics and inputs/events remain untouched.

- [x] Extract existing palette unchanged and add documented typography/spacing/radius/field-density tokens.
- [x] Write rendered shell/tray tests for projected native button semantics and disabled behaviour; run red before implementation.
- [x] Implement opt-in attributes and scoped styles; verify tests green. Avoid app-wide Material overrides.

## Task 2: Shared menu and tray

Files: `shared/ui/menu-shell.component.{ts,html,scss}`, `selection-tray.component.{ts,html,scss}`, `menu-shell.component.spec.ts`, `selection-tray.component.spec.ts`, module exports.

Interfaces: `app-ev-menu-shell` projects `[evMenuHeader]`, body, `[evMenuFooter]`. `app-ev-selection-tray` inputs `items: {id:number;name:string}[]`, `disabled:boolean`, `label:string`; output `remove:EventEmitter<number>`; projected action. Callers render tray only when appropriate and supply Spanish context/count copy.

- [x] Write tests for shell slot order/content, accessible name, removal ID, disabled removal and action projection; run red.
- [x] Implement using material explorer spacing, palette, chip shape and bounded chip-list overflow. Run tests green.

## Task 3: Material and equipment adoption

Files: explorer picker/card/filter/browser/detail/edit/panel-edit templates/styles, their module; equipment picker/panel templates/styles and UI module.

- [x] Adopt shared shell/tray in material and equipment pickers without touching feature saving/closing logic. Map existing selected names to shared tray inputs.
- [x] Adopt surface/headings/actions/form roles in material references first, retaining intentional compact variants.
- [x] Migrate equipment menu title 20/700/green, card titles 16/700/1.3, action tokens, chips, fields and shared status treatment. Keep expanded card inside original grid column.
- [x] Run existing picker/panel/material integration tests; correct regressions before continuing.

## Task 4: Reference and docs

Files: `shared/ui/reference/` component/template/style and dev/production route provider files; `app-routing.module.ts`, `angular.json`; design-system foundations/components/migration/decisions docs; handoff pointer.

- [x] Add synthetic interactive reference at `/design-system` via a development route provider, file-replaced with an empty route list in production and docker. No production imports of reference component.
- [x] Document actual APIs and values, states, variant rules and current migration coverage. Link future frontend changes from root contributor guidance.
- [x] Build production and confirm reference demo text absent from generated JS. Reference route must require no backend fixtures.

## Task 5: Verification and review

- [x] Full frontend suite: Node22 `ng test --watch=false`; require all pass.
- [x] Touched-file ESLint, production build and `git diff --check`; record existing warnings.
- [x] Built-app screenshots at 1440/390 and responsive boundaries; verify material references, equipment menu/inline editor, empty/error/pending states and no document overflow.
- [x] Independent review of diff and remaining limitations. Record evidence and completion status; leave uncommitted for owner review.

## Self-review

Scope covers reference material screens, scoped shared primitives, first equipment migration and durable docs. Domain state/validation remains in features; UI output IDs are numeric to match both callers. Production exclusion uses build file replacement rather than runtime-only hiding. Backend remains unchanged.

Execution note: static CSS attributes replace no-behaviour directives, as permitted by the design. Shared behavioural tests observed red→green; CSS refactoring checked through rendered screenshots and regressions. Final validation record follows when complete.

## Final outcome

Tasks 1–5 complete within the documented local verification scope. Actual APIs, intentional variants and deferred pages are listed in components.md and migration.md. Final review found no critical/important issues. No backend, data or dependency changes.
