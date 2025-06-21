"""
Admin API routes for managing binaries, environments, and runs.
Protected by GitHub OAuth authentication.
"""

import logging
from datetime import datetime, UTC
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from ..database import get_database
from ..admin_auth import require_admin_auth, create_admin_session, invalidate_admin_session
from ..oauth import github_oauth
from ..models import AdminSession, Binary, Environment, Run, AdminUser, AuthToken, BenchmarkResult
from ..schemas import BinaryCreate, Binary as BinarySchema, EnvironmentCreate, Environment as EnvironmentSchema
from .. import crud
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# Pydantic schemas for admin user management
class AdminUserCreate(BaseModel):
    github_username: str
    notes: Optional[str] = None

class AdminUserResponse(BaseModel):
    id: int
    github_username: str
    added_by: str
    added_at: datetime
    is_active: bool
    notes: Optional[str] = None

# Pydantic schemas for token management
class TokenCreate(BaseModel):
    name: str
    description: Optional[str] = None

class TokenResponse(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    created_at: datetime
    last_used: Optional[datetime] = None
    is_active: bool
    token_preview: str  # First 8 + last 4 characters

class TokenUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None

class TokenAnalytics(BaseModel):
    total_tokens: int
    active_tokens: int
    inactive_tokens: int
    used_tokens: int
    never_used_tokens: int
    recent_active_tokens: int

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/auth/github")
async def initiate_github_auth():
    """Initiate GitHub OAuth flow."""
    auth_url, state = github_oauth.generate_authorization_url()
    return {"auth_url": auth_url, "state": state}


@router.post("/auth/callback")
async def github_auth_callback(
    code: str,
    state: str,
    request: Request,
    response: Response,
    db: AsyncSession = Depends(get_database),
):
    """Handle GitHub OAuth callback and create admin session."""
    try:
        # Exchange code for access token
        access_token = await github_oauth.exchange_code_for_token(code, state)
        
        # Get user info
        github_user = await github_oauth.get_user_info(access_token)
        
        # Check if user is admin
        is_admin = await github_oauth.is_admin_user(github_user.login, db)
        
        if not is_admin:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User is not authorized as admin",
            )
        
        # Create admin session
        try:
            session_token = await create_admin_session(db, github_user)
        except Exception as db_error:
            logger.error(f"Database error creating session: {db_error}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Database error: {str(db_error)}",
            )
        
        # Set secure cookie
        # Determine if we're using HTTPS
        is_https = request.url.scheme == "https"
        
        response.set_cookie(
            key="admin_session",
            value=session_token,
            httponly=True,
            secure=is_https,  # Only use secure cookies on HTTPS
            samesite="lax",
            max_age=24 * 60 * 60,  # 24 hours
            domain=None,  # Let the browser handle the domain
            path="/",  # Make cookie available for all paths
        )
        
        return {
            "success": True,
            "user": {
                "username": github_user.login,
                "name": github_user.name,
                "avatar_url": github_user.avatar_url,
            },
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Unexpected error in auth callback: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Authentication failed: {str(e)}",
        )


