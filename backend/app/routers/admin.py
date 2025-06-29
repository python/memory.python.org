"""
Admin API routes for managing binaries, environments, and runs.
Protected by GitHub OAuth authentication.
"""

import logging
from datetime import datetime, UTC
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status, Response, Request
from sqlalchemy import select, delete, func, text, desc, and_
from sqlalchemy.ext.asyncio import AsyncSession
import sqlparse

from ..database import get_database
from ..admin_auth import (
    require_admin_auth,
    create_admin_session,
    invalidate_admin_session,
)
from ..oauth import github_oauth
from ..models import (
    AdminSession,
    Binary,
    Environment,
    Run,
    AuthToken,
    BenchmarkResult,
    MemrayBuildFailure,
    Commit,
)
from ..schemas import (
    BinaryCreate,
    Binary as BinarySchema,
    EnvironmentCreate,
    Environment as EnvironmentSchema,
    MemrayFailurePublic, 
)
from .. import crud
from pydantic import BaseModel
import re

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


# Pydantic schemas for Commits management
class CommitUpdate(BaseModel):
    message: Optional[str] = None
    author: Optional[str] = None
    python_major: Optional[int] = None
    python_minor: Optional[int] = None
    python_patch: Optional[int] = None


class CommitResponse(BaseModel):
    sha: str
    timestamp: datetime
    message: str
    author: str
    python_major: int
    python_minor: int
    python_patch: int
    run_count: Optional[int] = None


# Pydantic schemas for BenchmarkResults management
class BenchmarkResultUpdate(BaseModel):
    high_watermark_bytes: Optional[int] = None
    total_allocated_bytes: Optional[int] = None
    allocation_histogram: Optional[List[List[int]]] = None
    top_allocating_functions: Optional[List[Dict[str, Any]]] = None


class BenchmarkResultResponse(BaseModel):
    id: str
    run_id: str
    benchmark_name: str
    high_watermark_bytes: int
    total_allocated_bytes: int
    allocation_histogram: List[List[int]]
    top_allocating_functions: List[Dict[str, Any]]
    has_flamegraph: bool



router = APIRouter(prefix="/api/admin", tags=["admin"])


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
        await db.execute(
            delete(BenchmarkResult).where(BenchmarkResult.run_id.in_(run_ids))
        )

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
    runs_result = await db.execute(
        select(Run.run_id).where(Run.environment_id == environment_id)
    )
    run_ids = [row[0] for row in runs_result.fetchall()]

    # Delete all benchmark results for runs associated with this environment
    if run_ids:
        await db.execute(
            delete(BenchmarkResult).where(BenchmarkResult.run_id.in_(run_ids))
        )

    # Delete all runs for this environment
    await db.execute(delete(Run).where(Run.environment_id == environment_id))

    # Finally delete the environment
    await db.execute(delete(Environment).where(Environment.id == environment_id))
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
        db, user_data.github_username, admin_session.github_username, user_data.notes
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
        token_responses.append(
            TokenResponse(
                id=token.id,
                name=token.name,
                description=token.description,
                created_at=token.created_at,
                last_used=token.last_used,
                is_active=token.is_active,
                token_preview=f"{token.token[:8]}...{token.token[-4:]}",
            )
        )

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
    auth_token = await crud.create_auth_token(
        db, token, token_data.name, token_data.description
    )

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
            token_preview=f"{token[:8]}...{token[-4:]}",
        ),
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
            status_code=status.HTTP_404_NOT_FOUND, detail="Token not found"
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
        token_preview=f"{auth_token.token[:8]}...{auth_token.token[-4:]}",
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
            status_code=status.HTTP_404_NOT_FOUND, detail="Token not found"
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
            status_code=status.HTTP_404_NOT_FOUND, detail="Token not found"
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
            status_code=status.HTTP_404_NOT_FOUND, detail="Token not found"
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
        select(func.count(AuthToken.id)).where(AuthToken.is_active)
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
        recent_active_tokens=recent_active,
    )


