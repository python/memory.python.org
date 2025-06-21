#!/usr/bin/env python3
"""
Comprehensive token management script for the CPython Memory Tracker API.
Provides full administrative capabilities for authentication tokens including
creation, listing, querying, updating, and analytics.
"""

import asyncio
import sys
import os
import secrets
import hashlib
import argparse
import json
from datetime import datetime, timedelta, UTC
from typing import List, Dict, Any, Optional

# Add the parent directory to the path so we can import from app
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from app import crud, models
from sqlalchemy import select, func, and_, desc
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker


class DatabaseManager:
    """Database connection manager that can work with different database URLs."""

    def __init__(self, database_url: str = None):
        if not database_url:
            database_url = os.getenv(
                "DATABASE_URL", "sqlite+aiosqlite:///./memory_tracker.db"
            )

        self.database_url = database_url
        self.engine = create_async_engine(database_url, echo=False)
        self.AsyncSession = async_sessionmaker(
            self.engine, class_=AsyncSession, expire_on_commit=False
        )

    async def create_tables(self):
        """Create tables using the configured engine."""
        async with self.engine.begin() as conn:
            await conn.run_sync(models.Base.metadata.create_all)

    async def get_session(self):
        """Get a database session."""
        return self.AsyncSession()


# Global database manager (will be set by CLI)
db_manager = None


def generate_secure_token(length: int = 32) -> str:
    """Generate a cryptographically secure random token."""
    # Generate random bytes and encode as hex
    token_bytes = secrets.token_bytes(length)
    return token_bytes.hex()


async def create_token(name: str, description: str = None) -> str:
    """Create a new authentication token in the database."""
    # Ensure database tables exist
    await db_manager.create_tables()

    async with db_manager.AsyncSession() as db:
        try:
            # Generate a secure token
            token = generate_secure_token()

            # Create the token in the database
            auth_token = await crud.create_auth_token(db, token, name, description)

            print(f"✅ Successfully created authentication token!")
            print(f"   ID: {auth_token.id}")
            print(f"   Name: {auth_token.name}")
            print(f"   Description: {auth_token.description or 'None'}")
            print(f"   Created: {auth_token.created_at}")
            print(f"   Active: {auth_token.is_active}")
            print()
            print(f"🔑 TOKEN: {token}")
            print()
            print("⚠️  IMPORTANT:")
            print("   - Save this token securely - it cannot be recovered!")
            print(
                "   - Use this token with the worker via --auth-token or MEMORY_TRACKER_TOKEN environment variable"
            )
            print("   - Example: export MEMORY_TRACKER_TOKEN=" + token)
            print()

            return token

        except Exception as e:
            print(f"❌ Error creating token: {e}")
            await db.rollback()
            raise


async def list_tokens() -> None:
    """List all existing authentication tokens."""
    # Ensure database tables exist
    await db_manager.create_tables()

    async with db_manager.AsyncSession() as db:
        try:
            tokens = await crud.get_all_auth_tokens(db)

            if not tokens:
                print("No authentication tokens found.")
                return

            print("Authentication Tokens:")
            print("-" * 80)
            print(
                f"{'ID':<4} {'Name':<20} {'Status':<8} {'Created':<20} {'Last Used':<20}"
            )
            print("-" * 80)

            for token in tokens:
                status = "Active" if token.is_active else "Inactive"
                last_used = (
                    token.last_used.strftime("%Y-%m-%d %H:%M:%S")
                    if token.last_used
                    else "Never"
                )
                created = token.created_at.strftime("%Y-%m-%d %H:%M:%S")

                print(
                    f"{token.id:<4} {token.name[:20]:<20} {status:<8} {created:<20} {last_used:<20}"
                )
                if token.description:
                    print(f"     Description: {token.description}")

            print("-" * 80)
            print(f"Total: {len(tokens)} tokens")

        except Exception as e:
            print(f"❌ Error listing tokens: {e}")


async def deactivate_token(token_id: int) -> None:
    """Deactivate an authentication token."""
    # Ensure database tables exist
    await create_tables()

    async with AsyncSessionLocal() as db:
        try:
            success = await crud.deactivate_auth_token(db, token_id)
            if success:
                print(f"✅ Successfully deactivated token ID {token_id}")
            else:
                print(f"❌ Token ID {token_id} not found")
                sys.exit(1)

        except Exception as e:
            print(f"❌ Error deactivating token: {e}")
            sys.exit(1)


