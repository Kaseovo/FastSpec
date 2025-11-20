"""
FastAPI main application for FastSpec
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from .database import engine, Base
from .routers import specs


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup and shutdown events"""
    # Create database tables
    Base.metadata.create_all(bind=engine)
    yield


app = FastAPI(
    title="FastSpec API",
    description="OpenAPI Specification Editor and Validator",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(specs.router, prefix="/api", tags=["specs"])


@app.get("/")
async def root():
    """Root endpoint"""
    return {"message": "FastSpec API", "version": "2.0.0", "docs": "/docs"}


@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy"}
