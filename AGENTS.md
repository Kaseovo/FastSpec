# FastSpec — Agent Instructions

## Testing & Verification

Use the commands below to run tests and verify correctness after making changes.
Always run the relevant test suite before considering a task complete.

---

### Backend (pytest)

```bash
# Run all backend tests
cd backend && python -m pytest tests

# Run a single test file
cd backend && python -m pytest tests/test_specs_api.py

# Run a specific test by name
cd backend && python -m pytest tests/test_specs_api.py::test_create_spec

# Run with verbose output
cd backend && python -m pytest tests -v

# Run with short traceback (less noise)
cd backend && python -m pytest tests --tb=short
```

**Requirements:** the `.venv` virtual environment (created by `make setup`,
with `backend/requirements-dev.txt`) must be active, or use the full path:

```bash
.venv/bin/pytest tests
```

The Postgres variants of `tests/test_alembic_migrations.py` are skipped unless
`TEST_POSTGRES_URL` points at a Postgres server the tests may create/drop
databases on (CI provides one):

```bash
docker run -d --name pg -e POSTGRES_USER=fastspec -e POSTGRES_PASSWORD=fastspec \
  -e POSTGRES_DB=fastspec -p 127.0.0.1:55432:5432 postgres:16-alpine
cd backend && TEST_POSTGRES_URL=postgresql://fastspec:fastspec@localhost:55432/fastspec \
  python -m pytest tests/test_alembic_migrations.py
```

The interpreter path is configured in `.vscode/settings.json` as
`${workspaceFolder}/.venv/bin/python`.

---

### Frontend (Vitest)

```bash
# Run all frontend tests (single pass)
cd frontend && npm test

# Run a single test file
cd frontend && npm test -- src/api/specs.test.js

# Run tests matching a name pattern
cd frontend && npm test -- --reporter=verbose -t "LintPanel"

# Watch mode (re-runs on file change — useful during development, not for CI loops)
cd frontend && npm run test:watch
```

Config: `frontend/vitest.config.js` — uses `jsdom` environment with `globals: true`.

---

### Running both in one shot

```bash
make test
```

### Running the app

```bash
make dev   # backend + Vite → http://localhost:5173/specs/ (single-user mode, SQLite in ./.data)
```

No sign-in is needed in single-user mode (`AUTH_MODE=none`, the default), so
headless-browser checks can open the app directly. See `docs/SELF_HOSTING.md`
for OIDC and Postgres.

---

### Interpreting results

| Output | Meaning |
|--------|---------|
| `X passed` | All tests green — safe to proceed |
| `X failed` | Fix failures before marking task done |
| `AxiosError: Network Error` | MockAdapter is wrapping the wrong axios instance — use the exported `api` instance from `src/api/specs.js` |
| `[🍍] getActivePinia()` | Pinia not initialised in test — add `setActivePinia(createPinia())` in `beforeEach` |
| `No PrimeVue Confirmation provided` | Mount missing `plugins: [PrimeVue, ConfirmationService]` in `global` |
| `jest is not defined` | Replace `jest.*` with `vi.*` (Vitest uses `vi`, not `jest`) |
