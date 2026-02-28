# FastSpec — Frontend Guide

> **Purpose:** This skill teaches an AI agent exactly how the FastSpec frontend works, where each concern lives, and how to implement new features without breaking existing ones.

---

## Architecture Summary

| Aspect | Current State |
|--------|--------------|
| Framework | Vue 3 Composition API (Options-style `export default` with `setup()`) |
| UI Library | PrimeVue 4 with Aura theme preset |
| State Management | Module-level `ref()` composable in `stores/auth.js` (no Pinia) |
| Routing | **None** — `main.js` uses URL query-param hack (`?token=` or `?error=`) |
| HTTP | Axios with interceptors for JWT auth |
| Code Editor | Monaco Editor (JSON mode) |
| Build | Vite 5 with Vue plugin, `@` alias to `src/` |
| Component communication | `provide/inject` from `App.vue` to children |

---

## Entry Point — `main.js`

```
main.js
  ├── if URL has ?token or ?error → mount OAuthCallback component
  └── else → mount App component
```

Key setup:
- `PrimeVue` with Aura theme
- `ConfirmationService` (for confirm dialogs)
- `ToastService` (for toast notifications)
- `v-tooltip` directive

**⚠️ No `vue-router` is used** despite being installed. All "navigation" is via `viewMode` ref in `App.vue`.

---

## Component Map

### `App.vue` (784 lines — God Component)

The root orchestrator. Contains ALL of:

| Concern | Refs/Functions |
|---------|---------------|
| Auth state | `isAuthenticated`, `initAuth()`, `showLoginDialog` |
| Spec editing | `specContent`, `parsedSpec`, `initialSpec`, `currentSpec` |
| Editor mode | `viewMode` (`form`/`code`/`preview`), `viewModeOptions` |
| Save logic | `saveSpec()`, `openSaveDialog()`, `showSaveDialog` |
| Validation | `validateCurrentSpec()` |
| Diff/OpenAPI file | `fetchOpenApiFile()`, `openapiFileDiff`, `copyOpenapiFileDiff()` |
| Alerts | `showAlert()`, `closeAlert()`, `alert` |
| Auto-save | `scheduleAutoSave()` (currently disabled) |
| Template | `loadTemplate()`, `newSpec()` |
| Token dialog | `showTokenDialog` |

**Provides to children via `provide()`:**
- `newSpec` → `Toolbar.vue`
- `openSaveDialog` → `Toolbar.vue`
- `validateCurrentSpec` → `EditorPanel.vue`
- `loadTemplate` → `Toolbar.vue`
- `togglePreview` → `Toolbar.vue`
- `viewMode` → `Toolbar.vue`
- `refreshSpecList` (counter ref) → `SpecList.vue`
- `showTokenDialog` → `Toolbar.vue`

### `Toolbar.vue` (167 lines)

Top bar with:
- **New** button → opens New Spec dialog (blank or template)
- **Save** button → calls `openSaveDialog()` via inject
- **Manage Tokens** button → calls `showTokenDialog()` via inject
- **UserProfile** component (when authenticated)

Injects: `newSpec`, `openSaveDialog`, `loadTemplate`, `togglePreview`, `toggleDiff`, `viewMode`, `showTokenDialog`

### `SpecList.vue` (584 lines)

Left sidebar showing saved specs:
- Lists specs with per-spec version dropdown
- Expand to show ID, user_id, dates
- Delete with confirmation dialog
- Version history drawer (right panel) with version comparison
- Emits `spec-selected` event to `App.vue`

Key behavior:
- On mount: fetches all specs + versions for each (N+1 API calls)
- Watches `refreshSpecList` inject to reload after save
- Auto-selects first spec on load

### `EditorPanel.vue` (127 lines)

Monaco Editor wrapper:
- Props: `modelValue` (string), `showValidate` (boolean)
- Emits: `update:modelValue`
- Injects: `validateCurrentSpec`
- Initializes Monaco with JSON language, vs-light theme

### `FormEditor.vue` (3287 lines)

Visual form editor with 4 tabs:
1. **Info** — title, version, description, contact, license
2. **Servers** — add/remove server entries
3. **Paths** — accordion of paths → method tabs → params/requestBody/responses
4. **Components** — schema builder with property editor + JSON tab

Features:
- Drag-and-drop reordering of paths, methods, and schema properties
- Deep watcher on `formData` auto-emits changes to parent
- Dialog-based path/method/schema creation

### `PreviewPanel.vue`

Renders the parsed spec as a documentation-style preview.

### `DiffDrawer.vue` (3465 lines)

Two rendering modes (controlled by `inline` prop):
- **Inline mode**: Renders directly in the page
- **Drawer mode**: PrimeVue Drawer sliding panel

Shows:
- Summary pills (Added/Modified/Removed counts)
- Filter by change type + search
- Endpoints section, Components/Schemas section, Info section, Servers section
- Click-to-open detail dialog with field-level changes, parameters tables, schema previews

### `SaveDialog.vue`

Modal for saving/versioning:
- Name input
- Version choice (create new or update existing)
- Emits `save` event with payload

### `LoginPage.vue`

