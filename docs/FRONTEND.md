# Frontend Implementation

Location: `frontend/`

Overview

- Frontend is a Vue 3 application scaffolded with Vite. It provides the editor UI, preview, diff drawer and authentication flows.

Key files and folders

- `frontend/src/main.js` — app bootstrap and store setup.
- `frontend/src/App.vue` — root component.
- `frontend/src/api/` — API wrappers: `auth.js` and `specs.js` to call backend endpoints.
- `frontend/src/components/` — UI components: `EditorPanel.vue`, `PreviewPanel.vue`, `DiffDrawer.vue`, `SpecList.vue`, `LoginPage.vue`, and others.
- `frontend/src/stores/auth.js` — simple store for auth state (likely Pinia or Vuex pattern using plain JS module).
- `frontend/src/utils/` — helper utilities: `diffUtils.js`, `markdownGenerator.js`.

Editor UX

- `FormEditor.vue` and `EditorPanel.vue` handle editing of spec content and emitting save/validate actions.
- `DiffDrawer.vue` shows diffs returned by /specs/diff and highlights changes.

Authentication

- `LoginPage.vue` triggers login flows via `frontend/src/api/auth.js`.
- OAuth callback handled by `OAuthCallback.vue` which exchanges codes and stores tokens via the auth store.

Local development

- Serve dev server with `npm run dev` from `frontend/`.
- Build production assets with `npm run build` and preview with `npm run preview`.

Extending frontend

- Add new components under `frontend/src/components/` and corresponding API calls under `frontend/src/api/`.
- The `stores` folder centralizes client-side auth/user state.
