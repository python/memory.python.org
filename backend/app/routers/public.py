"""
Public API routes that don't require authentication.
"""

import logging
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_database
from ..models import AdminUser, MemrayBuildFailure, Binary, Environment
from ..schemas import AdminUserPublic

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api", tags=["public"])


@router.get("/maintainers", response_model=List[AdminUserPublic])
async def get_maintainers(
    db: AsyncSession = Depends(get_database),
):
    """Get list of active maintainers (admin users) - public endpoint."""
    # Only return active admin users
    result = await db.execute(
        select(AdminUser)
        .where(AdminUser.is_active)
        .order_by(AdminUser.added_at)
    )
    admin_users = result.scalars().all()

    return admin_users


@router.get("/memray-status")
async def get_memray_status(
    db: AsyncSession = Depends(get_database),
):
    """Get current memray build status - public endpoint."""
    # Get current failures (there should be at most one per binary+environment due to unique constraint)
    result = await db.execute(
        select(
            MemrayBuildFailure.binary_id,
            MemrayBuildFailure.environment_id,
            Binary.name.label("binary_name"),
            Environment.name.label("environment_name"),
            MemrayBuildFailure.commit_timestamp,
            MemrayBuildFailure.commit_sha,
            MemrayBuildFailure.error_message,
            MemrayBuildFailure.failure_timestamp,
        )
        .join(Binary)
        .join(Environment)
        .order_by(MemrayBuildFailure.commit_timestamp.desc())
    )
    failures = result.fetchall()
    
    # Build summary of affected environments
    affected_environments = []
    for failure in failures:
        affected_environments.append({
            "binary_id": failure.binary_id,
            "environment_id": failure.environment_id,
            "binary_name": failure.binary_name,
            "environment_name": failure.environment_name,
            "latest_failure": failure.commit_timestamp,
            "commit_sha": failure.commit_sha,
            "error_message": failure.error_message,
            "failure_timestamp": failure.failure_timestamp,
        })
    
    has_failures = len(affected_environments) > 0
    
    return {
        "has_failures": has_failures,
        "failure_count": len(affected_environments),
        "affected_environments": affected_environments,
        "message": "Memray build issues detected" if has_failures else "All environments healthy",
    }
