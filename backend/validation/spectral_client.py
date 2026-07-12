"""
SpectralClient seam — ADR-0003.

Provides an injectable abstraction over the Spectral CLI transport so that:
- Tests can use FakeSpectralClient without a live Spectral process.
- Production can switch between subprocess and HTTP sidecar via SPECTRAL_MODE.

Public API
----------
SpectralError       — raised by all adapters on lint failure
SpectralClient      — Protocol; one method: lint(spec_json, ruleset_yaml) -> dict
SubprocessSpectralClient — wraps subprocess.run(); used when SPECTRAL_MODE=subprocess
HttpSpectralClient  — calls the Spectral Sidecar via POST /lint; SPECTRAL_MODE=http
get_spectral_client — factory; selects adapter from SPECTRAL_MODE env var
"""

import json
import logging
import os
import subprocess
import tempfile
from typing import Any, Dict, List, Optional
from typing import Protocol, runtime_checkable

import httpx

from config import settings
from validation.spectral_linter import _build_command, _parse_result

logger = logging.getLogger(__name__)


class SpectralError(RuntimeError):
    """Raised by SpectralClient adapters when linting fails."""


@runtime_checkable
class SpectralClient(Protocol):
    def lint(self, spec_json: dict, ruleset_yaml: str) -> dict:
        """
        Lint *spec_json* using *ruleset_yaml* and return a parsed result dict.

        Returns:
            dict with keys: score (int), summary (dict), results (list).

        Raises:
            SpectralError: on any transport or process failure.
        """
        ...


class SubprocessSpectralClient:
    """
    Invoke the Spectral CLI as a subprocess.

    Used in the ``local`` Deployment Environment (developer machines, CI
    without a sidecar) when ``SPECTRAL_MODE=subprocess``.
    """

    def __init__(self, timeout: int = 60) -> None:
        self._timeout = timeout

    def lint(self, spec_json: dict, ruleset_yaml: str) -> dict:
        tmp_spec_path: Optional[str] = None
        tmp_ruleset_path: Optional[str] = None
        try:
            with tempfile.NamedTemporaryFile(
                mode="w", suffix=".json", delete=False, encoding="utf-8"
            ) as tmp_spec:
                json.dump(spec_json, tmp_spec, indent=2)
                tmp_spec_path = tmp_spec.name

            with tempfile.NamedTemporaryFile(
                mode="w",
                suffix=".spectral.yaml",
                delete=False,
                encoding="utf-8",
            ) as tmp_ruleset:
                tmp_ruleset.write(ruleset_yaml)
                tmp_ruleset_path = tmp_ruleset.name

            cmd = _build_command(tmp_spec_path, tmp_ruleset_path)
            logger.debug("Running Spectral subprocess: %s", " ".join(cmd))

            try:
                proc = subprocess.run(
                    cmd,
                    capture_output=True,
                    text=True,
                    timeout=self._timeout,
                )
            except subprocess.TimeoutExpired:
                raise SpectralError(
                    f"Spectral CLI timed out after {self._timeout} seconds"
                )
            except FileNotFoundError as exc:
                raise SpectralError(
                    "Spectral CLI not found. Ensure SPECTRAL_PATH is set."
                ) from exc

            if proc.returncode >= 2:
                raise SpectralError(
                    f"Spectral CLI failed (exit {proc.returncode}): {proc.stderr.strip()}"
                )

            stdout = proc.stdout.strip()
            if not stdout:
                return {
                    "score": 100,
                    "summary": {"error": 0, "warn": 0, "info": 0, "hint": 0},
                    "results": [],
                }

            try:
                raw = json.loads(stdout)
            except json.JSONDecodeError as exc:
                raise SpectralError(
                    f"Failed to parse Spectral output as JSON: {exc}\nOutput: {stdout[:500]}"
                ) from exc

            return _parse_result(raw)

        finally:
            for path in (tmp_spec_path, tmp_ruleset_path):
                if path:
                    try:
                        os.unlink(path)
                    except OSError:
                        pass


class HttpSpectralClient:
    """
    Call the Spectral Sidecar over HTTP.

    Used in ``prod`` when ``SPECTRAL_MODE=http``.
    The sidecar URL is read from the ``SPECTRAL_SIDECAR_URL`` environment
    variable (default: ``http://localhost:3001``).
    """

    def __init__(
        self,
        base_url: Optional[str] = None,
        timeout: int = 60,
    ) -> None:
        self._base_url = base_url or settings.spectral_sidecar_url
        self._timeout = timeout

    def lint(self, spec_json: dict, ruleset_yaml: str) -> dict:
        url = f"{self._base_url.rstrip('/')}/lint"
        payload = {"spec": spec_json, "ruleset": ruleset_yaml}
        logger.debug("Calling Spectral sidecar: POST %s", url)
        try:
            response = httpx.post(url, json=payload, timeout=self._timeout)
            response.raise_for_status()
        except httpx.TimeoutException:
            raise SpectralError(
                f"Spectral sidecar timed out after {self._timeout} seconds"
            )
        except httpx.HTTPError as exc:
            raise SpectralError(f"Spectral sidecar HTTP error: {exc}") from exc

        data = response.json()
        # The sidecar returns already-parsed JSON; if it returns raw Spectral
        # output (a list) we parse it ourselves, otherwise pass it through.
        if isinstance(data, list):
            return _parse_result(data)
        return data


def get_spectral_client(mode: Optional[str] = None) -> SpectralClient:
    """
    Factory — return a SpectralClient for the requested (or configured) mode.

    Args:
        mode: ``"subprocess"`` | ``"http"``. When *None*, reads ``SPECTRAL_MODE``
              from the environment (default: ``"subprocess"``).

    Returns:
        A concrete SpectralClient instance.

    Raises:
        ValueError: if *mode* is not a recognised value.
    """
    resolved = mode or settings.spectral_mode
    if resolved == "subprocess":
        return SubprocessSpectralClient()
    if resolved == "http":
        return HttpSpectralClient()
    raise ValueError(
        f"Unknown SPECTRAL_MODE '{resolved}'. Expected 'subprocess' or 'http'."
    )


def spectral_client_dependency() -> SpectralClient:
    """
    FastAPI dependency wrapper around get_spectral_client().

    get_spectral_client() takes a `mode` parameter, and FastAPI's dependency
    injection exposes any plain-function dependency's parameters as public
    request inputs (query params for primitives). Using get_spectral_client
    directly as `Depends(get_spectral_client)` therefore let callers pass
    `?mode=subprocess` and force the lint transport. This zero-argument
    wrapper is the one that should be used as a FastAPI dependency; call
    get_spectral_client(mode=...) directly (not through DI) if a specific
    mode is ever needed programmatically.
    """
    return get_spectral_client()
