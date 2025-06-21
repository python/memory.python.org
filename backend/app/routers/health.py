"""Health check router for the Memory Tracker API."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import datetime

from ..database import get_database
from ..config import get_settings

router = APIRouter()
settings = get_settings()


@router.get("/health")
async def health_check(db: AsyncSession = Depends(get_database)):
    """Health check endpoint for Docker health checks."""
    health_status = {"status": "healthy", "timestamp": datetime.now().isoformat()}

    # Check database connectivity if enabled
    if settings.enable_health_check_db:
        try:
            # Simple query to verify database connection
            await db.execute("SELECT 1")
            health_status["database"] = "healthy"
        except Exception as e:
            health_status["status"] = "unhealthy"
            health_status["database"] = "unhealthy"
            health_status["error"] = str(e)

    return health_status