# Commits Management
@router.get("/commits", response_model=List[CommitResponse])
async def list_commits(
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
    skip: int = 0,
    limit: int = 50,
    sha: Optional[str] = None,
    author: Optional[str] = None,
    python_version: Optional[str] = None,
):
    """List commits with filtering and pagination."""
    limit = min(limit, 100)  # Prevent excessive data loading
    
    query = select(Commit, func.count(Run.run_id).label("run_count")).outerjoin(Run).group_by(Commit.sha)
    
    if sha:
        query = query.where(Commit.sha.ilike(f"{sha}%"))
    if author:
        query = query.where(Commit.author.ilike(f"%{author}%"))
    if python_version:
        try:
            major, minor = python_version.split(".")[:2]
            query = query.where(
                and_(
                    Commit.python_major == int(major),
                    Commit.python_minor == int(minor)
                )
            )
        except (ValueError, IndexError):
            pass  # Invalid version format, ignore filter
    
    query = query.order_by(desc(Commit.timestamp)).offset(skip).limit(limit)
    
    result = await db.execute(query)
    commits_with_counts = result.all()
    
    commit_responses = []
    for commit, run_count in commits_with_counts:
        commit_responses.append(
            CommitResponse(
                sha=commit.sha,
                timestamp=commit.timestamp,
                message=commit.message,
                author=commit.author,
                python_major=commit.python_major,
                python_minor=commit.python_minor,
                python_patch=commit.python_patch,
                run_count=run_count,
            )
        )
    
    return commit_responses


@router.get("/commits/{sha}", response_model=CommitResponse)
async def get_commit(
    sha: str,
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """Get a specific commit by SHA."""
    result = await db.execute(
        select(Commit, func.count(Run.run_id).label("run_count"))
        .outerjoin(Run)
        .where(Commit.sha == sha)
        .group_by(Commit.sha)
    )
    commit_data = result.first()
    
    if not commit_data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Commit not found",
        )
    
    commit, run_count = commit_data
    return CommitResponse(
        sha=commit.sha,
        timestamp=commit.timestamp,
        message=commit.message,
        author=commit.author,
        python_major=commit.python_major,
        python_minor=commit.python_minor,
        python_patch=commit.python_patch,
        run_count=run_count,
    )


@router.put("/commits/{sha}", response_model=CommitResponse)
async def update_commit(
    sha: str,
    commit_update: CommitUpdate,
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """Update a commit's metadata."""
    result = await db.execute(select(Commit).where(Commit.sha == sha))
    commit = result.scalars().first()
    
    if not commit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Commit not found",
        )
    
    # Update fields if provided
    if commit_update.message is not None:
        commit.message = commit_update.message
    if commit_update.author is not None:
        commit.author = commit_update.author
    if commit_update.python_major is not None:
        commit.python_major = commit_update.python_major
    if commit_update.python_minor is not None:
        commit.python_minor = commit_update.python_minor
    if commit_update.python_patch is not None:
        commit.python_patch = commit_update.python_patch
    
    await db.commit()
    await db.refresh(commit)
    
    # Get run count
    run_count_result = await db.execute(
        select(func.count(Run.run_id)).where(Run.commit_sha == sha)
    )
    run_count = run_count_result.scalar() or 0
    
    return CommitResponse(
        sha=commit.sha,
        timestamp=commit.timestamp,
        message=commit.message,
        author=commit.author,
        python_major=commit.python_major,
        python_minor=commit.python_minor,
        python_patch=commit.python_patch,
        run_count=run_count,
    )


@router.delete("/commits/{sha}")
async def delete_commit(
    sha: str,
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """Delete a commit and all associated runs and benchmark results."""
    result = await db.execute(select(Commit).where(Commit.sha == sha))
    commit = result.scalars().first()
    
    if not commit:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Commit not found",
        )
    
    # Get all runs for this commit
    runs_result = await db.execute(select(Run.run_id).where(Run.commit_sha == sha))
    run_ids = [row[0] for row in runs_result.fetchall()]
    
    # Delete all benchmark results for runs associated with this commit
    if run_ids:
        await db.execute(
            delete(BenchmarkResult).where(BenchmarkResult.run_id.in_(run_ids))
        )
    
    # Delete all runs for this commit
    await db.execute(delete(Run).where(Run.commit_sha == sha))
    
    # Finally delete the commit
    await db.execute(delete(Commit).where(Commit.sha == sha))
    await db.commit()
    
    return {"success": True}


