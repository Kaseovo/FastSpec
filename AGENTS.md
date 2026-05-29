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

**Requirements:** the `.venv` virtual environment must be active, or use the full path:

```bash
.venv/bin/pytest tests
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
cd backend && python -m pytest tests --tb=short && cd ../frontend && npm test
```

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