@router.post("/auth/logout")
async def logout(
    response: Response,
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """Logout admin user and invalidate session."""
    await invalidate_admin_session(db, admin_session.session_token)
    response.delete_cookie("admin_session")
    return {"success": True}


@router.get("/me")
async def get_current_admin(
    admin_session: AdminSession = Depends(require_admin_auth),
):
    """Get current admin user info."""
    return {
        "username": admin_session.github_username,
        "name": admin_session.github_name,
        "email": admin_session.github_email,
        "avatar_url": admin_session.github_avatar_url,
    }


# Binaries Management
@router.get("/binaries", response_model=List[BinarySchema])
async def list_binaries(
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """List all binaries."""
    return await crud.get_binaries(db)


@router.post("/binaries", response_model=BinarySchema)
async def create_binary(
    binary: BinaryCreate,
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """Create a new binary."""
    # Check if binary already exists
    existing = await crud.get_binary_by_id(db, binary.id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Binary with this ID already exists",
        )
    
    return await crud.create_binary(db, binary)


@router.put("/binaries/{binary_id}", response_model=BinarySchema)
async def update_binary(
    binary_id: str,
    binary_update: BinaryCreate,
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """Update an existing binary."""
    existing = await crud.get_binary_by_id(db, binary_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Binary not found",
        )
    
    # Update fields
    existing.name = binary_update.name
    existing.flags = binary_update.flags
    existing.description = binary_update.description
    existing.color = binary_update.color
    existing.icon = binary_update.icon
    existing.display_order = binary_update.display_order
    
    await db.commit()
    await db.refresh(existing)
    return existing


@router.delete("/binaries/{binary_id}")
async def delete_binary(
    binary_id: str,
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """Delete a binary and all associated runs and benchmark results."""
    existing = await crud.get_binary_by_id(db, binary_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Binary not found",
        )
    
    # Get all runs for this binary to cascade delete benchmark results
    runs_result = await db.execute(select(Run.run_id).where(Run.binary_id == binary_id))
    run_ids = [row[0] for row in runs_result.fetchall()]
    
    # Delete all benchmark results for runs associated with this binary
    if run_ids:
        await db.execute(delete(BenchmarkResult).where(BenchmarkResult.run_id.in_(run_ids)))
    
    # Delete all runs for this binary
    await db.execute(delete(Run).where(Run.binary_id == binary_id))
    
    # Finally delete the binary
    await db.execute(delete(Binary).where(Binary.id == binary_id))
    await db.commit()
    return {"success": True}


# Environments Management
@router.get("/environments", response_model=List[EnvironmentSchema])
async def list_environments(
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """List all environments."""
    return await crud.get_environments(db)


@router.post("/environments", response_model=EnvironmentSchema)
async def create_environment(
    environment: EnvironmentCreate,
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """Create a new environment."""
    # Check if environment already exists
    existing = await crud.get_environment_by_id(db, environment.id)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Environment with this ID already exists",
        )
    
    return await crud.create_environment(db, environment)


@router.put("/environments/{environment_id}", response_model=EnvironmentSchema)
async def update_environment(
    environment_id: str,
    environment_update: EnvironmentCreate,
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """Update an existing environment."""
    existing = await crud.get_environment_by_id(db, environment_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Environment not found",
        )
    
    # Update fields
    existing.name = environment_update.name
    existing.description = environment_update.description
    
    await db.commit()
    await db.refresh(existing)
    return existing


@router.delete("/environments/{environment_id}")
async def delete_environment(
    environment_id: str,
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """Delete an environment and all associated runs and benchmark results."""
    existing = await crud.get_environment_by_id(db, environment_id)
    if not existing:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Environment not found",
        )
    
    # Get all runs for this environment to cascade delete benchmark results
    runs_result = await db.execute(select(Run.run_id).where(Run.environment_id == environment_id))
    run_ids = [row[0] for row in runs_result.fetchall()]
    
    # Delete all benchmark results for runs associated with this environment
    if run_ids:
        await db.execute(delete(BenchmarkResult).where(BenchmarkResult.run_id.in_(run_ids)))
    
    # Delete all runs for this environment
    await db.execute(delete(Run).where(Run.environment_id == environment_id))
    
    # Finally delete the environment
    await db.execute(delete(Environment).where(Environment.id == environment_id))
    await db.commit()
    return {"success": True}


# Runs Management
@router.get("/runs")
async def list_runs(
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
    skip: int = 0,
    limit: int = 50,  # Reduced default limit for performance
    commit_sha: Optional[str] = None,
    binary_id: Optional[str] = None,
    environment_id: Optional[str] = None,
):
    """List runs with their commit information and pagination."""
    # Limit maximum page size to prevent performance issues
    limit = min(limit, 100)
    
    # Get runs with commit information
    runs_with_commits = await crud.get_runs_with_commits(
        db,
        commit_sha=commit_sha,
        binary_id=binary_id,
        environment_id=environment_id,
        skip=skip,
        limit=limit,
    )
    
    # Get total count for pagination
    total_count = await crud.count_runs(
        db,
        commit_sha=commit_sha,
        binary_id=binary_id,
        environment_id=environment_id,
    )
    
    # Format the response to include both run and commit data
    formatted_runs = []
    for run, commit in runs_with_commits:
        formatted_runs.append({
            "run_id": run.run_id,
            "commit_sha": run.commit_sha,
            "binary_id": run.binary_id,
            "environment_id": run.environment_id,
            "python_major": run.python_major,
            "python_minor": run.python_minor,
            "python_patch": run.python_patch,
            "timestamp": run.timestamp,
            "commit": {
                "sha": commit.sha,
                "timestamp": commit.timestamp,
                "message": commit.message,
                "author": commit.author,
                "python_major": commit.python_major,
                "python_minor": commit.python_minor,
                "python_patch": commit.python_patch,
            }
        })
    
    return {
        "runs": formatted_runs,
        "pagination": {
            "skip": skip,
            "limit": limit,
            "total": total_count,
            "has_more": skip + len(formatted_runs) < total_count
        }
    }


@router.delete("/runs/{run_id}")
async def delete_run(
    run_id: str,
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """Delete a run and its associated benchmark results."""
    # Check if run exists
    result = await db.execute(select(Run).where(Run.run_id == run_id))
    run = result.scalars().first()
    
    if not run:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Run not found",
        )
    
    # First delete all benchmark results for this run
    await db.execute(delete(BenchmarkResult).where(BenchmarkResult.run_id == run_id))
    
    # Then delete the run
    await db.execute(delete(Run).where(Run.run_id == run_id))
    await db.commit()
    
    return {"success": True}


# Admin Users Management
@router.get("/users", response_model=List[AdminUserResponse])
async def list_admin_users(
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """List all admin users."""
    return await crud.get_admin_users(db)


@router.post("/users", response_model=AdminUserResponse)
async def create_admin_user(
    user_data: AdminUserCreate,
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """Create a new admin user."""
    # Check if user already exists
    existing = await crud.get_admin_user_by_username(db, user_data.github_username)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Admin user already exists",
        )
    
    return await crud.create_admin_user(
        db, 
        user_data.github_username, 
        admin_session.github_username,
        user_data.notes
    )


@router.delete("/users/{username}")
async def remove_admin_user(
    username: str,
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """Remove an admin user."""
    # Prevent removing yourself
    if username == admin_session.github_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot remove yourself from admin users",
        )
    
    success = await crud.deactivate_admin_user(db, username)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin user not found",
        )
    
    return {"success": True}


# Token Management
@router.get("/tokens", response_model=List[TokenResponse])
async def list_tokens(
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """List all authentication tokens."""
    tokens = await crud.get_all_auth_tokens(db)
    
    token_responses = []
    for token in tokens:
        token_responses.append(TokenResponse(
            id=token.id,
            name=token.name,
            description=token.description,
            created_at=token.created_at,
            last_used=token.last_used,
            is_active=token.is_active,
            token_preview=f"{token.token[:8]}...{token.token[-4:]}"
        ))
    
    return token_responses


@router.post("/tokens")
async def create_token(
    token_data: TokenCreate,
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """Create a new authentication token."""
    import secrets
    
    # Generate secure token
    token = secrets.token_bytes(32).hex()
    
    # Create token in database
    auth_token = await crud.create_auth_token(db, token, token_data.name, token_data.description)
    
    return {
        "success": True,
        "token": token,
        "token_info": TokenResponse(
            id=auth_token.id,
            name=auth_token.name,
            description=auth_token.description,
            created_at=auth_token.created_at,
            last_used=auth_token.last_used,
            is_active=auth_token.is_active,
            token_preview=f"{token[:8]}...{token[-4:]}"
        )
    }


@router.put("/tokens/{token_id}")
async def update_token(
    token_id: int,
    token_update: TokenUpdate,
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """Update token name and/or description."""
    result = await db.execute(select(AuthToken).where(AuthToken.id == token_id))
    auth_token = result.scalars().first()
    
    if not auth_token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token not found"
        )
    
    if token_update.name is not None:
        auth_token.name = token_update.name
    if token_update.description is not None:
        auth_token.description = token_update.description
    
    await db.commit()
    await db.refresh(auth_token)
    
    return TokenResponse(
        id=auth_token.id,
        name=auth_token.name,
        description=auth_token.description,
        created_at=auth_token.created_at,
        last_used=auth_token.last_used,
        is_active=auth_token.is_active,
        token_preview=f"{auth_token.token[:8]}...{auth_token.token[-4:]}"
    )


@router.post("/tokens/{token_id}/deactivate")
async def deactivate_token(
    token_id: int,
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """Deactivate an authentication token."""
    success = await crud.deactivate_auth_token(db, token_id)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token not found"
        )
    return {"success": True}


@router.post("/tokens/{token_id}/activate")
async def activate_token(
    token_id: int,
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """Activate a deactivated authentication token."""
    result = await db.execute(select(AuthToken).where(AuthToken.id == token_id))
    auth_token = result.scalars().first()
    
    if not auth_token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token not found"
        )
    
    auth_token.is_active = True
    await db.commit()
    return {"success": True}


@router.delete("/tokens/{token_id}")
async def delete_token(
    token_id: int,
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """Delete an authentication token."""
    result = await db.execute(select(AuthToken).where(AuthToken.id == token_id))
    auth_token = result.scalars().first()
    
    if not auth_token:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Token not found"
        )
    
    await db.delete(auth_token)
    await db.commit()
    return {"success": True}


@router.get("/tokens/analytics", response_model=TokenAnalytics)
async def get_token_analytics(
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """Get token usage analytics."""
    from datetime import timedelta
    
    # Get basic counts
    total_result = await db.execute(select(func.count(AuthToken.id)))
    total_tokens = total_result.scalar()
    
    active_result = await db.execute(
        select(func.count(AuthToken.id)).where(AuthToken.is_active == True)
    )
    active_tokens = active_result.scalar()
    
    used_result = await db.execute(
        select(func.count(AuthToken.id)).where(AuthToken.last_used.is_not(None))
    )
    used_tokens = used_result.scalar()
    
    # Get recent activity (last 30 days)
    thirty_days_ago = datetime.now(UTC).replace(tzinfo=None) - timedelta(days=30)
    recent_result = await db.execute(
        select(func.count(AuthToken.id)).where(AuthToken.last_used >= thirty_days_ago)
    )
    recent_active = recent_result.scalar()
    
    return TokenAnalytics(
        total_tokens=total_tokens,
        active_tokens=active_tokens,
        inactive_tokens=total_tokens - active_tokens,
        used_tokens=used_tokens,
        never_used_tokens=total_tokens - used_tokens,
        recent_active_tokens=recent_active
    )