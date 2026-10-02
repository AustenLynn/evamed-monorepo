# Upload File Name as Text Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The chosen file's name is shown as plain text, never parsed as HTML.

**Architecture:** In `ToDoFileComponent.onFileChange()`, write the label with `textContent` instead of `innerHTML`. `Renderer2.setProperty` doesn't go through Angular's sanitizer, so today a file named `<img src=x onerror=…>.xlsm` runs script on the uploader's own page. It's self-XSS only, since only the uploader can trigger it, but it's a one-line fix.

**Tech Stack:** Angular 22, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-01-security-performance-audit.md`, finding 8.

## Global Constraints

- **The label shows exactly the file's name**, character for character.
- **No other behaviour changes.** The upload icon swap, parsing and the Continuar gating from the Continuar fix stay as they are.
- **Commands run from `frontend/evamed`:** `npx -y -p node@22 -- npx ng test --watch=false --include src/app/to-do-file/components/to-do-file/to-do-file.component.spec.ts`.

## Review Focus

- **A name containing markup** (`<img …>`, `<b>`) must appear literally, with no element created. Tested in Task 1.
- **A name containing `&`, `<` or accented characters** (`Diseño & obra <v2>.xlsm`) must display unchanged. Tested in Task 1.

---

### Task 1: Write the file name with textContent

**Files:**
- Modify: `frontend/evamed/src/app/to-do-file/components/to-do-file/to-do-file.component.ts` (line 48)
- Modify: `frontend/evamed/src/app/to-do-file/components/to-do-file/to-do-file.component.spec.ts`

- [ ] **Step 1: Write the failing test**

Add to the `describe` block in `to-do-file.component.spec.ts`, which already defines `fixture` and `chooseFile(file)`:

```typescript
  it('shows the file name as text, not HTML', () => {
    const name = '<img src=x onerror="window.__pwned=1">Diseño & obra <v2>.xlsm';

    chooseFile(new File(['x'], name));

    const label: HTMLElement = fixture.nativeElement.querySelector('#fileType');
    expect(label.textContent).toBe(name);
    expect(label.querySelector('img')).toBeNull();
  });
```

- [ ] **Step 2: Run it to verify it fails**

Run the command from Global Constraints. Expected: FAIL. `textContent` is `Diseño & obra .xlsm`, because the markup was parsed, and an `img` is found.

- [ ] **Step 3: Fix**

In `to-do-file.component.ts`, change:

```typescript
    this.renderer2.setProperty(asTitle, 'innerHTML', file);
```

to:

```typescript
    // textContent: the name is user input; innerHTML via Renderer2 isn't sanitized.
    this.renderer2.setProperty(asTitle, 'textContent', file);
```

- [ ] **Step 4: Run the tests to verify they pass**

Run the same command. Expected: all tests in the file pass (the 4 existing ones plus this one).

- [ ] **Step 5: Commit**

```bash
git add frontend/evamed/src/app/to-do-file/components/to-do-file/
git commit -m "fix(upload): show the chosen file name as text, not HTML

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```
