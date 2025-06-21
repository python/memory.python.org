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

    try:
        # Import models to ensure they're registered
        from app.models import AdminUser, AdminSession, AuthToken, Commit, Binary, Environment, Run, BenchmarkResult
        
        await create_tables()
        print("✅ Database tables created successfully!")
        
        # Initialize admin data
        admin_success = await init_admin_data()
        if not admin_success:
            return False
            
    except Exception as e:
        print(f"❌ Error creating database tables: {e}")
        return False

    return True


async def reset_database():
    """Reset the database by dropping and recreating all tables."""
    print("Resetting database...")

    try:
        # Import models to ensure they're registered
        from app.models import AdminUser, AdminSession, AuthToken, Commit, Binary, Environment, Run, BenchmarkResult
        
        await drop_tables()
        print("🗑️  Existing tables dropped")

        await create_tables()
        print("✅ Database tables recreated successfully!")
        
        # Initialize admin data after reset
        admin_success = await init_admin_data()
        if not admin_success:
            return False
            
    except Exception as e:
        print(f"❌ Error resetting database: {e}")
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

    args = parser.parse_args()

    if args.reset:
        success = asyncio.run(reset_database())
    else:
        success = asyncio.run(init_database())

    if not success:
        sys.exit(1)
