"""
FastAPI main application for FastSpec
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from contextlib import asynccontextmanager

from database import engine, Base
from routers import specs, auth


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Create database tables
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="FastSpec API",
    description="OpenAPI Specification Editor and Validator with OAuth2 Authentication",
    version="2.0.0",
    lifespan=lifespan,
    root_path=os.getenv("ROOT_PATH", ""),
)

# Session middleware for OAuth (required by Authlib)
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv(
        "JWT_SECRET_KEY", "your-super-secret-jwt-key-change-in-production"
    ),
)

# CORS middleware
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth.router, tags=["authentication"])
app.include_router(specs.router, prefix="/specs", tags=["specs"])


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}


@app.get("/openapi.json")
async def get_openapi():
    """Serve OpenAPI spec with logging"""
    import logging

    try:
        spec = app.openapi()
        logging.info(f"OpenAPI spec keys: {list(spec.keys())}")
        logging.info(f"Has openapi: {'openapi' in spec}")
        if "openapi" in spec:
            logging.info(f"OpenAPI version: {spec['openapi']}")
        else:
            logging.warning("OpenAPI spec missing 'openapi' field")
        return spec
    except Exception as e:
        logging.error(f"Error generating OpenAPI spec: {e}")
        return {"error": str(e)}


@app.get("/debug/openapi")
async def debug_openapi():
    """Debug endpoint to return OpenAPI spec"""
    try:
        spec = app.openapi()
        return {
            "openapi_version": app.openapi_version,
            "spec_keys": list(spec.keys()),
            "has_openapi": "openapi" in spec,
            "spec": spec,
        }
    except Exception as e:
        return {"error": str(e), "type": type(e).__name__}
