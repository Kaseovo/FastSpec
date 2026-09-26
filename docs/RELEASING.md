# Releasing FastSpec

FastSpec follows [Semantic Versioning](https://semver.org). While the
version is `0.x`, minor releases may include breaking changes; they're
called out in the changelog.

`backend/version.py` is the single source of the version number.

## Cutting a release

1. Move the **Unreleased** entries in [CHANGELOG.md](../CHANGELOG.md) under
   a new heading for the version, with today's date, and merge that to
   `main`.
2. Run **Actions → Release → Run workflow** on `main`, choosing `patch`,
   `minor` or `major`.

The workflow then:

- bumps `backend/version.py`, commits `Release vX.Y.Z` and pushes the
  `vX.Y.Z` tag;
- builds the Docker image for `linux/amd64` and `linux/arm64` and pushes it
  to `ghcr.io/kaseovo/fastspec` as `X.Y.Z`, `X.Y` and `latest`;
- creates the GitHub Release with generated notes.

Pushing a `vX.Y.Z` tag yourself (after bumping `backend/version.py` in the
tagged commit) runs the same publishing steps. The workflow refuses to
publish if the tag and `backend/version.py` disagree.

If `main` gets branch protection, allow the GitHub Actions bot to push the
release commit, or bump the version in a pull request and push the tag
yourself.

## Deploying the hosted version

Deploying to AWS is separate: run **Deploy to AWS** on `main` after the
release (see [DEPLOYMENT.md](DEPLOYMENT.md)).
