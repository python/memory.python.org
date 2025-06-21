#!/usr/bin/env python3
"""
Script to populate the database with the standard binary configurations for CPython Memory Tracker.
These binaries match the frontend binary types.
"""

import asyncio
import sys
import os

# Add the parent directory to the path so we can import from app
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import schemas, crud, models
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession


def create_database_session(database_url: str = None):
    """Create database connection from URL."""
    if not database_url:
        database_url = os.getenv(
            "DATABASE_URL", "sqlite+aiosqlite:///./memory_tracker.db"
        )

    engine = create_async_engine(database_url, echo=False)
    async_session = async_sessionmaker(
        engine, class_=AsyncSession, expire_on_commit=False
    )
    return engine, async_session


async def create_tables_for_engine(engine):
    """Create tables using the provided engine."""
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)


def get_standard_binaries():
    """Get the standard binary configurations that match the frontend."""
    return [
        {
            "id": "default",
            "name": "Default Build",
            "flags": [],
            "description": "Standard CPython build with default compilation settings. Used as baseline for performance comparisons.",
            "color": "#3b82f6",
            "icon": "settings",
            "display_order": 0,
        },
        {
            "id": "debug",
            "name": "Debug Build",
            "flags": ["--with-debug"],
            "description": "Debug build with additional runtime checks and debugging symbols. Higher memory usage but better error detection.",
            "color": "#ef4444",
            "icon": "bug",
            "display_order": 1,
        },
        {
            "id": "pgo",
            "name": "PGO Build",
            "flags": ["--enable-optimizations"],
            "description": "Profile Guided Optimization build. Uses runtime profiling data to optimize frequently executed code paths.",
            "color": "#6366f1",
            "icon": "zap",
            "display_order": 2,
        },
        {
            "id": "lto",
            "name": "LTO Build",
            "flags": ["--with-lto"],
            "description": "Link Time Optimization enabled. Performs cross-module optimizations for better performance.",
            "color": "#10b981",
            "icon": "gauge",
            "display_order": 3,
        },
        {
            "id": "lto-pgo",
            "name": "LTO + PGO Build",
            "flags": ["--with-lto", "--enable-optimizations"],
            "description": "Highly optimized build combining Link Time Optimization with Profile Guided Optimization. Maximum performance with cross-module optimizations and runtime profiling data.",
            "color": "#8b5cf6",
            "icon": "rocket",
            "display_order": 4,
        },
        {
            "id": "nogil",
            "name": "No GIL Build",
            "flags": ["--disable-gil"],
            "description": "Experimental build without the Global Interpreter Lock (GIL). Enables true parallelism for CPU-bound tasks.",
            "color": "#f59e0b",
            "icon": "zap",
            "display_order": 5,
        },
        {
            "id": "debug-nogil",
            "name": "Debug No GIL Build",
            "flags": ["--with-debug", "--disable-gil"],
            "description": "Debug build combined with no-GIL features. Best for development and testing of parallel applications.",
            "color": "#a855f7",
            "icon": "shield",
            "display_order": 6,
        },
        {
            "id": "trace",
            "name": "Trace Build",
            "flags": ["--with-trace-refs"],
            "description": "Build with trace reference counting enabled. Useful for memory leak detection and debugging.",
            "color": "#06b6d4",
            "icon": "search",
            "display_order": 7,
        },
    ]