async def reactivate_token(token_id: int) -> None:
    """Reactivate a deactivated authentication token."""
    await create_tables()

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(
                select(models.AuthToken).where(models.AuthToken.id == token_id)
            )
            auth_token = result.scalars().first()

            if not auth_token:
                print(f"❌ Token ID {token_id} not found")
                sys.exit(1)

            if auth_token.is_active:
                print(f"⚠️  Token ID {token_id} is already active")
                return

            auth_token.is_active = True
            await db.commit()
            print(f"✅ Successfully reactivated token ID {token_id}")

        except Exception as e:
            print(f"❌ Error reactivating token: {e}")
            sys.exit(1)


async def update_token_info(
    token_id: int, name: str = None, description: str = None
) -> None:
    """Update token name and/or description."""
    await create_tables()

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(
                select(models.AuthToken).where(models.AuthToken.id == token_id)
            )
            auth_token = result.scalars().first()

            if not auth_token:
                print(f"❌ Token ID {token_id} not found")
                sys.exit(1)

            updated_fields = []
            if name is not None:
                auth_token.name = name
                updated_fields.append(f"name -> '{name}'")

            if description is not None:
                auth_token.description = description
                updated_fields.append(f"description -> '{description}'")

            if not updated_fields:
                print("⚠️  No fields to update")
                return

            await db.commit()
            print(f"✅ Successfully updated token ID {token_id}:")
            for field in updated_fields:
                print(f"   - {field}")

        except Exception as e:
            print(f"❌ Error updating token: {e}")
            sys.exit(1)


async def search_tokens(
    name_pattern: str = None,
    description_pattern: str = None,
    active_only: bool = False,
    inactive_only: bool = False,
) -> None:
    """Search tokens by name or description patterns."""
    await create_tables()

    async with AsyncSessionLocal() as db:
        try:
            query = select(models.AuthToken)

            # Apply filters
            conditions = []

            if name_pattern:
                conditions.append(models.AuthToken.name.ilike(f"%{name_pattern}%"))

            if description_pattern:
                conditions.append(
                    models.AuthToken.description.ilike(f"%{description_pattern}%")
                )

            if active_only:
                conditions.append(models.AuthToken.is_active == True)
            elif inactive_only:
                conditions.append(models.AuthToken.is_active == False)

            if conditions:
                query = query.where(and_(*conditions))

            query = query.order_by(desc(models.AuthToken.created_at))

            result = await db.execute(query)
            tokens = result.scalars().all()

            if not tokens:
                print("No tokens found matching the criteria.")
                return

            # Build search criteria description
            criteria = []
            if name_pattern:
                criteria.append(f"name contains '{name_pattern}'")
            if description_pattern:
                criteria.append(f"description contains '{description_pattern}'")
            if active_only:
                criteria.append("active only")
            elif inactive_only:
                criteria.append("inactive only")

            print(
                f"Found {len(tokens)} token(s) matching: {', '.join(criteria) if criteria else 'all tokens'}"
            )
            print("-" * 80)
            print(
                f"{'ID':<4} {'Name':<20} {'Status':<8} {'Created':<20} {'Last Used':<20}"
            )
            print("-" * 80)

            for token in tokens:
                status = "Active" if token.is_active else "Inactive"
                last_used = (
                    token.last_used.strftime("%Y-%m-%d %H:%M:%S")
                    if token.last_used
                    else "Never"
                )
                created = token.created_at.strftime("%Y-%m-%d %H:%M:%S")

                print(
                    f"{token.id:<4} {token.name[:20]:<20} {status:<8} {created:<20} {last_used:<20}"
                )
                if token.description:
                    print(f"     Description: {token.description}")

        except Exception as e:
            print(f"❌ Error searching tokens: {e}")


async def show_token_details(token_id: int) -> None:
    """Show detailed information about a specific token."""
    await create_tables()

    async with AsyncSessionLocal() as db:
        try:
            result = await db.execute(
                select(models.AuthToken).where(models.AuthToken.id == token_id)
            )
            token = result.scalars().first()

            if not token:
                print(f"❌ Token ID {token_id} not found")
                sys.exit(1)

            print(f"Token Details - ID {token.id}")
            print("=" * 50)
            print(f"Name: {token.name}")
            print(f"Description: {token.description or 'None'}")
            print(f"Status: {'Active' if token.is_active else 'Inactive'}")
            print(f"Created: {token.created_at.strftime('%Y-%m-%d %H:%M:%S UTC')}")
            print(
                f"Last Used: {token.last_used.strftime('%Y-%m-%d %H:%M:%S UTC') if token.last_used else 'Never'}"
            )

            # Calculate usage statistics
            if token.last_used:
                time_since_last_use = datetime.utcnow() - token.last_used
                print(f"Time Since Last Use: {time_since_last_use}")

            token_age = datetime.utcnow() - token.created_at
            print(f"Token Age: {token_age}")

            # Show partial token for verification (first 8 and last 4 characters)
            masked_token = f"{token.token[:8]}...{token.token[-4:]}"
            print(f"Token (masked): {masked_token}")

        except Exception as e:
            print(f"❌ Error retrieving token details: {e}")


