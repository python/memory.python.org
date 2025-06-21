import logging
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.orm import sessionmaker
from sqlalchemy.exc import OperationalError, StatementError
from .models import Base
from .config import get_settings

logger = logging.getLogger(__name__)

def create_database_engine():
    """Create database engine with proper configuration."""
    settings = get_settings()
    
    engine_kwargs = {
        "echo": settings.database_echo,
        "pool_size": settings.database_pool_size,
        "max_overflow": settings.database_max_overflow,
        "pool_pre_ping": settings.database_pool_pre_ping,
        "pool_recycle": settings.database_pool_recycle,
        # Add connection timeout for production
        "connect_args": {"timeout": 30} if "sqlite" in settings.database_url else {},
    }
    
    # Add additional PostgreSQL/MySQL specific optimizations
    if "postgresql" in settings.database_url:
        engine_kwargs["connect_args"] = {
            "server_settings": {
                "application_name": "memory_tracker_api",
                "jit": "off",  # Disable JIT for better connection performance
            }
        }
    elif "mysql" in settings.database_url:
        engine_kwargs["connect_args"] = {
            "charset": "utf8mb4",
            "autocommit": False,
        }
    
    logger.info(
        f"Creating database engine: {settings.database_url.split('@')[-1] if '@' in settings.database_url else settings.database_url}"
    )
    logger.info(
        f"Pool configuration: size={settings.database_pool_size}, "
        f"max_overflow={settings.database_max_overflow}, "
        f"recycle={settings.database_pool_recycle}s"
    )
    
    return create_async_engine(settings.database_url, **engine_kwargs)

# Create engine using factory function
engine = create_database_engine()
AsyncSessionLocal = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)


async def get_database():
    """Get database session with proper error handling and cleanup."""
    session = AsyncSessionLocal()
    try:
        yield session
    except OperationalError as e:
        logger.error(f"Database operational error: {e}")
        await session.rollback()
        raise
    except StatementError as e:
        logger.error(f"Database statement error: {e}")
        await session.rollback()
        raise
    except Exception as e:
        logger.error(f"Unexpected database error: {e}")
        await session.rollback()
        raise
    finally:
        await session.close()


async def create_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def drop_tables():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


from contextlib import asynccontextmanager
from typing import AsyncGenerator

@asynccontextmanager
async def transaction_scope() -> AsyncGenerator[AsyncSession, None]:
    """
    Context manager for database transactions.
    Automatically commits on success and rolls back on exception.
    """
    session = AsyncSessionLocal()
    try:
        async with session.begin():
            yield session
    except Exception as e:
        logger.error(f"Transaction failed, rolling back: {e}")
        await session.rollback()
        raise
    finally:
        await session.close()


async def execute_in_transaction(func, *args, **kwargs):
    """
    Execute a function within a database transaction.
    Useful for bulk operations that need to be atomic.
    """
    async with transaction_scope() as session:
        return await func(session, *args, **kwargs)


def get_async_session_local():
    """Get the async session local for scripts that need it."""
    return AsyncSessionLocal
