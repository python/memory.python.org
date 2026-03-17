"""Tests for the binaries API endpoints."""



async def test_list_binaries_empty(client):
    response = await client.get("/api/binaries")
    assert response.status_code == 200
    assert response.json() == []


async def test_list_binaries(client, sample_binary):
    response = await client.get("/api/binaries")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == "default"
    assert data[0]["name"] == "Default"
    assert "--enable-optimizations" in data[0]["flags"]


async def test_get_binary_by_id(client, sample_binary):
    response = await client.get("/api/binaries/default")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "default"
    assert data["description"] == "Standard build"


async def test_get_binary_not_found(client):
    response = await client.get("/api/binaries/nonexistent")
    assert response.status_code == 404


async def test_environments_for_binary(client, sample_benchmark_result):
    response = await client.get("/api/binaries/default/environments")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == "linux-x86_64"
    assert data[0]["run_count"] >= 1


async def test_environments_for_nonexistent_binary(client):
    response = await client.get("/api/binaries/nonexistent/environments")
    assert response.status_code == 404


async def test_commits_for_binary_and_environment(client, sample_benchmark_result):
    response = await client.get(
        "/api/binaries/default/environments/linux-x86_64/commits"
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) >= 1
    assert data[0]["sha"] == "a" * 40
