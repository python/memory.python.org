"""Tests for the commits API endpoints."""

import pytest


@pytest.mark.asyncio
async def test_list_commits_empty(client):
    response = await client.get("/api/commits")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_list_commits(client, sample_commit):
    response = await client.get("/api/commits")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["sha"] == sample_commit.sha
    assert data[0]["author"] == "Test Author"
    assert data[0]["python_version"]["major"] == 3
    assert data[0]["python_version"]["minor"] == 14


@pytest.mark.asyncio
async def test_list_commits_pagination(client, sample_commit):
    response = await client.get("/api/commits", params={"skip": 0, "limit": 1})
    assert response.status_code == 200
    assert len(response.json()) == 1

    response = await client.get("/api/commits", params={"skip": 1, "limit": 1})
    assert response.status_code == 200
    assert len(response.json()) == 0


@pytest.mark.asyncio
async def test_get_commit_by_sha(client, sample_commit):
    response = await client.get(f"/api/commits/{sample_commit.sha}")
    assert response.status_code == 200
    data = response.json()
    assert data["sha"] == sample_commit.sha
    assert data["message"] == "Test commit"


@pytest.mark.asyncio
async def test_get_commit_not_found(client):
    response = await client.get("/api/commits/" + "f" * 40)
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_python_versions_empty(client):
    response = await client.get("/api/python-versions")
    assert response.status_code == 200
    assert response.json() == []


@pytest.mark.asyncio
async def test_python_versions(client, sample_benchmark_result):
    response = await client.get("/api/python-versions")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["major"] == 3
    assert data[0]["minor"] == 14
