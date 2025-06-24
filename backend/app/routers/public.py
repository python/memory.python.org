"""
Public API routes that don't require authentication.
"""

import logging
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_database
from ..models import AdminUser
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
        .where(AdminUser.is_active == True)
        .order_by(AdminUser.added_at)
    )
    admin_users = result.scalars().all()
    
    return admin_users