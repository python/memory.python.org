"""Main module for the Memory Tracker API."""

from .factory import create_app
from .config import get_settings
from .logging_config import get_logger


def get_application():
    """Get the configured FastAPI application."""
    return create_app()


# For compatibility with ASGI servers
app = get_application()


if __name__ == "__main__":
    import uvicorn
    
    settings = get_settings()
    application = create_app(settings)
    
    # Configure logging for standalone execution
    application.state.logging_manager.configure_logging()

    logger = get_logger("api.main")
    logger.info(
        "Starting FastAPI application",
        extra={
            "host": settings.api_host,
            "port": settings.api_port,
            "log_level": settings.log_level,
        },
    )
    uvicorn.run(application, host=settings.api_host, port=settings.api_port)