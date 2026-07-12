"""
FastAPI main application for FastSpec

Schema management is handled by Alembic migrations — run
``alembic upgrade head`` before starting the application.
"""

from config import settings

import logging
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from database import SessionLocal
from routers import specs, auth
from routers import lint
from validation.spectral_client import SpectralError

logger = logging.getLogger(__name__)

from version import __version__

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


@app.get("/version")
async def get_version():
    return {"version": __version__}


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
    detect a stopped/waking RDS instance — see /health/ready for that."""
    return {"status": "healthy"}


@app.get("/health/ready")
async def readiness_check():
    """Readiness check: confirms the database is actually reachable, so a
    stopped/waking RDS instance (see the Wake/AutoStop stack) surfaces as a
    503 here instead of the caller discovering it via a hung request."""
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        return {"status": "ready"}
    except Exception:
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={"status": "not_ready", "detail": "database unavailable"},
        )
    finally:
        db.close()
