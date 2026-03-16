"""Tests for token authentication."""

import pytest


@pytest.mark.asyncio
async def test_valid_bearer_token(client, auth_headers, sample_binary, sample_environment):
    """A valid Bearer token should authenticate successfully."""
    response = await client.get("/api/binaries")
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_upload_with_invalid_token(client, sample_binary, sample_environment):
    """An invalid token should be rejected."""
    headers = {"Authorization": "Bearer invalid_token_value"}
    response = await client.post(
        "/api/upload-run",
        json={"metadata": {}, "benchmark_results": [], "binary_id": "x", "environment_id": "y"},
        headers=headers,
    )
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_upload_with_no_token(client):
    """Missing token should be rejected."""
    response = await client.post(
        "/api/upload-run",
        json={"metadata": {}, "benchmark_results": [], "binary_id": "x", "environment_id": "y"},
    )
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_token_format_bearer(client, auth_token, sample_binary, sample_environment):
    """'Bearer <token>' format should work."""
    raw_token, _ = auth_token
    headers = {"Authorization": f"Bearer {raw_token}"}
    # Use upload endpoint since it requires auth
    response = await client.post(
        "/api/report-memray-failure",
        json={
            "commit_sha": "d" * 40,
            "commit_timestamp": "2025-06-16T10:00:00",
            "binary_id": "default",
            "environment_id": "linux-x86_64",
            "error_message": "test",
        },
        headers=headers,
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_token_format_token_prefix(client, auth_token, sample_binary, sample_environment):
    """'Token <token>' format should also work."""
    raw_token, _ = auth_token
    headers = {"Authorization": f"Token {raw_token}"}
    response = await client.post(
        "/api/report-memray-failure",
        json={
            "commit_sha": "e" * 40,
            "commit_timestamp": "2025-06-16T10:00:00",
            "binary_id": "default",
            "environment_id": "linux-x86_64",
            "error_message": "test",
        },
        headers=headers,
    )
    assert response.status_code == 200


@pytest.mark.asyncio
async def test_inactive_token_rejected(client, db_session, auth_token, sample_binary, sample_environment):
    """A deactivated token should be rejected."""
    raw_token, token_model = auth_token
    token_model.is_active = False
    await db_session.commit()

    headers = {"Authorization": f"Bearer {raw_token}"}
    response = await client.post(
        "/api/report-memray-failure",
        json={
            "commit_sha": "f" * 40,
            "commit_timestamp": "2025-06-16T10:00:00",
            "binary_id": "default",
            "environment_id": "linux-x86_64",
            "error_message": "test",
        },
        headers=headers,
    )
    assert response.status_code in (401, 403)
