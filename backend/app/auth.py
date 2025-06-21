"""Authentication utilities for the Memory Tracker API."""

from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Annotated
import logging

from . import models, crud
from .database import get_database
from .logging_config import get_logger, user_id_var
from .exceptions import authentication_failed


# Security scheme
security = HTTPBearer(auto_error=False)


async def get_current_token(
    authorization: Annotated[str, Header()] = None,
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: AsyncSession = Depends(get_database),
) -> models.AuthToken:
    """
    Extract and validate auth token from Authorization header.
    Supports both 'Bearer <token>' and 'Token <token>' formats.
    """
    logger = get_logger("api.auth")
    token = None

    # Try to extract token from Authorization header
    if authorization:
        if authorization.startswith("Bearer "):
            token = authorization[7:]
        elif authorization.startswith("Token "):
            token = authorization[6:]
        else:
            token = authorization
    elif credentials:
        token = credentials.credentials

    if not token:
        logger.warning("Authentication failed: Missing token")
        raise authentication_failed("Missing authentication token")

    # Look up token in database
    auth_token = await crud.get_auth_token_by_token(db, token)
    if not auth_token:
        # Only log token length and first/last 4 characters for security
        masked_token = f"{token[:4]}...{token[-4:]}" if len(token) > 8 else "***"
        logger.warning(f"Authentication failed: Invalid token {masked_token} (length: {len(token)})")
        raise authentication_failed("Invalid or expired token")

    # Set user context for logging
    user_id_var.set(auth_token.name)

    # Update last used timestamp
    await crud.update_token_last_used(db, token)

    logger.info(f"Authentication successful for token: {auth_token.name}")
    return auth_token