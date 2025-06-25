"""
CRUD operations using eager loading and better query patterns.
"""

from sqlalchemy import select, desc, and_, func, text
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload, joinedload, contains_eager
from typing import List, Optional, Dict, Any
from datetime import datetime, UTC
import logging

from . import models, schemas

logger = logging.getLogger(__name__)


async def get_benchmark_trends(
    db: AsyncSession,
    benchmark_name: str,
    binary_id: str,
    environment_id: str,
    python_major: int,
    python_minor: int,
    limit: int = 50,
) -> List[Dict[str, Any]]:
    """
    Get benchmark trends using a more efficient query.
    Returns data points for charting benchmark performance over time.
    """
    query = text("""
        SELECT DISTINCT
            c.sha,
            c.timestamp,
            c.python_major,
            c.python_minor,
            c.python_patch,
            br.high_watermark_bytes,
            br.total_allocated_bytes
        FROM commits c
        JOIN runs r ON c.sha = r.commit_sha
        JOIN benchmark_results br ON r.run_id = br.run_id
        WHERE r.binary_id = :binary_id
          AND r.environment_id = :environment_id
          AND br.benchmark_name = :benchmark_name
          AND c.python_major = :python_major
          AND c.python_minor = :python_minor
        ORDER BY c.timestamp DESC
        LIMIT :limit
    """)

    result = await db.execute(
        query,
        {
            "benchmark_name": benchmark_name,
            "binary_id": binary_id,
            "environment_id": environment_id,
            "python_major": python_major,
            "python_minor": python_minor,
            "limit": limit,
        },
    )

    trends = []
    for row in result:
        trends.append(
            {
                "sha": row.sha,
                "timestamp": row.timestamp,
                "python_version": f"{row.python_major}.{row.python_minor}.{row.python_patch}",
                "high_watermark_bytes": row.high_watermark_bytes,
                "total_allocated_bytes": row.total_allocated_bytes,
            }
        )

    return trends


async def get_commits(
    db: AsyncSession, skip: int = 0, limit: int = 100
) -> List[models.Commit]:
    result = await db.execute(
        select(models.Commit)
        .order_by(desc(models.Commit.timestamp))
        .offset(skip)
        .limit(limit)
    )
    return result.scalars().all()


async def get_commit_by_sha(db: AsyncSession, sha: str) -> Optional[models.Commit]:
    result = await db.execute(select(models.Commit).where(models.Commit.sha == sha))
    return result.scalars().first()


async def create_commit(
    db: AsyncSession, commit: schemas.CommitCreate
) -> models.Commit:
    # Convert timezone-aware timestamp to timezone-naive for database storage
    timestamp = commit.timestamp
    if timestamp.tzinfo is not None:
        timestamp = timestamp.replace(tzinfo=None)

    db_commit = models.Commit(
        sha=commit.sha,
        timestamp=timestamp,
        message=commit.message,
        author=commit.author,
        python_major=commit.python_version.major,
        python_minor=commit.python_version.minor,
        python_patch=commit.python_version.patch,
    )
    db.add(db_commit)
    await db.commit()
    await db.refresh(db_commit)
    return db_commit


async def get_binaries(db: AsyncSession) -> List[models.Binary]:
    result = await db.execute(
        select(models.Binary).order_by(
            models.Binary.display_order.asc(), models.Binary.name.asc()
        )
    )
    return result.scalars().all()


async def get_binary_by_id(db: AsyncSession, binary_id: str) -> Optional[models.Binary]:
    result = await db.execute(
        select(models.Binary).where(models.Binary.id == binary_id)
    )
    return result.scalars().first()


async def create_binary(
    db: AsyncSession, binary: schemas.BinaryCreate
) -> models.Binary:
    db_binary = models.Binary(
        id=binary.id,
        name=binary.name,
        flags=binary.flags,
        description=binary.description,
        color=binary.color,
        icon=binary.icon,
        display_order=binary.display_order,
    )
    db.add(db_binary)
    await db.commit()
    await db.refresh(db_binary)
    return db_binary