# BenchmarkResults Management
@router.get("/benchmark-results", response_model=List[BenchmarkResultResponse])
async def list_benchmark_results(
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
    skip: int = 0,
    limit: int = 50,
    run_id: Optional[str] = None,
    benchmark_name: Optional[str] = None,
    min_memory: Optional[int] = None,
    max_memory: Optional[int] = None,
):
    """List benchmark results with filtering and pagination."""
    limit = min(limit, 100)  # Prevent excessive data loading
    
    query = select(BenchmarkResult)
    
    if run_id:
        query = query.where(BenchmarkResult.run_id.ilike(f"{run_id}%"))
    if benchmark_name:
        query = query.where(BenchmarkResult.benchmark_name.ilike(f"%{benchmark_name}%"))
    if min_memory is not None:
        query = query.where(BenchmarkResult.high_watermark_bytes >= min_memory)
    if max_memory is not None:
        query = query.where(BenchmarkResult.high_watermark_bytes <= max_memory)
    
    query = query.order_by(desc(BenchmarkResult.id)).offset(skip).limit(limit)
    
    result = await db.execute(query)
    benchmark_results = result.scalars().all()
    
    result_responses = []
    for br in benchmark_results:
        result_responses.append(
            BenchmarkResultResponse(
                id=br.id,
                run_id=br.run_id,
                benchmark_name=br.benchmark_name,
                high_watermark_bytes=br.high_watermark_bytes,
                total_allocated_bytes=br.total_allocated_bytes,
                allocation_histogram=br.allocation_histogram,
                top_allocating_functions=br.top_allocating_functions,
                has_flamegraph=br.flamegraph_html is not None,
            )
        )
    
    return result_responses


@router.get("/benchmark-results/{result_id}", response_model=BenchmarkResultResponse)
async def get_benchmark_result(
    result_id: str,
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """Get a specific benchmark result by ID."""
    result = await db.execute(
        select(BenchmarkResult).where(BenchmarkResult.id == result_id)
    )
    benchmark_result = result.scalars().first()
    
    if not benchmark_result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Benchmark result not found",
        )
    
    return BenchmarkResultResponse(
        id=benchmark_result.id,
        run_id=benchmark_result.run_id,
        benchmark_name=benchmark_result.benchmark_name,
        high_watermark_bytes=benchmark_result.high_watermark_bytes,
        total_allocated_bytes=benchmark_result.total_allocated_bytes,
        allocation_histogram=benchmark_result.allocation_histogram,
        top_allocating_functions=benchmark_result.top_allocating_functions,
        has_flamegraph=benchmark_result.flamegraph_html is not None,
    )


@router.get("/benchmark-results/{result_id}/flamegraph")
async def get_benchmark_result_flamegraph(
    result_id: str,
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """Get the flamegraph HTML for a benchmark result."""
    result = await db.execute(
        select(BenchmarkResult.flamegraph_html).where(BenchmarkResult.id == result_id)
    )
    flamegraph_html = result.scalar()
    
    if flamegraph_html is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Flamegraph not found for this benchmark result",
        )
    
    return {"flamegraph_html": flamegraph_html}


@router.put("/benchmark-results/{result_id}", response_model=BenchmarkResultResponse)
async def update_benchmark_result(
    result_id: str,
    result_update: BenchmarkResultUpdate,
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """Update a benchmark result's data."""
    result = await db.execute(
        select(BenchmarkResult).where(BenchmarkResult.id == result_id)
    )
    benchmark_result = result.scalars().first()
    
    if not benchmark_result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Benchmark result not found",
        )
    
    # Update fields if provided
    if result_update.high_watermark_bytes is not None:
        benchmark_result.high_watermark_bytes = result_update.high_watermark_bytes
    if result_update.total_allocated_bytes is not None:
        benchmark_result.total_allocated_bytes = result_update.total_allocated_bytes
    if result_update.allocation_histogram is not None:
        benchmark_result.allocation_histogram = result_update.allocation_histogram
    if result_update.top_allocating_functions is not None:
        benchmark_result.top_allocating_functions = result_update.top_allocating_functions
    
    await db.commit()
    await db.refresh(benchmark_result)
    
    return BenchmarkResultResponse(
        id=benchmark_result.id,
        run_id=benchmark_result.run_id,
        benchmark_name=benchmark_result.benchmark_name,
        high_watermark_bytes=benchmark_result.high_watermark_bytes,
        total_allocated_bytes=benchmark_result.total_allocated_bytes,
        allocation_histogram=benchmark_result.allocation_histogram,
        top_allocating_functions=benchmark_result.top_allocating_functions,
        has_flamegraph=benchmark_result.flamegraph_html is not None,
    )


