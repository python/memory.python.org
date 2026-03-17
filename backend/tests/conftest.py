"""Shared fixtures for backend tests."""

import secrets
from datetime import datetime, timedelta

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool

from app.database import get_database
from app.factory import create_app
from app.config import Settings
from app.models import Base, AuthToken, AdminUser, AdminSession


@pytest.fixture(scope="session")
def test_settings():
    return Settings(
        database_url="sqlite+aiosqlite://",
        cors_origins="http://localhost:9002",
        admin_initial_username="test_admin",
        enable_health_check_db=False,
        log_level="WARNING",
    )


@pytest_asyncio.fixture
async def db_engine():
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        echo=False,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine):
    session_factory = async_sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        yield session


@pytest_asyncio.fixture
async def app(db_engine, test_settings):
    session_factory = async_sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False
    )

    async def _override_get_database():
        async with session_factory() as session:
            yield session

    application = create_app(settings=test_settings)
    application.dependency_overrides[get_database] = _override_get_database
    yield application
    application.dependency_overrides.clear()


@pytest_asyncio.fixture
async def client(app):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        yield c


@pytest_asyncio.fixture
async def auth_token(db_session):
    """Create an active auth token and return (token_string, token_model)."""
    raw_token = secrets.token_hex(32)
    token = AuthToken(
        token=raw_token,
        name="test-worker",
        description="Token for testing",
    )
    db_session.add(token)
    await db_session.commit()
    await db_session.refresh(token)
    return raw_token, token


@pytest_asyncio.fixture
async def auth_headers(auth_token):
    """Authorization headers for authenticated requests."""
    raw_token, _ = auth_token
    return {"Authorization": f"Bearer {raw_token}"}


@pytest_asyncio.fixture
async def admin_user(db_session):
    user = AdminUser(
        github_username="test_admin",
        added_by="system",
        notes="Test admin",
    )
    db_session.add(user)
    await db_session.commit()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def admin_session(db_session, admin_user):
    """Create an admin session and return (session_token, session_model)."""
    raw_token = secrets.token_hex(32)
    session = AdminSession(
        session_token=raw_token,
        github_user_id=12345,
        github_username=admin_user.github_username,
        github_name="Test Admin",
        github_email="admin@test.com",
        github_avatar_url="https://example.com/avatar.png",
        expires_at=datetime.now() + timedelta(hours=24),
    )
    db_session.add(session)
    await db_session.commit()
    await db_session.refresh(session)
    return raw_token, session


@pytest_asyncio.fixture
async def admin_cookies(admin_session):
    """Cookies dict for admin-authenticated requests."""
    raw_token, _ = admin_session
    return {"admin_session": raw_token}


@pytest_asyncio.fixture
async def sample_binary(db_session):
    from app.models import Binary
    binary = Binary(
        id="default",
        name="Default",
        flags=["--enable-optimizations"],
        description="Standard build",
        color="#8b5cf6",
        icon="server",
        display_order=0,
    )
    db_session.add(binary)
    await db_session.commit()
    await db_session.refresh(binary)
    return binary


@pytest_asyncio.fixture
async def sample_environment(db_session):
    from app.models import Environment
    env = Environment(
        id="linux-x86_64",
        name="Linux x86_64",
        description="Standard Linux build environment",
    )
    db_session.add(env)
    await db_session.commit()
    await db_session.refresh(env)
    return env


@pytest_asyncio.fixture
async def sample_commit(db_session):
    from app.models import Commit
    commit = Commit(
        sha="a" * 40,
        timestamp=datetime(2025, 6, 15, 12, 0, 0),
        message="Test commit",
        author="Test Author",
        python_major=3,
        python_minor=14,
        python_patch=0,
    )
    db_session.add(commit)
    await db_session.commit()
    await db_session.refresh(commit)
    return commit


@pytest_asyncio.fixture
async def sample_run(db_session, sample_commit, sample_binary, sample_environment):
    from app.models import Run
    run = Run(
        run_id="run_test_001",
        commit_sha=sample_commit.sha,
        binary_id=sample_binary.id,
        environment_id=sample_environment.id,
        python_major=3,
        python_minor=14,
        python_patch=0,
        timestamp=datetime(2025, 6, 15, 12, 30, 0),
    )
    db_session.add(run)
    await db_session.commit()
    await db_session.refresh(run)
    return run


@pytest_asyncio.fixture
async def sample_benchmark_result(db_session, sample_run):
    from app.models import BenchmarkResult
    result = BenchmarkResult(
        id=f"{sample_run.run_id}_json-dumps",
        run_id=sample_run.run_id,
        benchmark_name="json_dumps",
        high_watermark_bytes=1_000_000,
        allocation_histogram=[[64, 500], [128, 300], [256, 100]],
        total_allocated_bytes=5_000_000,
        top_allocating_functions=[
            {"function": "json.dumps", "count": 100, "total_size": 500_000}
        ],
        flamegraph_html="<html>flamegraph</html>",
    )
    db_session.add(result)
    await db_session.commit()
    await db_session.refresh(result)
    return result