async def show_token_analytics() -> None:
    """Show analytics and statistics about token usage."""
    await create_tables()

    async with AsyncSessionLocal() as db:
        try:
            # Get basic counts
            total_result = await db.execute(select(func.count(models.AuthToken.id)))
            total_tokens = total_result.scalar()

            active_result = await db.execute(
                select(func.count(models.AuthToken.id)).where(
                    models.AuthToken.is_active == True
                )
            )
            active_tokens = active_result.scalar()

            used_result = await db.execute(
                select(func.count(models.AuthToken.id)).where(
                    models.AuthToken.last_used.is_not(None)
                )
            )
            used_tokens = used_result.scalar()

            # Get recent activity (last 30 days)
            thirty_days_ago = datetime.utcnow() - timedelta(days=30)
            recent_result = await db.execute(
                select(func.count(models.AuthToken.id)).where(
                    models.AuthToken.last_used >= thirty_days_ago
                )
            )
            recent_active = recent_result.scalar()

            # Get oldest and newest tokens
            oldest_result = await db.execute(
                select(models.AuthToken).order_by(models.AuthToken.created_at).limit(1)
            )
            oldest_token = oldest_result.scalars().first()

            newest_result = await db.execute(
                select(models.AuthToken)
                .order_by(desc(models.AuthToken.created_at))
                .limit(1)
            )
            newest_token = newest_result.scalars().first()

            # Get most recently used token
            most_recent_result = await db.execute(
                select(models.AuthToken)
                .where(models.AuthToken.last_used.is_not(None))
                .order_by(desc(models.AuthToken.last_used))
                .limit(1)
            )
            most_recent_token = most_recent_result.scalars().first()

            print("Token Analytics Dashboard")
            print("=" * 50)
            print(f"Total Tokens: {total_tokens}")
            print(f"Active Tokens: {active_tokens}")
            print(f"Inactive Tokens: {total_tokens - active_tokens}")
            print(f"Ever Used: {used_tokens}")
            print(f"Never Used: {total_tokens - used_tokens}")
            print(f"Used in Last 30 Days: {recent_active}")
            print()

            if oldest_token:
                print(
                    f"Oldest Token: '{oldest_token.name}' (created {oldest_token.created_at.strftime('%Y-%m-%d')})"
                )

            if newest_token:
                print(
                    f"Newest Token: '{newest_token.name}' (created {newest_token.created_at.strftime('%Y-%m-%d')})"
                )

            if most_recent_token:
                print(
                    f"Most Recently Used: '{most_recent_token.name}' (used {most_recent_token.last_used.strftime('%Y-%m-%d %H:%M:%S')})"
                )

            # Usage distribution
            print()
            print("Usage Distribution:")
            print("-" * 30)

            # Get tokens by last use categories
            never_used = total_tokens - used_tokens
            last_week = await db.execute(
                select(func.count(models.AuthToken.id)).where(
                    models.AuthToken.last_used
                    >= (datetime.utcnow() - timedelta(days=7))
                )
            )
            last_week_count = last_week.scalar()

            last_month = recent_active
            older_than_month = used_tokens - last_month

            print(f"Never Used: {never_used}")
            print(f"Used in Last Week: {last_week_count}")
            print(f"Used in Last Month: {last_month}")
            print(f"Used > 1 Month Ago: {older_than_month}")

        except Exception as e:
            print(f"❌ Error generating analytics: {e}")