async def populate_binaries(force: bool = False, database_url: str = None):
    """Populate the database with standard binary configurations."""
    engine, AsyncSessionLocal = create_database_session(database_url)

    # Ensure database tables exist
    await create_tables_for_engine(engine)

    async with AsyncSessionLocal() as db:
        try:
            binaries_data = get_standard_binaries()
            created_count = 0
            updated_count = 0
            skipped_count = 0

            print(f"Populating {len(binaries_data)} standard binary configurations...")

            for binary_data in binaries_data:
                binary_id = binary_data["id"]

                # Check if binary already exists
                existing_binary = await crud.get_binary_by_id(db, binary_id=binary_id)

                if existing_binary:
                    if force:
                        # Update existing binary
                        existing_binary.name = binary_data["name"]
                        existing_binary.flags = binary_data["flags"]
                        existing_binary.description = binary_data["description"]
                        existing_binary.color = binary_data.get("color", "#8b5cf6")
                        existing_binary.icon = binary_data.get("icon", "server")
                        existing_binary.display_order = binary_data.get("display_order", 0)
                        await db.commit()
                        print(f"✅ Updated binary '{binary_id}': {binary_data['name']}")
                        print(f"   Flags: {binary_data['flags']}")
                        print(f"   Description: {binary_data['description']}")
                        print(f"   Color: {binary_data.get('color', '#8b5cf6')}, Icon: {binary_data.get('icon', 'server')}")
                        updated_count += 1
                    else:
                        print(
                            f"⚠️  Binary '{binary_id}' already exists (use --force to update)"
                        )
                        print(
                            f"   Current: {existing_binary.name} with flags {existing_binary.flags}"
                        )
                        skipped_count += 1
                else:
                    # Create new binary
                    binary_create = schemas.BinaryCreate(
                        id=binary_id,
                        name=binary_data["name"],
                        flags=binary_data["flags"],
                        description=binary_data["description"],
                        color=binary_data.get("color", "#8b5cf6"),
                        icon=binary_data.get("icon", "server"),
                        display_order=binary_data.get("display_order", 0),
                    )

                    new_binary = await crud.create_binary(db, binary_create)
                    print(f"✅ Created binary '{binary_id}': {binary_data['name']}")
                    print(f"   Flags: {binary_data['flags']}")
                    print(f"   Description: {binary_data['description']}")
                    created_count += 1

            print(f"\n🎉 Binary population completed!")
            print(f"   - Created: {created_count} binaries")
            print(f"   - Updated: {updated_count} binaries")
            print(f"   - Skipped: {skipped_count} binaries")

            return True

        except Exception as e:
            print(f"❌ Error populating binaries: {e}")
            await db.rollback()
            return False


async def list_binaries(database_url: str = None):
    """List all currently registered binaries."""
    engine, AsyncSessionLocal = create_database_session(database_url)
    await create_tables_for_engine(engine)

    async with AsyncSessionLocal() as db:
        try:
            binaries = await crud.get_binaries(db)

            if not binaries:
                print("No binaries currently registered.")
                return

            print("Currently registered binaries:")
            for binary in binaries:
                flags_str = " ".join(binary.flags) if binary.flags else "none"
                print(f"  - {binary.id}: {binary.name} (flags: {flags_str})")

        except Exception as e:
            print(f"❌ Error listing binaries: {e}")


def main():
    import argparse

    parser = argparse.ArgumentParser(
        description="Populate database with standard binary configurations",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
This script creates the standard set of binary configurations that match the frontend:
  - default: Standard CPython build (baseline)
  - debug: Debug build with runtime checks
  - nogil: Experimental no-GIL build  
  - debug-nogil: Debug + no-GIL combination
  - lto: Link Time Optimization enabled
  - pgo: Profile Guided Optimization  
  - lto-pgo: Highly optimized LTO + PGO combination
  - trace: Trace reference counting
  - valgrind: Valgrind-optimized build

Examples:
  # Populate standard binaries
  python populate_binaries.py
  
  # Force update existing binaries
  python populate_binaries.py --force
  
  # List current binaries
  python populate_binaries.py --list
""",
    )

    parser.add_argument(
        "--force",
        "-f",
        action="store_true",
        help="Force update existing binaries with new configurations",
    )
    parser.add_argument(
        "--list",
        "-l",
        action="store_true",
        help="List all currently registered binaries",
    )
    parser.add_argument(
        "--database-url",
        "--db-url",
        help="Database URL (default: sqlite+aiosqlite:///./memory_tracker.db or DATABASE_URL env var)",
        default=None,
    )

    args = parser.parse_args()

    if args.list:
        success = asyncio.run(list_binaries(args.database_url))
    else:
        success = asyncio.run(
            populate_binaries(force=args.force, database_url=args.database_url)
        )
        if not success:
            sys.exit(1)


if __name__ == "__main__":
    main()
