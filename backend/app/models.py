from sqlalchemy import (
    Column,
    Integer,
    String,
    DateTime,
    Text,
    ForeignKey,
    JSON,
    Index,
    Boolean,
)
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime, UTC

Base = declarative_base()


class Commit(Base):
    __tablename__ = "commits"

    sha = Column(String(40), primary_key=True)
    timestamp = Column(DateTime, nullable=False)
    message = Column(Text, nullable=False)
    author = Column(String(255), nullable=False)
    python_major = Column(Integer, nullable=False)
    python_minor = Column(Integer, nullable=False)
    python_patch = Column(Integer, nullable=False)

    runs = relationship("Run", back_populates="commit")

    __table_args__ = (
        Index("idx_commits_timestamp", "timestamp"),
        Index(
            "idx_commits_python_version", "python_major", "python_minor", "python_patch"
        ),
        Index(
            "idx_commits_timestamp_python_version",
            "timestamp",
            "python_major",
            "python_minor",
        ),
        Index("idx_commits_sha_timestamp", "sha", "timestamp"),
    )


class Binary(Base):
    __tablename__ = "binaries"

    id = Column(String(50), primary_key=True)
    name = Column(String(255), nullable=False)
    flags = Column(JSON, nullable=False)  # Array of strings
    description = Column(
        Text, nullable=True
    )  # Description of what this binary configuration does
    color = Column(String(7), nullable=True, default="#8b5cf6")  # Hex color code
    icon = Column(String(50), nullable=True, default="server")  # Lucide icon name
    display_order = Column(Integer, nullable=True, default=0)  # Order for display

    runs = relationship("Run", back_populates="binary")


class Environment(Base):
    __tablename__ = "environments"

    id = Column(String(50), primary_key=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    runs = relationship("Run", back_populates="environment")


class Run(Base):
    __tablename__ = "runs"

    run_id = Column(String(100), primary_key=True)
    commit_sha = Column(String(40), ForeignKey("commits.sha"), nullable=False)
    binary_id = Column(String(50), ForeignKey("binaries.id"), nullable=False)
    environment_id = Column(String(50), ForeignKey("environments.id"), nullable=False)
    python_major = Column(Integer, nullable=False)
    python_minor = Column(Integer, nullable=False)
    python_patch = Column(Integer, nullable=False)
    timestamp = Column(DateTime, nullable=False)

    commit = relationship("Commit", back_populates="runs")
    binary = relationship("Binary", back_populates="runs")
    environment = relationship("Environment", back_populates="runs")
    benchmark_results = relationship("BenchmarkResult", back_populates="run")

    __table_args__ = (
        Index(
            "idx_runs_commit_binary_env", "commit_sha", "binary_id", "environment_id"
        ),
        Index("idx_runs_timestamp", "timestamp"),
        Index(
            "idx_runs_python_version", "python_major", "python_minor", "python_patch"
        ),
        Index(
            "idx_runs_binary_env_timestamp", "binary_id", "environment_id", "timestamp"
        ),
        Index(
            "idx_runs_env_timestamp", "environment_id", "timestamp"
        ),  # For environment-based queries
        Index(
            "idx_runs_timestamp_desc",
            "timestamp",
            postgresql_using="btree",
            mysql_length={"timestamp": 255},
        ),  # For ORDER BY timestamp DESC
        Index(
            "idx_runs_env_python_timestamp",
            "environment_id",
            "python_major",
            "python_minor",
            "timestamp",
        ),  # For filtered queries
        Index("idx_runs_binary_env_commit", "binary_id", "environment_id", "commit_sha"),
    )


class BenchmarkResult(Base):
    __tablename__ = "benchmark_results"

    id = Column(String(200), primary_key=True)
    run_id = Column(String(100), ForeignKey("runs.run_id"), nullable=False)
    benchmark_name = Column(String(100), nullable=False)
    high_watermark_bytes = Column(Integer, nullable=False)
    allocation_histogram = Column(JSON, nullable=False)  # Array of [size, count] tuples
    total_allocated_bytes = Column(Integer, nullable=False)
    top_allocating_functions = Column(JSON, nullable=False)  # Array of function objects
    flamegraph_html = Column(Text, nullable=True)  # HTML content of the flamegraph

    run = relationship("Run", back_populates="benchmark_results")

    __table_args__ = (
        Index("idx_benchmark_results_run_benchmark", "run_id", "benchmark_name"),
        Index("idx_benchmark_results_benchmark_name", "benchmark_name"),
        Index("idx_benchmark_results_name_run", "benchmark_name", "run_id"),
        Index(
            "idx_benchmark_results_run_high_watermark", "run_id", "high_watermark_bytes"
        ),  # For sorted queries
    )


class AuthToken(Base):
    __tablename__ = "auth_tokens"

    id = Column(Integer, primary_key=True, autoincrement=True)
    token = Column(
        String(64), unique=True, nullable=False, index=True
    )  # SHA-256 hex = 64 chars
    name = Column(String(255), nullable=False)  # Human-readable name for the token
    description = Column(Text, nullable=True)  # Optional description
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC).replace(tzinfo=None))
    last_used = Column(DateTime, nullable=True)  # Track when token was last used
    is_active = Column(Boolean, nullable=False, default=True)  # Allow disabling tokens

    __table_args__ = (
        Index("idx_auth_tokens_token", "token"),
        Index("idx_auth_tokens_active", "is_active"),
    )


class AdminUser(Base):
    __tablename__ = "admin_users"

    id = Column(Integer, primary_key=True, autoincrement=True)
    github_username = Column(String(255), unique=True, nullable=False, index=True)
    github_user_id = Column(Integer, nullable=True)  # Optional, for reference
    added_by = Column(String(255), nullable=False)  # Who added this admin
    added_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC).replace(tzinfo=None))
    is_active = Column(Boolean, nullable=False, default=True)
    notes = Column(Text, nullable=True)  # Optional notes about this admin

    __table_args__ = (
        Index("idx_admin_users_username", "github_username"),
        Index("idx_admin_users_active", "is_active"),
    )


class AdminSession(Base):
    __tablename__ = "admin_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_token = Column(String(64), unique=True, nullable=False, index=True)
    github_user_id = Column(Integer, nullable=False)
    github_username = Column(String(255), nullable=False)
    github_name = Column(String(255), nullable=True)
    github_email = Column(String(255), nullable=True)
    github_avatar_url = Column(String(500), nullable=True)
    created_at = Column(DateTime, nullable=False, default=lambda: datetime.now(UTC).replace(tzinfo=None))
    expires_at = Column(DateTime, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)

    __table_args__ = (
        Index("idx_admin_sessions_token", "session_token"),
        Index("idx_admin_sessions_github_user", "github_user_id"),
        Index("idx_admin_sessions_active", "is_active"),
        Index("idx_admin_sessions_expires", "expires_at"),
    )