OAuth login buttons (Google, GitHub). Can render inline in a dialog.

### `OAuthCallback.vue`

Handles the OAuth redirect: reads `?token=` from URL, stores in auth store, redirects.

### `TokenManager.vue`

API key management: create, list, revoke, update actions.

### `UserProfile.vue`

Avatar display + logout button.

---

## State Management — `stores/auth.js`

**Pattern:** Module-level `ref()` composable (singleton). Not Pinia.

```js
// Module scope — shared across ALL callers
const user = ref(null);
const token = ref(null);
const apiKey = ref(null);
const isLoading = ref(false);

export function useAuth() {
  const isAuthenticated = computed(() => !!token.value && !!user.value);
  // setAuth, clearAuth, initAuth methods
  return { user, token, apiKey, isLoading, isAuthenticated, setAuth, clearAuth, initAuth };
}
```

Storage: `localStorage` for `token`, `user` (JSON), `api_key`.

**Consumers:** `App.vue`, `Toolbar.vue`, `specs.js` (Axios interceptor), `LoginPage.vue`, `UserProfile.vue`, `OAuthCallback.vue`

---

## API Layer — `api/specs.js`

Axios instance with `baseURL: "/api/specs"`.

**Interceptors:**
- **Request**: Adds `Authorization: Bearer <token>` from `useAuth().token`
- **Response**: On 401, calls `clearAuth()` and redirects to `/`

**Exports:**
| Function | HTTP | Endpoint |
|----------|------|----------|
| `fetchSpecs()` | GET | `/` |
| `fetchSpec(id)` | GET | `/{id}` |
| `createSpec(data)` | POST | `/` |
| `updateSpec(id, data)` | PUT | `/{id}` |
| `deleteSpec(id)` | DELETE | `/{id}` |
| `validateSpec(spec_json)` | POST | `/validate` |
| `fetchDiff(id, format)` | GET | `/{id}/diff` |
| `listSpecVersions(specId)` | GET | `/{specId}/versions` |
| `createSpecVersion(specId, payload)` | POST | `/{specId}/versions` |
| `getSpecVersion(specId, versionOrId)` | GET | `/{specId}/versions/{versionOrId}` |
| `deleteSpecVersion(specId, versionOrId)` | DELETE | `/{specId}/versions/{versionOrId}` |
| `compareSpecVersions(specId, base, compare)` | POST | `/{specId}/compare` |
| `publishSpecVersion(specId, versionOrId)` | POST | `/{specId}/versions/{versionOrId}/publish` |
| `updateSpecVersion(specId, versionId, payload)` | PUT | `/{specId}/versions/{versionId}` |
| `fetchOpenApi()` | GET | `/openapi.json` (public, not through `/api/specs`) |

**⚠️ Known issue:** `updateSpecVersion` is declared before `import` statements (line 1). Works due to ES module hoisting but is fragile.

---

## Utils

### `diffUtils.js`
`compareSpecs(oldSpec, newSpec)` → Returns diff object with `added`, `removed`, `modified`, `infoAdded`, `infoModified`, `infoRemoved`, `schemaAdded`, `schemaModified`, `schemaRemoved`, `serverAdded`, `serverModified`, `serverRemoved`.

### `markdownGenerator.js`
`generateMarkdownReport(diff)` → Converts diff object to formatted markdown string.

---

## Vite Configuration

- Dev server: `0.0.0.0:3000`
- Proxy: `/api` → `http://backend:8000`, `/auth` → `http://backend:8000`
- `historyApiFallback: true` (for future SPA routing)
- Alias: `@` → `./src`

---

## How to Add a New Feature

### Adding a new toolbar button
1. Add the action function in `App.vue` `setup()`
2. `provide()` it with a descriptive name
3. In `Toolbar.vue`, `inject()` it and wire to a `<Button>`

### Adding a new API call
1. Add the function to `api/specs.js` (after imports and `api` instance)
2. Import it where needed (static import, not dynamic)

### Adding a new form editor tab
1. Currently requires editing `FormEditor.vue` (3287 lines)
2. Add a `<Tab>` entry and corresponding `<TabPanel>` with form fields

### Adding a new view/page
1. Currently: toggle `viewMode` ref value in `App.vue`
2. **Future (after refactor):** Add a route in `router/index.js` and a view in `views/`

---

## Known Technical Debt

- `App.vue` is a God Component (784 lines, 8+ concerns)
- `FormEditor.vue` is 3287 lines — should split into tab sub-components
- `DiffDrawer.vue` is 3465 lines — duplicated template for inline vs drawer mode
- No Vue Router (installed but unused)
- No Pinia (module-level refs instead)
- `provide/inject` used instead of props for 8+ values
- Debug `console.log` statements left in `DiffDrawer.vue` (~80 lines)
- Two `onMounted()` calls in `App.vue`
- Dynamic `import()` in `saveSpec()` instead of static imports
- Dead code in `SpecList.vue` (`updateVersionDropdown`, `onVersionChange`)

See [`plans/frontend_maintainability_plan.md`](plans/frontend_maintainability_plan.md) for the full refactoring roadmap.