@router.delete("/benchmark-results/{result_id}")
async def delete_benchmark_result(
    result_id: str,
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """Delete a specific benchmark result."""
    result = await db.execute(
        select(BenchmarkResult).where(BenchmarkResult.id == result_id)
    )
    benchmark_result = result.scalars().first()
    
    if not benchmark_result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Benchmark result not found",
        )
    
    await db.execute(delete(BenchmarkResult).where(BenchmarkResult.id == result_id))
    await db.commit()
    
    return {"success": True}


@router.post("/benchmark-results/bulk-delete")
async def bulk_delete_benchmark_results(
    result_ids: List[str],
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """Bulk delete benchmark results by IDs."""
    if not result_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No result IDs provided",
        )
    
    if len(result_ids) > 100:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete more than 100 results at once",
        )
    
    deleted_count = await db.execute(
        delete(BenchmarkResult).where(BenchmarkResult.id.in_(result_ids))
    )
    await db.commit()
    
    return {
        "success": True,
        "deleted_count": deleted_count.rowcount,
        "requested_count": len(result_ids),
    }


# Query Console - for advanced database operations
class QueryRequest(BaseModel):
    query: str
    read_only: bool = True


class QueryResult(BaseModel):
    success: bool
    rows: Optional[List[Dict[str, Any]]] = None
    affected_rows: Optional[int] = None
    error: Optional[str] = None
    execution_time_ms: Optional[float] = None
    column_names: Optional[List[str]] = None


@router.post("/query", response_model=QueryResult)
async def execute_query(
    query_request: QueryRequest,
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """Execute a custom SQL query with safety checks."""
    import time
    
    query = query_request.query.strip()
    
    if not query:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query cannot be empty",
        )
    
    # Simple read-only check
    query_upper = query.upper()
    is_write_operation = any(keyword in query_upper for keyword in ["INSERT", "UPDATE", "DELETE", "DROP", "TRUNCATE", "ALTER", "CREATE"])
    
    # Block write operations in read-only mode
    if query_request.read_only and is_write_operation:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Write operations not allowed in read-only mode",
        )
    
    # Limit query length
    if len(query) > 10000:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Query too long (max 10,000 characters)",
        )
    
    # Add LIMIT to SELECT queries without one (for safety)
    if query_upper.startswith("SELECT") and "LIMIT" not in query_upper:
        # Remove trailing semicolon if present, then add LIMIT
        query = query.rstrip().rstrip(';')
        query += " LIMIT 1000"
    
    start_time = time.time()
    
    # Get admin username now while in async context
    admin_username = admin_session.github_username
    
    try:
        # Handle single statement queries properly
        if query_upper.startswith("SELECT") or query_upper.startswith("WITH"):
            # For SELECT queries, execute and fetch results
            result = await db.execute(text(query))
            rows = result.fetchall()
            
            # Convert to list of dictionaries
            if rows:
                column_names = list(result.keys())
                rows_data = [dict(zip(column_names, row)) for row in rows]
            else:
                column_names = list(result.keys()) if result.keys() else []
                rows_data = []
            
            execution_time = (time.time() - start_time) * 1000
            
            return QueryResult(
                success=True,
                rows=rows_data,
                column_names=column_names,
                execution_time_ms=round(execution_time, 2),
            )
        else:
            # For non-SELECT queries (INSERT, UPDATE, DELETE, etc.)
            # Handle multiple statements if needed
            statements = [stmt.strip() for stmt in sqlparse.split(query) if stmt.strip()]
            
            total_affected_rows = 0
            for stmt in statements:
                stmt_result = await db.execute(text(stmt))
                total_affected_rows += stmt_result.rowcount
            
            await db.commit()
            execution_time = (time.time() - start_time) * 1000
            
            return QueryResult(
                success=True,
                affected_rows=total_affected_rows,
                execution_time_ms=round(execution_time, 2),
            )
            
    except Exception as e:
        await db.rollback()
        execution_time = (time.time() - start_time) * 1000
        
        logger.error(f"Query execution failed: {e}", extra={
            "query": query,
            "admin_user": admin_username,
        })
        
        return QueryResult(
            success=False,
            error=str(e),
            execution_time_ms=round(execution_time, 2),
        )