async def get_environments(db: AsyncSession) -> List[models.Environment]:
    result = await db.execute(select(models.Environment))
    return result.scalars().all()


async def get_environment_by_id(
    db: AsyncSession, environment_id: str
) -> Optional[models.Environment]:
    result = await db.execute(
        select(models.Environment).where(models.Environment.id == environment_id)
    )
    return result.scalars().first()


async def create_environment(
    db: AsyncSession, environment: schemas.EnvironmentCreate
) -> models.Environment:
    db_environment = models.Environment(
        id=environment.id,
        name=environment.name,
        description=environment.description,
    )
    db.add(db_environment)
    await db.commit()
    await db.refresh(db_environment)
    return db_environment


async def get_runs(
    db: AsyncSession,
    commit_sha: Optional[str] = None,
    binary_id: Optional[str] = None,
    environment_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[models.Run]:
    query = select(models.Run).order_by(desc(models.Run.timestamp))

    if commit_sha:
        query = query.where(models.Run.commit_sha == commit_sha)
    if binary_id:
        query = query.where(models.Run.binary_id == binary_id)
    if environment_id:
        query = query.where(models.Run.environment_id == environment_id)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


async def get_runs_with_commits(
    db: AsyncSession,
    commit_sha: Optional[str] = None,
    binary_id: Optional[str] = None,
    environment_id: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[tuple]:
    """Get runs with their associated commit information."""
    query = (
        select(models.Run, models.Commit)
        .join(models.Commit, models.Run.commit_sha == models.Commit.sha)
        .order_by(desc(models.Run.timestamp))
    )

    if commit_sha:
        # Use prefix matching (starts with) for commit SHA
        query = query.where(models.Run.commit_sha.ilike(f"{commit_sha}%"))
    if binary_id:
        query = query.where(models.Run.binary_id == binary_id)
    if environment_id:
        query = query.where(models.Run.environment_id == environment_id)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.all()


async def count_runs(
    db: AsyncSession,
    commit_sha: Optional[str] = None,
    binary_id: Optional[str] = None,
    environment_id: Optional[str] = None,
) -> int:
    """Count total runs matching the filter criteria."""
    query = select(func.count(models.Run.run_id))

    if commit_sha:
        # Use prefix matching (starts with) for commit SHA
        query = query.where(models.Run.commit_sha.ilike(f"{commit_sha}%"))
    if binary_id:
        query = query.where(models.Run.binary_id == binary_id)
    if environment_id:
        query = query.where(models.Run.environment_id == environment_id)

    result = await db.execute(query)
    return result.scalar() or 0


async def create_run(db: AsyncSession, run: schemas.RunCreate) -> models.Run:
    # Convert timezone-aware timestamp to timezone-naive for database storage
    timestamp = run.timestamp
    if timestamp.tzinfo is not None:
        timestamp = timestamp.replace(tzinfo=None)

    db_run = models.Run(
        run_id=run.run_id,
        commit_sha=run.commit_sha,
        binary_id=run.binary_id,
        environment_id=run.environment_id,
        python_major=run.python_version.major,
        python_minor=run.python_version.minor,
        python_patch=run.python_version.patch,
        timestamp=timestamp,
    )
    db.add(db_run)
    await db.commit()
    await db.refresh(db_run)
    return db_run


async def get_benchmark_results(
    db: AsyncSession,
    run_id: Optional[str] = None,
    benchmark_name: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
) -> List[models.BenchmarkResult]:
    query = select(models.BenchmarkResult)

    if run_id:
        query = query.where(models.BenchmarkResult.run_id == run_id)
    if benchmark_name:
        query = query.where(models.BenchmarkResult.benchmark_name == benchmark_name)

    query = query.offset(skip).limit(limit)
    result = await db.execute(query)
    return result.scalars().all()


async def create_benchmark_result(
    db: AsyncSession, result: schemas.BenchmarkResultCreate
) -> models.BenchmarkResult:
    result_id = f"{result.run_id}_{result.benchmark_name.replace('_', '-')}"

    db_result = models.BenchmarkResult(
        id=result_id,
        run_id=result.run_id,
        benchmark_name=result.benchmark_name,
        high_watermark_bytes=result.result_json.high_watermark_bytes,
        allocation_histogram=result.result_json.allocation_histogram,
        total_allocated_bytes=result.result_json.total_allocated_bytes,
        top_allocating_functions=[
            func.dict() for func in result.result_json.top_allocating_functions
        ],
        flamegraph_html=result.flamegraph_html,
    )
    db.add(db_result)
    await db.commit()
    await db.refresh(db_result)
    return db_result


async def get_benchmark_result_by_id(
    db: AsyncSession, result_id: str
) -> Optional[models.BenchmarkResult]:
    result = await db.execute(
        select(models.BenchmarkResult).where(models.BenchmarkResult.id == result_id)
    )
    return result.scalars().first()


async def get_python_version_filters(db: AsyncSession) -> List[Dict[str, Any]]:
    result = await db.execute(
        select(
            models.Run.python_major,
            models.Run.python_minor,
        )
        .join(models.BenchmarkResult)
        .distinct()
        .order_by(desc(models.Run.python_major), desc(models.Run.python_minor))
    )

    versions = []
    for major, minor in result:
        versions.append(
            {
                "label": f"{major}.{minor}",
                "major": major,
                "minor": minor,
            }
        )

    return versions


async def get_previous_commit_with_binary_and_environment(
    db: AsyncSession, current_commit: models.Commit, binary_id: str, environment_id: str
) -> Optional[models.Commit]:
    """
    Efficiently find the previous commit that:
    1. Has an earlier timestamp than the current commit
    2. Has the same Python major.minor version
    3. Was tested with the same binary configuration and environment
    """
    result = await db.execute(
        select(models.Commit)
        .join(models.Run, models.Commit.sha == models.Run.commit_sha)
        .where(
            and_(
                models.Commit.timestamp < current_commit.timestamp,
                models.Commit.python_major == current_commit.python_major,
                models.Commit.python_minor == current_commit.python_minor,
                models.Run.binary_id == binary_id,
                models.Run.environment_id == environment_id,
            )
        )
        .order_by(desc(models.Commit.timestamp))
        .limit(1)
    )
    return result.scalars().first()


async def get_environments_for_binary(
    db: AsyncSession, binary_id: str
) -> List[Dict[str, Any]]:
    """
    Get all environments where this binary has been tested, with commit counts
    """
    result = await db.execute(
        select(
            models.Environment.id,
            models.Environment.name,
            models.Environment.description,
            func.count(models.Run.run_id).label("run_count"),
            func.count(func.distinct(models.Run.commit_sha)).label("commit_count"),
        )
        .join(models.Run, models.Environment.id == models.Run.environment_id)
        .where(models.Run.binary_id == binary_id)
        .group_by(
            models.Environment.id,
            models.Environment.name,
            models.Environment.description,
        )
        .order_by(models.Environment.name)
    )

    environments = []
    for env_id, name, description, run_count, commit_count in result:
        environments.append(
            {
                "id": env_id,
                "name": name,
                "description": description,
                "run_count": run_count,
                "commit_count": commit_count,
            }
        )

    return environments


async def get_commits_for_binary_and_environment(
    db: AsyncSession, binary_id: str, environment_id: str
) -> List[Dict[str, Any]]:
    """
    Get all commits tested in a specific binary + environment combination
    """
    result = await db.execute(
        select(models.Commit, models.Run.timestamp.label("run_timestamp"))
        .join(models.Run, models.Commit.sha == models.Run.commit_sha)
        .where(
            and_(
                models.Run.binary_id == binary_id,
                models.Run.environment_id == environment_id,
            )
        )
        .order_by(desc(models.Run.timestamp))
    )

    commits = []
    for commit, run_timestamp in result:
        commits.append(
            {
                "sha": commit.sha,
                "timestamp": commit.timestamp,
                "message": commit.message,
                "author": commit.author,
                "python_version": {
                    "major": commit.python_major,
                    "minor": commit.python_minor,
                    "patch": commit.python_patch,
                },
                "run_timestamp": run_timestamp,
            }
        )

    return commits


# Auth Token CRUD operations
async def get_auth_token_by_token(
    db: AsyncSession, token: str
) -> Optional[models.AuthToken]:
    """Get an auth token by its token value."""
    result = await db.execute(
        select(models.AuthToken).where(
            and_(models.AuthToken.token == token, models.AuthToken.is_active == True)
        )
    )
    return result.scalars().first()


async def create_auth_token(
    db: AsyncSession, token: str, name: str, description: str = None
) -> models.AuthToken:
    """Create a new auth token."""
    db_token = models.AuthToken(token=token, name=name, description=description)
    db.add(db_token)
    await db.commit()
    await db.refresh(db_token)
    return db_token


async def update_token_last_used(db: AsyncSession, token: str) -> None:
    """Update the last_used timestamp for a token."""
    result = await db.execute(
        select(models.AuthToken).where(models.AuthToken.token == token)
    )
    auth_token = result.scalars().first()
    if auth_token:
        auth_token.last_used = datetime.now(UTC).replace(tzinfo=None)
        await db.commit()


async def get_all_auth_tokens(db: AsyncSession) -> List[models.AuthToken]:
    """Get all auth tokens (for admin purposes)."""
    result = await db.execute(
        select(models.AuthToken).order_by(desc(models.AuthToken.created_at))
    )
    return result.scalars().all()


async def deactivate_auth_token(db: AsyncSession, token_id: int) -> bool:
    """Deactivate an auth token by ID."""
    result = await db.execute(
        select(models.AuthToken).where(models.AuthToken.id == token_id)
    )
    auth_token = result.scalars().first()
    if auth_token:
        auth_token.is_active = False
        await db.commit()
        return True
    return False


# Admin Users CRUD Operations
async def get_admin_users(db: AsyncSession) -> List[models.AdminUser]:
    """Get all admin users."""
    result = await db.execute(
        select(models.AdminUser)
        .where(models.AdminUser.is_active == True)
        .order_by(models.AdminUser.added_at)
    )
    return result.scalars().all()


async def get_admin_user_by_username(
    db: AsyncSession, username: str
) -> Optional[models.AdminUser]:
    """Get admin user by GitHub username."""
    result = await db.execute(
        select(models.AdminUser).where(
            and_(
                models.AdminUser.github_username == username,
                models.AdminUser.is_active == True,
            )
        )
    )
    return result.scalars().first()


async def create_admin_user(
    db: AsyncSession, username: str, added_by: str, notes: Optional[str] = None
) -> models.AdminUser:
    """Create a new admin user."""
    admin_user = models.AdminUser(
        github_username=username, added_by=added_by, notes=notes
    )
    db.add(admin_user)
    await db.commit()
    await db.refresh(admin_user)
    return admin_user


async def deactivate_admin_user(db: AsyncSession, username: str) -> bool:
    """Deactivate an admin user."""
    result = await db.execute(
        select(models.AdminUser).where(models.AdminUser.github_username == username)
    )
    admin_user = result.scalars().first()
    if admin_user:
        admin_user.is_active = False
        await db.commit()
        return True
    return False


async def is_admin_user(db: AsyncSession, username: str) -> bool:
    """Check if a user is an admin."""
    admin_user = await get_admin_user_by_username(db, username)
    return admin_user is not None


async def ensure_initial_admin(db: AsyncSession, username: str) -> None:
    """Ensure the initial admin user exists."""
    if not username:
        return

    existing = await get_admin_user_by_username(db, username)
    if not existing:
        logger.info(f"Creating initial admin user: {username}")
        await create_admin_user(
            db, username, "system", "Initial admin from environment variable"
        )
    else:
        logger.info(f"Initial admin user already exists: {username}")
