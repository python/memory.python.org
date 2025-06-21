"""Application factory for the Memory Tracker API."""

import uuid
import time
import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .config import get_settings
from .database import create_tables
from .logging_config import LoggingManager, request_id_var, request_start_time_var, get_logger
from .routers import health, commits, binaries, environments, runs, benchmarks, upload, admin


def create_app(settings=None) -> FastAPI:
    """Create and configure the FastAPI application."""
    if settings is None:
        settings = get_settings()
    
    # Create FastAPI instance
    app = FastAPI(title=settings.api_title, version=settings.api_version)
    
    # Store dependencies in app state
    app.state.settings = settings
    app.state.logging_manager = LoggingManager(settings)
    
    # Configure CORS
    cors_origins_list = settings.cors_origins_list
    if cors_origins_list:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=cors_origins_list,
            allow_credentials=settings.cors_allow_credentials,
            allow_methods=settings.cors_allow_methods,
            allow_headers=settings.cors_allow_headers,
        )
        logger = get_logger("api.cors")
        logger.info(f"CORS configured with origins: {cors_origins_list}")
    else:
        logger = get_logger("api.cors")
        logger.warning("No CORS origins configured - all origins will be blocked")
    
    # Add request logging middleware
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        logger = logging.getLogger("api.requests")
        start_time = time.time()

        # Generate request ID
        request_id = str(uuid.uuid4()) if settings.enable_request_id_tracking else None

        # Set context variables
        request_id_var.set(request_id)
        request_start_time_var.set(start_time)

        # Store in request state for FastAPI patterns
        request.state.request_id = request_id
        request.state.start_time = start_time

        # Log the incoming request
        logger.info(
            f"Request started: {request.method} {request.url.path}",
            extra={
                "method": request.method,
                "path": str(request.url.path),
                "query_params": dict(request.query_params)
                if request.query_params
                else None,
                "user_agent": request.headers.get("user-agent"),
                "client_ip": request.client.host if request.client else None,
            },
        )

        # Process the request
        try:
            response = await call_next(request)
            error = None
            status_code = response.status_code
        except Exception as e:
            logger.error(
                f"Request failed: {str(e)}", exc_info=True, extra={"error": str(e)}
            )
            error = str(e)
            status_code = 500
            raise
        finally:
            # Log the response
            process_time = time.time() - start_time
            duration_ms = int(process_time * 1000)

            log_level = logging.WARNING if duration_ms > 1000 else logging.INFO
            log_message = f"Request completed: {request.method} {request.url.path}"

            if duration_ms > 1000:
                log_message += " [SLOW]"

            logger.log(
                log_level,
                log_message,
                extra={
                    "method": request.method,
                    "path": str(request.url.path),
                    "status_code": status_code,
                    "duration_ms": duration_ms,
                    "error": error,
                },
            )

        # Add request ID to response headers if enabled
        if settings.enable_request_id_tracking and request_id:
            response.headers["X-Request-ID"] = request_id

        return response
    
    # Configure startup event
    @app.on_event("startup")
    async def startup_event():
        # Configure logging using the app state
        app.state.logging_manager.configure_logging()

        # Disable uvicorn access logs to avoid duplication
        uvicorn_logger = logging.getLogger("uvicorn.access")
        uvicorn_logger.disabled = True

        logger = get_logger("api.startup")
        logger.info(
            "Application starting up",
            extra={
                "log_level": settings.log_level,
                "log_format": settings.log_format,
                "api_version": settings.api_version,
            },
        )
        await create_tables()
        logger.info("Database tables created successfully")
        
        # Ensure initial admin user exists
        from .database import AsyncSessionLocal
        from .crud import ensure_initial_admin
        async with AsyncSessionLocal() as db:
            await ensure_initial_admin(db, settings.admin_initial_username)
    
    # Include routers
    app.include_router(health.router)
    app.include_router(commits.router)
    app.include_router(binaries.router)
    app.include_router(environments.router)
    app.include_router(runs.router)  
    app.include_router(benchmarks.router)
    app.include_router(upload.router)
    app.include_router(admin.router)
    
    return app