async def cleanup_old_tokens(days: int = 90, dry_run: bool = True) -> None:
    """Clean up unused tokens older than specified days."""
    await create_tables()

    cutoff_date = datetime.utcnow() - timedelta(days=days)

    async with AsyncSessionLocal() as db:
        try:
            # Find tokens that are either never used and old, or inactive and old
            result = await db.execute(
                select(models.AuthToken).where(
                    and_(
                        models.AuthToken.created_at < cutoff_date,
                        models.AuthToken.last_used.is_(None),
                    )
                )
            )
            old_unused_tokens = result.scalars().all()

            result2 = await db.execute(
                select(models.AuthToken).where(
                    and_(
                        models.AuthToken.is_active == False,
                        models.AuthToken.created_at < cutoff_date,
                    )
                )
            )
            old_inactive_tokens = result2.scalars().all()

            # Combine and deduplicate
            tokens_to_cleanup = {
                token.id: token for token in old_unused_tokens + old_inactive_tokens
            }

            if not tokens_to_cleanup:
                print(
                    f"No tokens found for cleanup (older than {days} days and unused/inactive)"
                )
                return

            print(f"Found {len(tokens_to_cleanup)} token(s) for cleanup:")
            print("-" * 60)
            for token in tokens_to_cleanup.values():
                status = (
                    "Never Used"
                    if not token.last_used
                    else f"Inactive since {token.last_used.strftime('%Y-%m-%d')}"
                )
                print(f"ID {token.id}: '{token.name}' - {status}")

            if dry_run:
                print()
                print("🔍 DRY RUN - No tokens were actually deleted")
                print("Run with --no-dry-run to perform actual cleanup")
            else:
                print()
                confirm = input(
                    "❗ Are you sure you want to delete these tokens? (yes/no): "
                )
                if confirm.lower() == "yes":
                    for token_id in tokens_to_cleanup.keys():
                        await db.execute(
                            select(models.AuthToken).where(
                                models.AuthToken.id == token_id
                            )
                        )
                        token = (
                            (
                                await db.execute(
                                    select(models.AuthToken).where(
                                        models.AuthToken.id == token_id
                                    )
                                )
                            )
                            .scalars()
                            .first()
                        )
                        if token:
                            await db.delete(token)

                    await db.commit()
                    print(f"✅ Successfully deleted {len(tokens_to_cleanup)} token(s)")
                else:
                    print("❌ Cleanup cancelled")

        except Exception as e:
            print(f"❌ Error during cleanup: {e}")


async def export_tokens(
    format_type: str = "json", include_inactive: bool = True
) -> None:
    """Export token information (excluding actual token values)."""
    await create_tables()

    async with AsyncSessionLocal() as db:
        try:
            query = select(models.AuthToken)
            if not include_inactive:
                query = query.where(models.AuthToken.is_active == True)

            query = query.order_by(models.AuthToken.created_at)
            result = await db.execute(query)
            tokens = result.scalars().all()

            token_data = []
            for token in tokens:
                token_data.append(
                    {
                        "id": token.id,
                        "name": token.name,
                        "description": token.description,
                        "is_active": token.is_active,
                        "created_at": token.created_at.isoformat(),
                        "last_used": token.last_used.isoformat()
                        if token.last_used
                        else None,
                        "token_preview": f"{token.token[:8]}...{token.token[-4:]}",
                    }
                )

            if format_type == "json":
                print(json.dumps(token_data, indent=2))
            elif format_type == "csv":
                print(
                    "id,name,description,is_active,created_at,last_used,token_preview"
                )
                for token in token_data:
                    description = (token["description"] or "").replace('"', '""')
                    print(
                        f'{token["id"]},"{token["name"]}","{description}",{token["is_active"]},'
                        f"{token['created_at']},{token['last_used'] or ''},"
                        f"{token['token_preview']}"
                    )

        except Exception as e:
            print(f"❌ Error exporting tokens: {e}")


