"""Logging configuration and utilities for the Memory Tracker API."""

import logging
import json
import time
from contextvars import ContextVar
from typing import Optional


# Context variables for per-request logging
request_id_var: ContextVar[Optional[str]] = ContextVar("request_id", default=None)
user_id_var: ContextVar[Optional[str]] = ContextVar("user_id", default=None)
request_start_time_var: ContextVar[Optional[float]] = ContextVar(
    "request_start_time", default=None
)


class LoggingManager:
    """Manages logging configuration and formatters."""

    def __init__(self, settings):
        self.settings = settings
        self._configured = False

    def configure_logging(self):
        """Configure logging based on the settings."""
        if self._configured:
            return

        # Clear existing handlers to avoid conflicts
        logging.root.handlers.clear()

        if self.settings.log_format == "json":
            self._configure_json_logging()
        else:
            self._configure_text_logging()

        self._configured = True

    def _configure_json_logging(self):
        """Configure JSON structured logging."""
        logging.basicConfig(
            level=getattr(logging, self.settings.log_level.upper()),
            handlers=[logging.StreamHandler()],
            format="%(message)s",
            force=True,
        )

        class JsonFormatter(logging.Formatter):
            def format(self, record):
                log_entry = {
                    "timestamp": self.formatTime(record, "%Y-%m-%dT%H:%M:%S.%fZ"),
                    "level": record.levelname,
                    "logger": record.name,
                    "message": record.getMessage(),
                    "module": record.module,
                    "function": record.funcName,
                    "line": record.lineno,
                }

                # Add context variables
                request_id = request_id_var.get()
                if request_id:
                    log_entry["request_id"] = request_id

                user_id = user_id_var.get()
                if user_id:
                    log_entry["user_id"] = user_id

                start_time = request_start_time_var.get()
                if start_time:
                    log_entry["request_duration_ms"] = int(
                        (time.time() - start_time) * 1000
                    )

                # Add explicit fields from record
                for field in [
                    "duration_ms",
                    "status_code",
                    "error",
                    "method",
                    "path",
                    "query_params",
                ]:
                    if hasattr(record, field):
                        log_entry[field] = getattr(record, field)

                return json.dumps(log_entry)

        for handler in logging.root.handlers:
            handler.setFormatter(JsonFormatter())

    def _configure_text_logging(self):
        """Configure human-readable text logging."""

        class ContextFormatter(logging.Formatter):
            def format(self, record):
                # Add context to the record
                request_id = request_id_var.get()
                if request_id:
                    record.request_id = request_id[:8]
                else:
                    record.request_id = "N/A"

                user_id = user_id_var.get()
                if user_id:
                    record.user_id = user_id
                else:
                    record.user_id = "N/A"

                # Format the base message
                base_msg = super().format(record)

                # Add extra fields if they exist
                extra_fields = []
                for field in [
                    "skip",
                    "limit",
                    "count",
                    "sha",
                    "author",
                    "message_length",
                    "method",
                    "path",
                    "status_code",
                    "duration_ms",
                    "error",
                    "query_params",
                    "user_agent",
                    "client_ip",
                ]:
                    if hasattr(record, field) and getattr(record, field) is not None:
                        value = getattr(record, field)
                        if field == "query_params" and value:
                            extra_fields.append(f"params={value}")
                        elif field == "duration_ms":
                            extra_fields.append(f"took={value}ms")
                        elif field == "user_agent":
                            ua = (
                                str(value)[:50] + "..."
                                if len(str(value)) > 50
                                else str(value)
                            )
                            extra_fields.append(f"ua={ua}")
                        elif field == "error":
                            extra_fields.append(f"error={value}")
                        else:
                            extra_fields.append(f"{field}={value}")

                if extra_fields:
                    return f"{base_msg} | {' '.join(extra_fields)}"
                else:
                    return base_msg

        logging.basicConfig(
            level=getattr(logging, self.settings.log_level.upper()),
            format="%(asctime)s - %(name)s - %(levelname)s - [%(request_id)s|%(user_id)s] - [%(funcName)s:%(lineno)d] - %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
            force=True,
        )

        for handler in logging.root.handlers:
            handler.setFormatter(ContextFormatter())


def get_logger(name: str) -> logging.Logger:
    """Get a logger with automatic context injection."""
    return logging.getLogger(name)