@router.get("/query/tables")
async def list_database_tables(
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """List all tables in the database."""
    try:
        # This query works for most SQL databases
        result = await db.execute(text("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' OR table_schema = 'main'
            ORDER BY table_name
        """))
        
        tables = [row[0] for row in result.fetchall()]
        return {"tables": tables}
        
    except Exception:
        # Fallback for SQLite or other databases
        try:
            result = await db.execute(text("""
                SELECT name FROM sqlite_master 
                WHERE type='table' 
                ORDER BY name
            """))
            tables = [row[0] for row in result.fetchall()]
            return {"tables": tables}
        except Exception as e:
            logger.error(f"Failed to list tables: {e}")
            return {"tables": [], "error": str(e)}


@router.get("/query/schema/{table_name}")
async def get_table_schema(
    table_name: str,
    admin_session: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """Get the schema for a specific table."""
    try:
        # Prevent SQL injection by validating table name
        if not re.match(r'^[a-zA-Z_][a-zA-Z0-9_]*$', table_name):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid table name",
            )
        
        # Get column information
        result = await db.execute(text(f"""
            SELECT column_name, data_type, is_nullable, column_default
            FROM information_schema.columns
            WHERE table_name = '{table_name}'
            ORDER BY ordinal_position
        """))
        
        columns = []
        for row in result.fetchall():
            columns.append({
                "name": row[0],
                "type": row[1],
                "nullable": row[2] == "YES",
                "default": row[3],
            })
        
        return {"table_name": table_name, "columns": columns}
        
    except Exception:
        # Fallback for SQLite
        try:
            result = await db.execute(text(f"PRAGMA table_info({table_name})"))
            columns = []
            for row in result.fetchall():
                columns.append({
                    "name": row[1],
                    "type": row[2],
                    "nullable": not bool(row[3]),
                    "default": row[4],
                })
            
            return {"table_name": table_name, "columns": columns}
            
        except Exception as e:
            logger.error(f"Failed to get schema for table {table_name}: {e}")
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Table not found or error accessing schema: {str(e)}",
            )




@router.get("/memray-failures", response_model=List[MemrayFailurePublic])
async def get_memray_failures(
    current_user: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """Get all memray build failures."""
    result = await db.execute(
        select(
            MemrayBuildFailure.id,
            MemrayBuildFailure.commit_sha,
            MemrayBuildFailure.binary_id,
            MemrayBuildFailure.environment_id,
            Binary.name.label("binary_name"),
            Environment.name.label("environment_name"),
            MemrayBuildFailure.error_message,
            MemrayBuildFailure.failure_timestamp,
            MemrayBuildFailure.commit_timestamp,
        )
        .join(Binary)
        .join(Environment)
        .order_by(desc(MemrayBuildFailure.failure_timestamp))
    )
    failures = result.fetchall()
    
    return [
        {
            "id": failure.id,
            "commit_sha": failure.commit_sha,
            "binary_id": failure.binary_id,
            "environment_id": failure.environment_id,
            "binary_name": failure.binary_name,
            "environment_name": failure.environment_name,
            "error_message": failure.error_message,
            "failure_timestamp": failure.failure_timestamp,
            "commit_timestamp": failure.commit_timestamp,
        }
        for failure in failures
    ]


@router.delete("/memray-failures/{failure_id}")
async def delete_memray_failure(
    failure_id: int,
    current_user: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """Delete a memray build failure record."""
    result = await db.execute(
        select(MemrayBuildFailure).where(MemrayBuildFailure.id == failure_id)
    )
    failure = result.scalars().first()
    
    if not failure:
        raise HTTPException(status_code=404, detail="Memray failure not found")
    
    await db.delete(failure)
    await db.commit()
    
    return {"message": "Memray failure deleted successfully"}


@router.get("/memray-failures/summary")
async def get_memray_failures_summary(
    current_user: AdminSession = Depends(require_admin_auth),
    db: AsyncSession = Depends(get_database),
):
    """Get summary of current memray failures by environment."""
    result = await db.execute(
        select(
            MemrayBuildFailure.binary_id,
            MemrayBuildFailure.environment_id,
            Binary.name.label("binary_name"),
            Environment.name.label("environment_name"),
            MemrayBuildFailure.commit_sha,
            MemrayBuildFailure.failure_timestamp,
            MemrayBuildFailure.commit_timestamp,
        )
        .join(Binary)
        .join(Environment)
        .order_by(desc(MemrayBuildFailure.failure_timestamp))
    )
    failures = result.fetchall()
    
    return [
        {
            "binary_id": failure.binary_id,
            "binary_name": failure.binary_name,
            "environment_id": failure.environment_id,
            "environment_name": failure.environment_name,
            "commit_sha": failure.commit_sha,
            "failure_timestamp": failure.failure_timestamp,
            "commit_timestamp": failure.commit_timestamp,
        }
        for failure in failures
    ]
