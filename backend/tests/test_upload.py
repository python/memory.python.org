"""Tests for the upload API endpoints."""

import pytest

UPLOAD_PAYLOAD = {
    "metadata": {
        "commit": {
            "hexsha": "b" * 40,
            "committed_date": "2025-06-16T10:00:00+00:00",
            "message": "Benchmark commit",
            "author": "Benchmark Author",
        },
        "version": {"major": 3, "minor": 14, "micro": 1},
        "configure_vars": {
            "CONFIG_ARGS": "'--enable-optimizations' '--prefix=/tmp/install'"
        },
    },
    "benchmark_results": [
        {
            "benchmark_name": "test_bench",
            "stats_json": {
                "metadata": {"peak_memory": 2_000_000},
                "allocation_size_histogram": [
                    {"min_bytes": 64, "count": 100},
                    {"min_bytes": 128, "count": 50},
                ],
                "total_bytes_allocated": 3_000_000,
                "top_allocations_by_size": [
                    {"location": "test_func", "count": 10, "size": 100_000}
                ],
            },
            "flamegraph_html": "<html>test flamegraph</html>",
        }
    ],
    "binary_id": "default",
    "environment_id": "linux-x86_64",
}


@pytest.mark.asyncio
async def test_upload_requires_auth(client, sample_binary, sample_environment):
    response = await client.post("/api/upload-run", json=UPLOAD_PAYLOAD)
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_upload_success(
    client, auth_headers, sample_binary, sample_environment
):
    response = await client.post(
        "/api/upload-run", json=UPLOAD_PAYLOAD, headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["commit_sha"] == "b" * 40
    assert data["binary_id"] == "default"
    assert data["environment_id"] == "linux-x86_64"
    assert data["results_created"] == 1


@pytest.mark.asyncio
async def test_upload_missing_commit_sha(
    client, auth_headers, sample_binary, sample_environment
):
    payload = {
        **UPLOAD_PAYLOAD,
        "metadata": {"commit": {}, "version": {"major": 3, "minor": 14, "micro": 0}},
    }
    response = await client.post(
        "/api/upload-run", json=payload, headers=auth_headers
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_upload_invalid_binary(client, auth_headers, sample_environment):
    payload = {**UPLOAD_PAYLOAD, "binary_id": "nonexistent"}
    response = await client.post(
        "/api/upload-run", json=payload, headers=auth_headers
    )
    assert response.status_code == 400
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_upload_invalid_environment(client, auth_headers, sample_binary):
    payload = {**UPLOAD_PAYLOAD, "environment_id": "nonexistent"}
    response = await client.post(
        "/api/upload-run", json=payload, headers=auth_headers
    )
    assert response.status_code == 400
    assert "not found" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_upload_flag_mismatch(
    client, auth_headers, sample_binary, sample_environment
):
    payload = {
        **UPLOAD_PAYLOAD,
        "metadata": {
            **UPLOAD_PAYLOAD["metadata"],
            "configure_vars": {"CONFIG_ARGS": "'--with-pydebug'"},
        },
    }
    response = await client.post(
        "/api/upload-run", json=payload, headers=auth_headers
    )
    assert response.status_code == 400
    assert "configure flags" in response.json()["detail"].lower()


@pytest.mark.asyncio
async def test_report_memray_failure_requires_auth(
    client, sample_binary, sample_environment
):
    payload = {
        "commit_sha": "c" * 40,
        "commit_timestamp": "2025-06-16T10:00:00",
        "binary_id": "default",
        "environment_id": "linux-x86_64",
        "error_message": "memray install failed",
    }
    response = await client.post("/api/report-memray-failure", json=payload)
    assert response.status_code in (401, 403)


@pytest.mark.asyncio
async def test_report_memray_failure_success(
    client, auth_headers, sample_binary, sample_environment
):
    payload = {
        "commit_sha": "c" * 40,
        "commit_timestamp": "2025-06-16T10:00:00",
        "binary_id": "default",
        "environment_id": "linux-x86_64",
        "error_message": "memray install failed",
    }
    response = await client.post(
        "/api/report-memray-failure", json=payload, headers=auth_headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Memray failure reported successfully"
