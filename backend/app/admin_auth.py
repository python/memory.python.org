"""
Admin authentication middleware and dependencies for GitHub OAuth protection.
"""

import secrets
import logging
from datetime import datetime, UTC, timedelta
from typing import Optional
from fastapi import Depends, HTTPException, status, Request, Cookie
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from .database import get_database
from .models import AdminSession
from .oauth import github_oauth, GitHubUser
from .config import get_settings

logger = logging.getLogger(__name__)


async def create_admin_session(
    db: AsyncSession, github_user: GitHubUser, duration_hours: int = 24
) -> str:
    """Create a new admin session for a GitHub user."""
    session_token = secrets.token_urlsafe(48)
    expires_at = datetime.now(UTC).replace(tzinfo=None) + timedelta(hours=duration_hours)
    
    admin_session = AdminSession(
        session_token=session_token,
        github_user_id=github_user.id,
        github_username=github_user.login,
        github_name=github_user.name,
        github_email=github_user.email,
        github_avatar_url=github_user.avatar_url,
        expires_at=expires_at,
    )
    
    db.add(admin_session)
    await db.commit()
    await db.refresh(admin_session)
    
    return session_token


async def get_admin_session(
    db: AsyncSession, session_token: str
) -> Optional[AdminSession]:
    """Get an active admin session by token."""
    result = await db.execute(
        select(AdminSession).where(
            and_(
                AdminSession.session_token == session_token,
                AdminSession.is_active == True,
                AdminSession.expires_at > datetime.now(UTC).replace(tzinfo=None),
            )
        )
    )
    return result.scalars().first()


async def invalidate_admin_session(db: AsyncSession, session_token: str) -> None:
    """Invalidate an admin session."""
    result = await db.execute(
        select(AdminSession).where(AdminSession.session_token == session_token)
    )
    session = result.scalars().first()
    if session:
        session.is_active = False
        await db.commit()


async def cleanup_expired_sessions(db: AsyncSession) -> None:
    """Clean up expired admin sessions."""
    result = await db.execute(
        select(AdminSession).where(
            and_(
                AdminSession.expires_at <= datetime.now(UTC).replace(tzinfo=None),
                AdminSession.is_active == True,
            )
        )
    )
    expired_sessions = result.scalars().all()
    
    for session in expired_sessions:
        session.is_active = False
    
    if expired_sessions:
        await db.commit()


async def require_admin_auth(
    request: Request,
    admin_session_token: Optional[str] = Cookie(None, alias="admin_session"),
    db: AsyncSession = Depends(get_database),
) -> AdminSession:
    """
    Dependency to require admin authentication.
    Checks for admin session cookie and validates it.
    """
    if not admin_session_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Admin authentication required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    try:
        session = await get_admin_session(db, admin_session_token)
    except Exception as e:
        # Log the database error but don't expose internal details
        logger.error(f"Database error in admin auth: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication service unavailable",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    if not session:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired admin session",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Check if user is still an admin (for existing sessions, we need a valid token)
    # Note: This check is disabled for existing sessions as we don't store the access token
    # Team membership is verified during initial login only
    # if not await github_oauth.is_admin_user(session.github_username):
    #     await invalidate_admin_session(db, admin_session_token)
    #     raise HTTPException(
    #         status_code=status.HTTP_403_FORBIDDEN,
    #         detail="Admin privileges revoked",
    #     )
    
    return session


async def optional_admin_auth(
    request: Request,
    admin_session_token: Optional[str] = Cookie(None, alias="admin_session"),
    db: AsyncSession = Depends(get_database),
) -> Optional[AdminSession]:
    """
    Optional admin authentication dependency.
    Returns None if not authenticated, AdminSession if authenticated.
    """
    if not admin_session_token:
        return None
    
    try:
        return await require_admin_auth(request, admin_session_token, db)
    except HTTPException:
        return None