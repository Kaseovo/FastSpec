# Whole-page design-direction prototype

**Question:** given "tree" won as the Form Editor content pattern, does the
rest of the `/specs` page (header, toolbar, tagline row, Saved Specs
sidebar, Form/Code/Preview/Lint switcher) still make sense around it, or
does that light corporate-SaaS chrome now clash with a denser IDE-like
panel? Follow-up to `../form-editor-prototype/`.

**Where:** existing `/specs` route, sub-shape A — real auth, real spec
data, real save/lint/token dialogs. Switch with `?pageVariant=`, dev-only
(`import.meta.env.DEV` gate in `AppLayout.vue`), same floating switcher
component as the Form Editor prototype (now generalized to accept
`variants`/`queryParam`/`label` props so both prototypes share it).

## Variants

- **`unified`** — collapses the header, tagline, toolbar, and Form/Code/
  Preview/Lint switcher (4 stacked rows in production today) into one slim
  top bar: logo, a spec-name button that opens the full `SpecList` in a
  popover, a segmented mode switcher, and actions/user on the right. No
  persistent sidebar at all — content gets full width. Best for someone
  mostly working one spec at a time.
- **`sidebar`** — persistent dark sidebar holds the real `SpecList`
  (restyled via `:deep()`, not forked) stacked above where the Form
  Editor's own tree would continue below it conceptually — closest to a
  traditional IDE explorer. Top bar is reduced to just the mode switcher +
  actions. Best when jumping between many specs constantly.
- **`workbench`** — browser-tab-style strip for saved specs (lightweight,
  fetched independently via `fetchSpecs()`, not the full `SpecList`
  component) with a "..." overflow button that opens `SpecList` in a
  popover for the full rename/delete/history management UI — so nothing
  is lost, just deferred. Mode switcher is bold colored pills directly
  above the content. Most content-maximizing of the three.

All three reuse, unmodified: `SpecList.vue` (full manage UI, reached
directly or via popover depending on variant), `UserProfile.vue`,
`FormEditorVariantTree.vue` (the winning Form Editor content from the
first prototype round), and `EditorPanel`/`PreviewPanel`/`LintPanel` for
the other three modes. New shared pieces either extracted for this or
reused from the first round:
- `usePagePrototypeContent.js` — same `specEditor`/`lint` injection
  EditorView.vue already relies on, so real data flows through with zero
  duplicated fetching logic.
- `PagePrototypeContent.vue` — the mode-based content switch, identical
  across all three shells; only the chrome around it differs.

**Known simplification:** clicking a lint result to jump to a specific
line switches to Code mode but doesn't scroll to the line (EditorView.vue's
`ref.goToLine()` forwarding wasn't worth threading through three shells for
a layout prototype — trivial to restore in the real implementation).

**Bug found along the way (unrelated to this prototype):**
`redirectToLogin()` in `src/api/specs.js` calls
`router.push({ name: "login" })` on any 401, but no route is named
`"login"` in `router/index.js` — throws an unhandled promise rejection
instead of actually redirecting. Surfaced when a dev JWT expired
mid-session. Worth a real fix independent of this prototype.

## Verdict

**Not yet decided.** Try `?pageVariant=unified`, `?pageVariant=sidebar`,
`?pageVariant=workbench` (append to `/specs/`, e.g.
`http://localhost/specs/?pageVariant=sidebar`). Once picked:

- Fold the winner's shell into `AppLayout.vue` (replacing `AppHeader` +
  `Toolbar` + the tagline/view-mode rows) and `EditorView.vue` (replacing
  its grid layout with the winning content arrangement).
- Delete `page-prototype/` and the `?pageVariant=` gate in `AppLayout.vue`.
- Decide `form-editor-prototype/`'s fate at the same time — the winning
  page variant already embeds `FormEditorVariantTree`, so once folded in,
  that whole folder collapses too (its role is fully absorbed).
