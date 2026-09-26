# Contributing to FastSpec

Thanks for helping! Bug reports, fixes, docs and features are all welcome.

- **Bugs and ideas**: open an [issue](https://github.com/Kaseovo/FastSpec/issues).
  For anything bigger than a small fix, please open an issue first so we
  can agree on the approach before you invest time in it.
- **Security problems**: don't open a public issue — see
  [SECURITY.md](SECURITY.md).

## Development setup

You need Python 3.12 and Node.js 22. Docker is only needed to build the
image.

```bash
make setup   # .venv + backend and frontend dependencies
make dev     # backend (auto-reload) + Vite → http://localhost:5173/specs/
```

`make dev` runs in single-user mode with SQLite in `./.data`, so there's
nothing to configure. `make help` lists everything else.

| Path | What's there |
|---|---|
| `backend/` | FastAPI app, MCP server (`fastmcp_server/`), Alembic migrations, tests |
| `frontend/` | Vue 3 + PrimeVue single-page app |
| `infra/` | AWS CDK stacks for the serverless deployment |
| `docs/` | Guides, and architecture decisions in `docs/adr/` |

## Before you open a pull request

```bash
make test   # backend (pytest) and frontend (vitest)
make lint   # ruff (backend) and ESLint (frontend)
```

CI also runs the backend tests against Postgres, the infra tests, and a
Docker build with a smoke test. To run the Postgres tests locally, see
[AGENTS.md](AGENTS.md#backend-pytest).

A few conventions:

- **Tests** come with every behaviour change or bug fix.
- **Database changes** need an Alembic migration that works on both SQLite
  and Postgres: use `sa.func` / `sa.true()` / `sa.false()` for server
  defaults and `op.batch_alter_table` for constraint changes
  ([ADR-0007](docs/adr/0007-sqlite-and-postgres.md)). `alembic check` in
  the test suite fails if `models.py` and the migrations drift apart.
- **Backend dependencies**: edit `backend/requirements*.in`, then run
  `make deps` (needs [uv](https://docs.astral.sh/uv/)) to update the pinned
  `requirements*.txt`.
- **Significant design decisions** get a short ADR in `docs/adr/`.
- **Commit messages** follow the existing style: `feat: …`, `fix: …`,
  `docs: …`, `test: …`, `chore: …`, with a body explaining *why* when it
  isn't obvious.
- **User-facing changes** get a line under *Unreleased* in
  [CHANGELOG.md](CHANGELOG.md).

## Licensing

FastSpec is licensed under the [AGPL-3.0](LICENSE). By submitting a
contribution, you agree that it's licensed under the same terms.