def main():
    """Main entry point."""
    global db_manager

    parser = argparse.ArgumentParser(
        description="Comprehensive authentication token management for CPython Memory Tracker",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
BASIC OPERATIONS:
  # Create a new token
  python manage_tokens.py create "CI System" --description "Token for automated benchmarking"
  
  # List all tokens
  python manage_tokens.py list
  
  # Show detailed info about a token
  python manage_tokens.py details 3
  
  # Deactivate/reactivate tokens
  python manage_tokens.py deactivate 3
  python manage_tokens.py reactivate 3

SEARCH AND QUERY:
  # Search by name pattern
  python manage_tokens.py search --name "CI"
  
  # Search by description
  python manage_tokens.py search --description "testing"
  
  # Show only active/inactive tokens
  python manage_tokens.py search --active-only
  python manage_tokens.py search --inactive-only

ANALYTICS AND MONITORING:
  # Show usage analytics dashboard
  python manage_tokens.py analytics
  
  # Export token data
  python manage_tokens.py export --format json
  python manage_tokens.py export --format csv --active-only

MAINTENANCE:
  # Update token information
  python manage_tokens.py update 3 --name "New Name" --description "New description"
  
  # Clean up old unused tokens (dry run)
  python manage_tokens.py cleanup --days 90
  
  # Actually perform cleanup
  python manage_tokens.py cleanup --days 90 --no-dry-run

USAGE WITH WORKER:
  export MEMORY_TRACKER_TOKEN=<token>
  memory-tracker benchmark ... 
""",
    )

    # Add global database URL argument
    parser.add_argument(
        "--database-url",
        "--db-url",
        help="Database URL (default: sqlite+aiosqlite:///./memory_tracker.db or DATABASE_URL env var)",
        default=None,
    )

    subparsers = parser.add_subparsers(dest="command", help="Available commands")

    # Create token command
    create_parser = subparsers.add_parser(
        "create", help="Create a new authentication token"
    )
    create_parser.add_argument(
        "name", help='Human-readable name for the token (e.g., "CI System", "John Doe")'
    )
    create_parser.add_argument(
        "--description", "-d", help="Optional description of the token purpose"
    )

    # List tokens command
    list_parser = subparsers.add_parser(
        "list", help="List all existing authentication tokens"
    )

    # Show token details command
    details_parser = subparsers.add_parser(
        "details", help="Show detailed information about a specific token"
    )
    details_parser.add_argument(
        "token_id", type=int, help="ID of the token to show details for"
    )

    # Search tokens command
    search_parser = subparsers.add_parser("search", help="Search and filter tokens")
    search_parser.add_argument(
        "--name", help="Search by name pattern (case-insensitive)"
    )
    search_parser.add_argument(
        "--description", help="Search by description pattern (case-insensitive)"
    )
    search_parser.add_argument(
        "--active-only", action="store_true", help="Show only active tokens"
    )
    search_parser.add_argument(
        "--inactive-only", action="store_true", help="Show only inactive tokens"
    )

    # Update token command
    update_parser = subparsers.add_parser(
        "update", help="Update token name and/or description"
    )
    update_parser.add_argument("token_id", type=int, help="ID of the token to update")
    update_parser.add_argument("--name", help="New name for the token")
    update_parser.add_argument("--description", help="New description for the token")

    # Deactivate token command
    deactivate_parser = subparsers.add_parser(
        "deactivate", help="Deactivate an authentication token"
    )
    deactivate_parser.add_argument(
        "token_id", type=int, help="ID of the token to deactivate"
    )

    # Reactivate token command
    reactivate_parser = subparsers.add_parser(
        "reactivate", help="Reactivate a deactivated authentication token"
    )
    reactivate_parser.add_argument(
        "token_id", type=int, help="ID of the token to reactivate"
    )

    # Analytics command
    analytics_parser = subparsers.add_parser(
        "analytics", help="Show token usage analytics and statistics"
    )

    # Export command
    export_parser = subparsers.add_parser("export", help="Export token information")
    export_parser.add_argument(
        "--format",
        choices=["json", "csv"],
        default="json",
        help="Export format (default: json)",
    )
    export_parser.add_argument(
        "--active-only", action="store_true", help="Export only active tokens"
    )

    # Cleanup command
    cleanup_parser = subparsers.add_parser("cleanup", help="Clean up old unused tokens")
    cleanup_parser.add_argument(
        "--days",
        type=int,
        default=90,
        help="Remove tokens older than this many days (default: 90)",
    )
    cleanup_parser.add_argument(
        "--no-dry-run",
        action="store_true",
        help="Actually perform cleanup (default is dry run)",
    )

    args = parser.parse_args()

    if not hasattr(args, "command") or not args.command:
        parser.print_help()
        sys.exit(1)

    # Initialize database manager with provided URL
    db_manager = DatabaseManager(args.database_url)

    # Execute commands
    if args.command == "create":
        asyncio.run(create_token(args.name, args.description))
    elif args.command == "list":
        asyncio.run(list_tokens())
    elif args.command == "details":
        asyncio.run(show_token_details(args.token_id))
    elif args.command == "search":
        asyncio.run(
            search_tokens(
                args.name, args.description, args.active_only, args.inactive_only
            )
        )
    elif args.command == "update":
        asyncio.run(update_token_info(args.token_id, args.name, args.description))
    elif args.command == "deactivate":
        asyncio.run(deactivate_token(args.token_id))
    elif args.command == "reactivate":
        asyncio.run(reactivate_token(args.token_id))
    elif args.command == "analytics":
        asyncio.run(show_token_analytics())
    elif args.command == "export":
        asyncio.run(export_tokens(args.format, not args.active_only))
    elif args.command == "cleanup":
        asyncio.run(cleanup_old_tokens(args.days, not args.no_dry_run))


if __name__ == "__main__":
    main()
