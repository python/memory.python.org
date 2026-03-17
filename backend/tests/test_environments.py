"""Tests for the environments API endpoints."""



async def test_list_environments_empty(client):
    response = await client.get("/api/environments")
    assert response.status_code == 200
    assert response.json() == []


async def test_list_environments(client, sample_environment):
    response = await client.get("/api/environments")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["id"] == "linux-x86_64"
    assert data[0]["name"] == "Linux x86_64"


async def test_get_environment_by_id(client, sample_environment):
    response = await client.get("/api/environments/linux-x86_64")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "linux-x86_64"


async def test_get_environment_not_found(client):
    response = await client.get("/api/environments/nonexistent")
    assert response.status_code == 404
