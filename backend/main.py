"""
FastAPI main application for FastSpec
"""

import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from contextlib import asynccontextmanager

from .database import engine, Base
from .routers import specs, auth


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
app.include_router(specs.router, prefix="/api", tags=["specs"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "FastSpec API",
        "version": "2.0.0",
        "authentication": "OAuth2 (Google, GitHub)",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
