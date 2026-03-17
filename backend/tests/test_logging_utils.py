"""Tests for logging utility functions."""

from app.logging_utils import (
    sanitize_string,
    sanitize_dict,
    sanitize_list,
    mask_token,
    create_safe_log_context,
)


def test_sanitize_string_redacts_hex_token():
    token = "a" * 64
    result = sanitize_string(f"Token is {token}")
    assert token not in result
    assert "REDACTED" in result


def test_sanitize_string_redacts_password():
    result = sanitize_string('password="supersecret"')
    assert "supersecret" not in result
    assert "REDACTED" in result


def test_sanitize_string_preserves_normal_text():
    text = "This is a normal log message"
    assert sanitize_string(text) == text


def test_sanitize_string_handles_non_string():
    assert sanitize_string(42) == 42


def test_sanitize_dict_redacts_sensitive_keys():
    data = {"token": "secret123", "name": "worker-1"}
    result = sanitize_dict(data)
    assert result["token"] == "***REDACTED***"
    assert result["name"] == "worker-1"


def test_sanitize_dict_recursive():
    data = {"config": {"auth": {"password": "secret"}}}
    result = sanitize_dict(data)
    assert "secret" not in str(result)


def test_sanitize_dict_handles_non_dict():
    assert sanitize_dict("not a dict") == "not a dict"


def test_sanitize_list_handles_mixed():
    data = [{"token": "secret"}, "normal", 42]
    result = sanitize_list(data)
    assert result[0]["token"] == "***REDACTED***"
    assert result[1] == "normal"
    assert result[2] == 42


def test_mask_token_normal():
    assert mask_token("abcdefghijklmnop") == "abcd...mnop"


def test_mask_token_short():
    assert mask_token("short") == "***"


def test_mask_token_empty():
    assert mask_token("") == "***"
    assert mask_token(None) == "***"


def test_create_safe_log_context_redacts_keys():
    ctx = create_safe_log_context(token="secret", name="worker")
    assert ctx["token"] == "***REDACTED***"
    assert ctx["name"] == "worker"


def test_create_safe_log_context_truncates_long_strings():
    long_value = "x" * 100
    ctx = create_safe_log_context(data=long_value)
    assert len(ctx["data"]) < 100
    assert ctx["data"].endswith("...")
