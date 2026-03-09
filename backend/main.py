"""
FastAPI main application for FastSpec
"""

from config import JWT_SECRET_KEY

import os
import sys
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.sessions import SessionMiddleware
from contextlib import asynccontextmanager

from database import engine, Base
from routers import specs, auth
from routers import lint

# ensure SHORT_LIVED_JWT_EXP_SECONDS is read and available via env
_ = int(os.getenv("SHORT_LIVED_JWT_EXP_SECONDS", "30000"))


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
    secret_key=JWT_SECRET_KEY,
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
app.include_router(auth.router, prefix="/auth", tags=["authentication"])
app.include_router(specs.router, prefix="/specs", tags=["specs"])
app.include_router(lint.router, prefix="/lint", tags=["lint"])


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
