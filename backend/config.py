"""
Central configuration for FastSpec backend.

Consolidates the environment variables that were previously read ad hoc via
os.getenv() scattered across config.py, main.py, auth/jwt.py, routers/auth.py,
validation/spectral_client.py and validation/spectral_linter.py (each with its
own inline default) — see docs/CODE_REVIEW.md §3. JWT_SECRET_KEY keeps the
fail-fast behavior this module has always had: the app must not silently
start with a known, insecure default secret.
"""

import sys

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # --- JWT / auth ---
    jwt_secret_key: str = Field(alias="JWT_SECRET_KEY")
    jwt_algorithm: str = Field("HS256", alias="JWT_ALGORITHM")
    jwt_access_token_expire_minutes: int = Field(60, alias="JWT_ACCESS_TOKEN_EXPIRE_MINUTES")
    api_key_ttl_days: int = Field(30, alias="API_KEY_TTL_DAYS")
    short_jwt_ttl_seconds: int = Field(300, alias="SHORT_JWT_TTL_SECONDS")

    # --- Google OAuth ---
    google_client_id: str | None = Field(None, alias="GOOGLE_CLIENT_ID")
    google_client_secret: str | None = Field(None, alias="GOOGLE_CLIENT_SECRET")
    google_redirect_uri: str = Field(
        "http://localhost:3000/auth/google/callback", alias="GOOGLE_REDIRECT_URI"
    )

    # --- Frontend / CORS ---
    frontend_url: str = Field("http://localhost:3000", alias="FRONTEND_URL")
    cors_origins: str = Field("http://localhost:3000", alias="CORS_ORIGINS")

    # --- Spectral linting ---
    spectral_mode: str = Field("subprocess", alias="SPECTRAL_MODE")
    spectral_sidecar_url: str = Field("http://localhost:3001", alias="SPECTRAL_SIDECAR_URL")
    spectral_path: str | None = Field(None, alias="SPECTRAL_PATH")

    # --- ASGI ---
    root_path: str = Field("", alias="ROOT_PATH")

    @property
    def cors_origins_list(self) -> list[str]:
        return self.cors_origins.split(",")


try:
    settings = Settings()
except Exception:
    print("FATAL: JWT_SECRET_KEY environment variable is required", file=sys.stderr)
    sys.exit(1)

# Kept for the handful of call sites that only need the JWT secret/algorithm.
JWT_SECRET_KEY = settings.jwt_secret_key
JWT_ALGORITHM = settings.jwt_algorithm
