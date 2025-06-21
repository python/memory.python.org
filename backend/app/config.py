"""
Configuration management for the Memory Tracker API.
All settings are loaded from environment variables with sensible defaults.
"""

from typing import List, Optional, Union
from pydantic_settings import BaseSettings
from pydantic import field_validator
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # API Configuration
    api_title: str = "CPython Memory Tracker API"
    api_version: str = "1.0.0"
    api_host: str = "0.0.0.0"
    api_port: int = 8000

    # Database Configuration
    database_url: str = "sqlite+aiosqlite:///./memory_tracker.db"
    database_pool_size: int = 20
    database_max_overflow: int = 10
    database_pool_pre_ping: bool = True
    database_pool_recycle: int = 3600
    database_echo: bool = False

    # CORS Configuration  
    cors_origins: str = ""  # Comma-separated string, will be parsed to list
    cors_allow_credentials: bool = True
    cors_allow_methods: List[str] = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    cors_allow_headers: List[str] = ["Authorization", "Content-Type", "Accept", "Origin", "X-Requested-With"]

    # Pagination Configuration
    default_page_size: int = 100
    max_page_size: int = 1000
    benchmark_results_default_limit: int = 100
    benchmark_results_max_limit: int = 5000

    # Authentication Configuration
    token_length: int = 32  # in bytes, results in 64 hex characters
    token_cleanup_days: int = 90
    
    # GitHub OAuth Configuration
    github_client_id: str = ""
    github_client_secret: str = ""
    oauth_redirect_uri: str = "http://localhost:3000/auth/callback"
    oauth_state_secret: str = "your-secret-key-change-me"
    
    # Admin authorization via GitHub usernames
    admin_initial_username: str = ""  # Initial admin username (e.g., "pablogsal")
    # Legacy team-based auth (deprecated)
    admin_github_org: str = ""  # GitHub organization name (e.g., "python") 
    admin_github_teams: str = ""  # Comma-separated list of team slugs (e.g., "memory-python-org")

    # Performance Configuration
    top_functions_limit: int = 10
    diff_table_max_results: int = 1000

    # Logging Configuration
    log_level: str = "INFO"
    log_format: str = "plain"  # "json" or "plain"

    # Feature Flags
    enable_request_id_tracking: bool = True
    enable_metrics: bool = True
    enable_health_check_db: bool = True

    model_config = {
        "env_file": ".env",
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
    }

    @property
    def cors_origins_list(self) -> List[str]:
        """Parse CORS origins string into a list."""
        if not self.cors_origins.strip():
            return []
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]
    
    @property
    def admin_github_teams_list(self) -> List[str]:
        """Parse admin GitHub teams string into a list."""
        if not self.admin_github_teams.strip():
            return []
        return [team.strip() for team in self.admin_github_teams.split(",") if team.strip()]


@lru_cache()
def get_settings() -> Settings:
    """
    Get cached settings instance.
    Use this function to get settings throughout the application.
    """
    return Settings()


# Constants that were previously hardcoded
class Constants:
    """Application constants that don't need to be configurable."""

    # Column lengths for database models
    SHA_LENGTH = 40
    BINARY_ID_LENGTH = 50
    RUN_ID_LENGTH = 100
    ENVIRONMENT_ID_LENGTH = 50
    PYTHON_VERSION_LENGTH = 20
    TOKEN_VALUE_LENGTH = 64

    # Byte formatting
    BYTE_UNITS = ["B", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]
    BYTE_UNIT_SIZE = 1024

    # Chart colors for frontend
    DEFAULT_CHART_COLORS = [
        "#8b5cf6",
        "#06b6d4",
        "#10b981",
        "#f59e0b",
        "#ef4444",
        "#3b82f6",
        "#ec4899",
        "#6366f1",
    ]

    # Performance thresholds
    SIGNIFICANT_DELTA_THRESHOLD = 0.05  # 5% change is considered significant

    # Default metric key
    DEFAULT_METRIC_KEY = "high_watermark_bytes"
