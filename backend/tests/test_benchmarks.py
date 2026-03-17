"""Tests for the benchmarks API endpoints."""



async def test_all_benchmark_names_empty(client):
    response = await client.get("/api/benchmarks")
    assert response.status_code == 200
    assert response.json() == []


async def test_all_benchmark_names(client, sample_benchmark_result):
    response = await client.get("/api/benchmarks")
    assert response.status_code == 200
    data = response.json()
    assert "json_dumps" in data


async def test_filtered_benchmark_names(client, sample_benchmark_result):
    response = await client.get(
        "/api/benchmark-names",
        params={
            "environment_id": "linux-x86_64",
            "binary_id": "default",
            "python_major": 3,
            "python_minor": 14,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "json_dumps" in data


async def test_filtered_benchmark_names_no_match(client, sample_benchmark_result):
    response = await client.get(
        "/api/benchmark-names",
        params={
            "environment_id": "linux-x86_64",
            "binary_id": "default",
            "python_major": 3,
            "python_minor": 99,
        },
    )
    assert response.status_code == 200
    assert response.json() == []


async def test_diff_table(client, sample_benchmark_result):
    response = await client.get(
        "/api/diff",
        params={
            "commit_sha": "a" * 40,
            "binary_id": "default",
            "environment_id": "linux-x86_64",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    row = data[0]
    assert row["benchmark_name"] == "json_dumps"
    assert row["curr_metric_value"] == 1_000_000
    assert row["metric_key"] == "high_watermark_bytes"
    assert row["has_flamegraph"] is True


async def test_diff_table_commit_not_found(client):
    response = await client.get(
        "/api/diff",
        params={
            "commit_sha": "f" * 40,
            "binary_id": "default",
            "environment_id": "linux-x86_64",
        },
    )
    assert response.status_code == 404


async def test_trends(client, sample_benchmark_result):
    response = await client.get(
        "/api/trends",
        params={
            "benchmark_name": "json_dumps",
            "binary_id": "default",
            "environment_id": "linux-x86_64",
            "python_major": 3,
            "python_minor": 14,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 1
    assert data[0]["sha"] == "a" * 40
    assert data[0]["high_watermark_bytes"] == 1_000_000


async def test_trends_batch(client, sample_benchmark_result):
    response = await client.post(
        "/api/trends-batch",
        json={
            "trend_queries": [
                {
                    "benchmark_name": "json_dumps",
                    "binary_id": "default",
                    "environment_id": "linux-x86_64",
                    "python_major": 3,
                    "python_minor": 14,
                    "limit": 50,
                }
            ]
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert "results" in data
    assert len(data["results"]) == 1


async def test_flamegraph(client, sample_benchmark_result):
    result_id = sample_benchmark_result.id
    response = await client.get(f"/api/flamegraph/{result_id}")
    assert response.status_code == 200
    data = response.json()
    assert data["flamegraph_html"] == "<html>flamegraph</html>"
    assert data["benchmark_name"] == "json_dumps"


async def test_flamegraph_not_found(client):
    response = await client.get("/api/flamegraph/nonexistent")
    assert response.status_code == 404
