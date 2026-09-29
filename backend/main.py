"""
FastAPI main application for FastSpec

Schema management is handled by Alembic migrations — run
``alembic upgrade head`` before starting the application.
"""

import logging

from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from config import settings
from database import SessionLocal
from routers import auth, lint, specs
from validation.spectral_client import SpectralError
from version import __version__

logger = logging.getLogger(__name__)

if settings.auth_mode == "none":
    logger.warning(
        "AUTH_MODE=none: single-user mode without sign-in. Anyone who can "
        "reach this server has full access — keep it on localhost or a "
        "trusted network, or set AUTH_MODE=oidc."
    )

app = FastAPI(
    title="FastSpec API",
    description="OpenAPI Specification Editor and Validator with OAuth2 Authentication",
    version=__version__,
    root_path=settings.root_path,
)


@app.exception_handler(SpectralError)
async def spectral_error_handler(request: Request, exc: SpectralError):
    """Single conversion point for SpectralError -> HTTP 502, replacing the
    three identical try/except blocks previously duplicated across the lint
    router's endpoints."""
    logger.error("Spectral lint failed: %s", exc)
    return JSONResponse(
        status_code=status.HTTP_502_BAD_GATEWAY,
        content={"detail": f"Linting failed: {exc}"},
    )


def database_unavailable() -> JSONResponse:
    """503 for a database the app can't reach, rather than a 500."""
    return JSONResponse(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        content={
            "status": "not_ready",
            "code": "database_unavailable",
            "detail": "The database is unavailable, please try again shortly.",
        },
    )


@app.exception_handler(OperationalError)
async def database_error_handler(request: Request, exc: OperationalError):
    logger.warning("Database unavailable: %s", exc)
    return database_unavailable()


@app.get("/version")
async def get_version():
    return {"version": __version__, "source_url": settings.source_url}


# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, prefix="/auth", tags=["authentication"])
app.include_router(specs.router, prefix="/specs", tags=["specs"])
app.include_router(lint.router, prefix="/lint", tags=["lint"])


@app.get("/health")
async def health_check():
    """Liveness check: process is up. Does not touch the DB, so it cannot
    detect an unreachable database — see /health/ready for that."""
    return {"status": "healthy"}


@app.get("/health/ready")
def readiness_check():
    """Readiness check: confirms the database is actually reachable, so an
    unreachable database surfaces as a 503 here instead of the caller
    discovering it via a failed request."""
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception:
        return database_unavailable()
    finally:
        db.close()
