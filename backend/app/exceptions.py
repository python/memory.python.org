"""Custom exception classes for the Memory Tracker API."""

from fastapi import HTTPException, status
from typing import Any, Dict, Optional


class MemoryTrackerException(Exception):
    """Base exception for Memory Tracker application."""
    
    def __init__(self, message: str, details: Optional[Dict[str, Any]] = None):
        self.message = message
        self.details = details or {}
        super().__init__(self.message)


class AuthenticationError(MemoryTrackerException):
    """Raised when authentication fails."""
    pass


class AuthorizationError(MemoryTrackerException):
    """Raised when user is authenticated but not authorized."""
    pass


class ValidationError(MemoryTrackerException):
    """Raised when input validation fails."""
    pass


class NotFoundError(MemoryTrackerException):
    """Raised when a requested resource is not found."""
    pass


class ConflictError(MemoryTrackerException):
    """Raised when there's a conflict with existing data."""
    pass


class DatabaseError(MemoryTrackerException):
    """Raised when database operations fail."""
    pass


class ExternalServiceError(MemoryTrackerException):
    """Raised when external service calls fail."""
    pass


def create_http_exception(
    exc: MemoryTrackerException,
    status_code: int,
    headers: Optional[Dict[str, str]] = None
) -> HTTPException:
    """Convert custom exception to HTTPException."""
    return HTTPException(
        status_code=status_code,
        detail={
            "message": exc.message,
            "details": exc.details,
            "type": exc.__class__.__name__
        },
        headers=headers
    )


# Common HTTP exception factories
def authentication_failed(message: str = "Authentication failed") -> HTTPException:
    """Create authentication failed exception."""
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=message,
        headers={"WWW-Authenticate": "Bearer"}
    )


def authorization_failed(message: str = "Insufficient permissions") -> HTTPException:
    """Create authorization failed exception."""
    return HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=message
    )


def not_found(resource: str, identifier: str = "") -> HTTPException:
    """Create not found exception."""
    detail = f"{resource} not found"
    if identifier:
        detail += f": {identifier}"
    return HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail=detail
    )


def validation_failed(message: str, field: str = "") -> HTTPException:
    """Create validation failed exception."""
    detail = {"message": message}
    if field:
        detail["field"] = field
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail=detail
    )


def conflict(message: str) -> HTTPException:
    """Create conflict exception."""
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail=message
    )


def internal_server_error(message: str = "Internal server error") -> HTTPException:
    """Create internal server error exception."""
    return HTTPException(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        detail=message
    )