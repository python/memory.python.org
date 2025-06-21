"""Logging utilities for sanitizing sensitive data."""

import re
from typing import Any, Dict, List, Union

# Patterns for sensitive data
SENSITIVE_PATTERNS = [
    (re.compile(r'\b[A-Fa-f0-9]{64}\b'), '***REDACTED_TOKEN***'),  # 64-char hex tokens
    (re.compile(r'\b[A-Fa-f0-9]{32}\b'), '***REDACTED_ID***'),    # 32-char hex IDs
    (re.compile(r'password["\']?\s*[:=]\s*["\']?[^"\s,}]+', re.IGNORECASE), 'password=***REDACTED***'),
    (re.compile(r'token["\']?\s*[:=]\s*["\']?[^"\s,}]+', re.IGNORECASE), 'token=***REDACTED***'),
    (re.compile(r'secret["\']?\s*[:=]\s*["\']?[^"\s,}]+', re.IGNORECASE), 'secret=***REDACTED***'),
    (re.compile(r'key["\']?\s*[:=]\s*["\']?[^"\s,}]+', re.IGNORECASE), 'key=***REDACTED***'),
]

def sanitize_string(text: str) -> str:
    """Remove sensitive data from a string."""
    if not isinstance(text, str):
        return text
    
    sanitized = text
    for pattern, replacement in SENSITIVE_PATTERNS:
        sanitized = pattern.sub(replacement, sanitized)
    
    return sanitized

def sanitize_dict(data: Dict[str, Any]) -> Dict[str, Any]:
    """Remove sensitive data from a dictionary."""
    if not isinstance(data, dict):
        return data
    
    sanitized = {}
    for key, value in data.items():
        # Check if key itself indicates sensitive data
        key_lower = key.lower()
        if any(sensitive_word in key_lower for sensitive_word in ['password', 'token', 'secret', 'key', 'auth']):
            sanitized[key] = '***REDACTED***'
        elif isinstance(value, str):
            sanitized[key] = sanitize_string(value)
        elif isinstance(value, dict):
            sanitized[key] = sanitize_dict(value)
        elif isinstance(value, list):
            sanitized[key] = sanitize_list(value)
        else:
            sanitized[key] = value
    
    return sanitized

def sanitize_list(data: List[Any]) -> List[Any]:
    """Remove sensitive data from a list."""
    if not isinstance(data, list):
        return data
    
    sanitized = []
    for item in data:
        if isinstance(item, str):
            sanitized.append(sanitize_string(item))
        elif isinstance(item, dict):
            sanitized.append(sanitize_dict(item))
        elif isinstance(item, list):
            sanitized.append(sanitize_list(item))
        else:
            sanitized.append(item)
    
    return sanitized

def sanitize_log_data(data: Any) -> Any:
    """Sanitize any type of data for logging."""
    if isinstance(data, str):
        return sanitize_string(data)
    elif isinstance(data, dict):
        return sanitize_dict(data)
    elif isinstance(data, list):
        return sanitize_list(data)
    else:
        return data

def mask_token(token: str) -> str:
    """Mask a token for logging while preserving some identifying information."""
    if not token or len(token) < 8:
        return '***'
    
    return f"{token[:4]}...{token[-4:]}"

def create_safe_log_context(**kwargs) -> Dict[str, Any]:
    """Create a sanitized context dict for logging."""
    context = {}
    for key, value in kwargs.items():
        if key.lower() in ['token', 'password', 'secret', 'key']:
            context[key] = '***REDACTED***'
        elif isinstance(value, str) and len(value) > 50:
            # Truncate very long strings
            context[key] = f"{value[:47]}..."
        else:
            context[key] = sanitize_log_data(value)
    
    return context