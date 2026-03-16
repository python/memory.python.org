"""Tests for public API endpoints."""

import pytest


@pytest.mark.asyncio
async def test_maintainers_empty(client):
    response = await client.get("/api/maintainers")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_maintainers_with_admin(client, admin_user):
    response = await client.get("/api/maintainers")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["github_username"] == "test_admin"
    assert data[0]["is_active"] is True


@pytest.mark.asyncio
async def test_memray_status_healthy(client):
    response = await client.get("/api/memray-status")
    assert response.status_code == 200
    data = response.json()
    assert data["has_failures"] is False
    assert data["failure_count"] == 0
    assert data["affected_environments"] == []


@pytest.mark.asyncio
async def test_memray_status_with_failure(
    client, auth_headers, sample_binary, sample_environment
):
    # Report a failure first
    await client.post(
        "/api/report-memray-failure",
        json={
            "commit_sha": "c" * 40,
            "commit_timestamp": "2025-06-16T10:00:00",
            "binary_id": "default",
            "environment_id": "linux-x86_64",
            "error_message": "memray install failed",
        },
        headers=auth_headers,
    )

    response = await client.get("/api/memray-status")
    assert response.status_code == 200
    data = response.json()
    assert data["has_failures"] is True
    assert data["failure_count"] == 1
    assert data["affected_environments"][0]["binary_id"] == "default"
