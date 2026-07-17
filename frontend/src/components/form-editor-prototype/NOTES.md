# Form Editor design-direction prototype

**Question:** what should the Form Editor look like to feel distinct from
competitors (Swagger Editor, Stoplight, Postman's spec editor), and to scale
to specs with hundreds of paths/schemas instead of just looking fine on the
Petstore demo?

**Where:** existing `/specs` route, sub-shape A — real data, real auth, real
`SpecList`/toolbar around it. Switch variants with `?variant=`, dev-only
(`import.meta.env.DEV` gate in `EditorView.vue`), floating switcher
bottom-center.

## Variants

- **`rail`** — VS Code–style dark icon rail replaces the horizontal tabs.
  Count badges sit on each icon; breadcrumb + Live Preview toggle in a slim
  top bar. Most compact, most "IDE" in feel.
- **`tree`** — no tabs at all. Left panel is a search box + a real
  path/schema tree (not just section names — actual `/pet/{petId}` and
  `Order`/`Category`/`User` schema entries, so it reads as genuinely built
  for large specs rather than a demo). Right pane shows the selected
  section's existing tab component.
- **`dashboard`** — dark stats strip (paths/schemas/tags/security counts) +
  bold colored pill nav below it. Leans editorial/at-a-glance; the boldest
  color identity of the three, most different from the competitors' mostly
  monochrome chrome.

All three reuse the exact same `useFormEditorState` composable (extracted
from `FormEditor.vue` for this purpose — it stayed extracted regardless of
which variant wins, since it's a clean win on its own: one implementation of
the data-wiring logic, testable independent of any particular layout) and
the same six tab components (`ApiInfoTab`, `ServersTab`, `PathsTab`,
`TagsTab`, `ComponentsTab`, `SecurityTab`) unmodified — only the surrounding
navigation chrome differs between variants.

**Gotcha hit while building this:** `setup()` returning a plain object under
a `state` key (`return { state: useFormEditorState(...), ... }`) does not
get Vue's ref-auto-unwrapping — templates using `state.formData` receive the
raw `Ref` object, not its value, and worse, some of PathsTab/ComponentsTab's
own `...props.api` spread-at-setup-time tricks silently break if `state` is
wrapped in `reactive()` instead (spreading a reactive proxy freezes computed
refs to a snapshot). Fix: spread the composable's return at the *top level*
of `setup()`'s return (`return { ...state, ... }`), matching the convention
`FormEditor.vue` already used. Worth remembering if this pattern comes up
again elsewhere in the app.

## Verdict

**Not yet decided** — flip through `http://localhost/specs/?variant=rail`,
`?variant=tree`, `?variant=dashboard` (or `:5174` if using the native host
dev server) and pick one, or ask for "the tree's left nav with the
dashboard's stats strip" style mixing. Once decided:

- Fold the winning variant's template/CSS into `FormEditor.vue` (which
  already delegates its logic to `useFormEditorState` — only the template
  needs replacing).
- Delete this whole `form-editor-prototype/` folder and the
  `FormEditorPrototypeHost`/`?variant=` wiring in `EditorView.vue`.
- Keep `useFormEditorState.js` regardless — it's a real improvement
  independent of which layout wins.
