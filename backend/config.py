"""
Central configuration for FastSpec backend.

Consolidates the environment variables that were previously read ad hoc via
os.getenv() scattered across config.py, main.py, auth/jwt.py, routers/auth.py,
validation/spectral_client.py and validation/spectral_linter.py (each with its
own inline default) — see docs/history/2026-07-code-review.md §3.

Two fail-fast rules this module enforces at import time:

- The app must never start with a known, insecure JWT secret. Either
  JWT_SECRET_KEY is set, or FASTSPEC_DATA_DIR is set and a random secret is
  generated once and persisted there (self-hosted quickstart).
- The auth configuration must be unambiguous. Contradictory settings (e.g.
  OIDC_* values present while AUTH_MODE is "none") refuse to start rather
  than silently running without authentication — see docs/adr/0006-auth-modes.md.
"""

import os
import secrets
import sys
from pathlib import Path
from typing import Literal

from pydantic import Field, ValidationError
from pydantic_settings import BaseSettings, SettingsConfigDict

GOOGLE_ISSUER = "https://accounts.google.com"
JWT_SECRET_FILENAME = "jwt_secret"
# The repository-root .env (see .env.example), wherever the process starts.
# FASTSPEC_ENV_FILE overrides it (tests point it at os.devnull).
ENV_FILE = os.environ.get("FASTSPEC_ENV_FILE") or Path(__file__).resolve().parent.parent / ".env"


class ConfigError(ValueError):
    """Raised when the environment describes an invalid or unsafe setup."""


