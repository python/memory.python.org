#!/usr/bin/env python3
"""
Database initialization script for CPython Memory Tracker.
This script creates all necessary tables in the SQLite database.
"""

import asyncio
import sys
import os

# Add the parent directory to the path so we can import from app
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app.database import create_tables, drop_tables, get_database
from app import crud
from app.config import get_settings


async def init_admin_data():
    """Initialize admin data including initial admin user."""
    settings = get_settings()
    
    if not settings.admin_initial_username:
        print("⚠️  No ADMIN_INITIAL_USERNAME set, skipping admin initialization")
        return True
    
    print(f"🔐 Initializing admin data for user: {settings.admin_initial_username}")
    
    try:
        async for db in get_database():
            # Check if admin user already exists
            existing_admin = await crud.get_admin_user_by_username(db, settings.admin_initial_username)
            if existing_admin:
                print(f"✅ Admin user '{settings.admin_initial_username}' already exists")
                return True
            
            # Create initial admin user
            admin_user = await crud.create_admin_user(
                db, 
                settings.admin_initial_username,
                "system",  # added_by
                "Initial admin user created during database initialization"
            )
            print(f"✅ Created initial admin user: {admin_user.github_username}")
            
            break  # Exit the async generator after first use
            
    except Exception as e:
        print(f"❌ Error initializing admin data: {e}")
        return False
    
    return True


async def init_database():
    """Initialize the database by creating all tables."""
    print("Initializing database...")
    
    settings = get_settings()

    try:
        # Import models to ensure they're registered
        from app.models import AdminUser, AdminSession, AuthToken, Commit, Binary, Environment, Run, BenchmarkResult, Base
        from app.database import create_database_engine
        
        # Create a fresh engine with current settings
        engine = create_database_engine()
        
        print(f"Connected to: {settings.database_url.split('@')[-1] if '@' in settings.database_url else settings.database_url}")
        
        # Create all tables
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("✅ Database tables created successfully!")
        
        # Close the engine we created
        await engine.dispose()
        
        # Initialize admin data
        admin_success = await init_admin_data()
        if not admin_success:
            return False
            
    except Exception as e:
        print(f"❌ Error creating database tables: {e}")
        import traceback
        traceback.print_exc()
        return False

    return True


async def reset_database():
    """Reset the database by dropping and recreating all tables."""
    print("Resetting database...")
    
    settings = get_settings()
    is_postgres = "postgresql" in settings.database_url

    try:
        # Import models to ensure they're registered
        from app.models import AdminUser, AdminSession, AuthToken, Commit, Binary, Environment, Run, BenchmarkResult, Base
        from app.database import create_database_engine
        from sqlalchemy.ext.asyncio import create_async_engine
        
        # Create a fresh engine with current settings
        engine = create_database_engine()
        
        print(f"Connected to: {settings.database_url.split('@')[-1] if '@' in settings.database_url else settings.database_url}")
        
        # For PostgreSQL, we need to handle foreign key constraints more carefully
        if is_postgres:
            async with engine.begin() as conn:
                # First, drop all dependent tables (those with foreign keys)
                print("🗑️  Dropping dependent tables...")
                await conn.run_sync(BenchmarkResult.__table__.drop, checkfirst=True)
                await conn.run_sync(Run.__table__.drop, checkfirst=True)
                await conn.run_sync(AdminSession.__table__.drop, checkfirst=True)
                
                # Then drop the referenced tables
                print("🗑️  Dropping referenced tables...")
                await conn.run_sync(Commit.__table__.drop, checkfirst=True)
                await conn.run_sync(Binary.__table__.drop, checkfirst=True)
                await conn.run_sync(Environment.__table__.drop, checkfirst=True)
                await conn.run_sync(AuthToken.__table__.drop, checkfirst=True)
                await conn.run_sync(AdminUser.__table__.drop, checkfirst=True)
                
                print("🗑️  All tables dropped")
        else:
            # For SQLite, drop all tables using metadata
            async with engine.begin() as conn:
                await conn.run_sync(Base.metadata.drop_all)
            print("🗑️  Existing tables dropped")

        # Recreate all tables
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        print("✅ Database tables recreated successfully!")
        
        # Close the engine we created
        await engine.dispose()
        
        # Initialize admin data after reset
        admin_success = await init_admin_data()
        if not admin_success:
            return False
            
    except Exception as e:
        print(f"❌ Error resetting database: {e}")
        import traceback
        traceback.print_exc()
        return False

    return True


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Initialize or reset the database")
    parser.add_argument(
        "--reset",
        action="store_true",
        help="Reset the database (drop and recreate tables)",
    )
    parser.add_argument(
        "--database-url",
        type=str,
        help="Database URL to use (overrides DATABASE_URL env var)",
    )

    args = parser.parse_args()

    # Override database URL if provided
    if args.database_url:
        os.environ["DATABASE_URL"] = args.database_url
        # Also try the lowercase version
        os.environ["database_url"] = args.database_url
        # Clear the settings cache so it picks up the new DATABASE_URL
        from app.config import get_settings
        get_settings.cache_clear()
        
        # Verify the database URL is actually being used
        settings = get_settings()
        print(f"Using database URL: {args.database_url.split('@')[-1] if '@' in args.database_url else args.database_url}")
        print(f"Settings database URL: {settings.database_url.split('@')[-1] if '@' in settings.database_url else settings.database_url}")

    if args.reset:
        success = asyncio.run(reset_database())
    else:
        success = asyncio.run(init_database())

    if not success:
        sys.exit(1)