def _split_csv(value: str) -> list[str]:
    return [item.strip() for item in value.split(",") if item.strip()]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=ENV_FILE, extra="ignore")

    # --- JWT / auth ---
    jwt_secret_key: str | None = Field(None, alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field("HS256", alias="JWT_ALGORITHM")
    jwt_access_token_expire_minutes: int = Field(60, alias="JWT_ACCESS_TOKEN_EXPIRE_MINUTES")
    api_key_ttl_days: int = Field(30, alias="API_KEY_TTL_DAYS")
    short_jwt_ttl_seconds: int = Field(300, alias="SHORT_JWT_TTL_SECONDS")

    # --- Auth mode (docs/adr/0006-auth-modes.md) ---
    auth_mode: Literal["none", "oidc"] = Field("none", alias="AUTH_MODE")
    oidc_issuer: str | None = Field(None, alias="OIDC_ISSUER")
    oidc_client_id: str | None = Field(None, alias="OIDC_CLIENT_ID")
    oidc_client_secret: str | None = Field(None, alias="OIDC_CLIENT_SECRET")
    oidc_provider_name: str | None = Field(None, alias="OIDC_PROVIDER_NAME")
    oidc_scopes: str = Field("openid email profile", alias="OIDC_SCOPES")
    allowed_emails: str = Field("", alias="ALLOWED_EMAILS")
    allowed_email_domains: str = Field("", alias="ALLOWED_EMAIL_DOMAINS")

    # --- Public URL / CORS ---
    # Origin users reach FastSpec at. Used to build the OIDC redirect URI and
    # as the default CORS origin.
    public_url: str = Field("http://localhost:8080", alias="PUBLIC_URL")
    cors_origins: str | None = Field(None, alias="CORS_ORIGINS")

    # --- Storage ---
    # Postgres (or any SQLAlchemy URL). When unset: SQLite in data_dir. The
    # AWS deployment loads it from SSM at cold start (lambda_handler.py).
    database_url: str | None = Field(None, alias="DATABASE_URL")
    # Directory for the SQLite database and the generated JWT secret.
    data_dir: str | None = Field(None, alias="FASTSPEC_DATA_DIR")

    # --- Self-hosting ---
    # Built SPA (frontend/dist). When set, the backend serves it under /specs.
    static_dir: str | None = Field(None, alias="FASTSPEC_STATIC_DIR")

    # --- Source code (AGPL-3.0 §13) ---
    # Shown in the app so everyone using this instance can get its source.
    # If you run a modified FastSpec for others, point this at your changes.
    source_url: str = Field("https://github.com/Kaseovo/FastSpec", alias="SOURCE_URL")

    # --- Spectral linting ---
    spectral_mode: str = Field("subprocess", alias="SPECTRAL_MODE")
    spectral_sidecar_url: str = Field("http://localhost:3001", alias="SPECTRAL_SIDECAR_URL")
    spectral_path: str | None = Field(None, alias="SPECTRAL_PATH")

    # --- Notifications ---
    # SNS topic told about every first sign-in (notifications.py). Set by the
    # AWS deployment; unset means no notifications.
    signup_topic_arn: str | None = Field(None, alias="SIGNUP_TOPIC_ARN")

    # --- ASGI ---
    root_path: str = Field("", alias="ROOT_PATH")

    @property
    def cors_origins_list(self) -> list[str]:
        if self.cors_origins:
            return _split_csv(self.cors_origins)
        return [self.public_url.rstrip("/")]

    @property
    def oidc_redirect_uri(self) -> str:
        return f"{self.public_url.rstrip('/')}/auth/oidc/callback"

    @property
    def oidc_provider_key(self) -> str:
        """Value stored in users.provider for OIDC accounts.

        Google keeps the historical "google" key so accounts created before
        the move to generic OIDC keep matching (same issuer, same `sub`).
        """
        if self.oidc_issuer and self.oidc_issuer.rstrip("/") == GOOGLE_ISSUER:
            return "google"
        return "oidc"

    @property
    def oidc_display_name(self) -> str:
        if self.oidc_provider_name:
            return self.oidc_provider_name
        return "Google" if self.oidc_provider_key == "google" else "SSO"

    @property
    def allowed_emails_list(self) -> list[str]:
        return [e.lower() for e in _split_csv(self.allowed_emails)]

    @property
    def allowed_email_domains_list(self) -> list[str]:
        return [d.lower().lstrip("@") for d in _split_csv(self.allowed_email_domains)]

    def validate_auth(self) -> None:
        """Reject contradictory or incomplete auth configuration."""
        oidc_values = {
            "OIDC_ISSUER": self.oidc_issuer,
            "OIDC_CLIENT_ID": self.oidc_client_id,
            "OIDC_CLIENT_SECRET": self.oidc_client_secret,
        }
        allowlist_set = bool(self.allowed_emails_list or self.allowed_email_domains_list)

        if self.auth_mode == "none":
            present = [name for name, value in oidc_values.items() if value]
            if present:
                raise ConfigError(
                    f"{', '.join(present)} set but AUTH_MODE is 'none'. Set "
                    "AUTH_MODE=oidc to enable sign-in, or remove the OIDC_* "
                    "variables to run in single-user mode."
                )
            if allowlist_set:
                raise ConfigError(
                    "ALLOWED_EMAILS / ALLOWED_EMAIL_DOMAINS only apply when "
                    "AUTH_MODE=oidc; in 'none' mode anyone who can reach the "
                    "server has access."
                )
        else:
            missing = [name for name, value in oidc_values.items() if not value]
            if missing:
                raise ConfigError(
                    f"AUTH_MODE=oidc requires {', '.join(missing)}."
                )


def _resolve_jwt_secret(s: Settings) -> None:
    """Fill in jwt_secret_key from FASTSPEC_DATA_DIR when not set explicitly.

    The secret is generated once and persisted, so sessions and API-key JWTs
    survive restarts. O_EXCL makes concurrent first starts (several workers)
    agree on a single secret.
    """
    if s.jwt_secret_key:
        return
    if not s.data_dir:
        raise ConfigError(
            "JWT_SECRET_KEY is required (or set FASTSPEC_DATA_DIR to have one "
            "generated and stored there)."
        )
    path = Path(s.data_dir) / JWT_SECRET_FILENAME
    path.parent.mkdir(parents=True, exist_ok=True)
    try:
        fd = os.open(path, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    except FileExistsError:
        s.jwt_secret_key = path.read_text().strip()
        return
    secret = secrets.token_hex(32)
    with os.fdopen(fd, "w") as f:
        f.write(secret)
    s.jwt_secret_key = secret


def load_settings(**overrides) -> Settings:
    """Build and validate Settings; raises ConfigError on invalid config."""
    try:
        s = Settings(**overrides)
    except ValidationError as exc:
        raise ConfigError(str(exc)) from exc
    _resolve_jwt_secret(s)
    s.validate_auth()
    return s


try:
    settings = load_settings()
except ConfigError as exc:
    print(f"FATAL: invalid configuration: {exc}", file=sys.stderr)
    sys.exit(1)

# Kept for the handful of call sites that only need the JWT secret/algorithm.
JWT_SECRET_KEY = settings.jwt_secret_key
JWT_ALGORITHM = settings.jwt_algorithm
