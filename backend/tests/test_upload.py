"""Tests for the upload API endpoints."""

import copy


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


async def test_upload_requires_auth(client, sample_binary, sample_environment):
    response = await client.post("/api/upload-run", json=UPLOAD_PAYLOAD)
    assert response.status_code in (401, 403)


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


async def test_upload_invalid_binary(client, auth_headers, sample_environment):
    payload = {**UPLOAD_PAYLOAD, "binary_id": "nonexistent"}
    response = await client.post(
        "/api/upload-run", json=payload, headers=auth_headers
    )
    assert response.status_code == 400
    assert "not found" in response.json()["detail"].lower()


async def test_upload_invalid_environment(client, auth_headers, sample_binary):
    payload = {**UPLOAD_PAYLOAD, "environment_id": "nonexistent"}
    response = await client.post(
        "/api/upload-run", json=payload, headers=auth_headers
    )
    assert response.status_code == 400
    assert "not found" in response.json()["detail"].lower()


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


async def test_upload_duplicate_commit_binary_env(
    client, auth_headers, sample_binary, sample_environment
):
    """Uploading the same commit+binary+environment twice should return 409."""
    response = await client.post(
        "/api/upload-run", json=UPLOAD_PAYLOAD, headers=auth_headers
    )
    assert response.status_code == 200

    response = await client.post(
        "/api/upload-run", json=UPLOAD_PAYLOAD, headers=auth_headers
    )
    assert response.status_code == 409


async def test_upload_existing_commit_new_binary(
    client, auth_headers, db_session, sample_environment
):
    """Uploading the same commit with a different binary should succeed."""
    from app.models import Binary
    for bin_id in ("bin-a", "bin-b"):
        db_session.add(Binary(
            id=bin_id, name=bin_id, flags=[], display_order=0,
        ))
    await db_session.commit()

    payload_a = copy.deepcopy(UPLOAD_PAYLOAD)
    payload_a["binary_id"] = "bin-a"
    payload_a["metadata"]["configure_vars"]["CONFIG_ARGS"] = ""

    payload_b = copy.deepcopy(UPLOAD_PAYLOAD)
    payload_b["binary_id"] = "bin-b"
    payload_b["metadata"]["configure_vars"]["CONFIG_ARGS"] = ""

    resp_a = await client.post(
        "/api/upload-run", json=payload_a, headers=auth_headers
    )
    assert resp_a.status_code == 200

    resp_b = await client.post(
        "/api/upload-run", json=payload_b, headers=auth_headers
    )
    assert resp_b.status_code == 200


async def test_upload_clears_memray_failure(
    client, auth_headers, sample_binary, sample_environment
):
    """A successful upload should clear memray failures for that binary+env."""
    # Report a failure
    failure_payload = {
        "commit_sha": "b" * 40,
        "commit_timestamp": "2025-06-16T09:00:00",
        "binary_id": "default",
        "environment_id": "linux-x86_64",
        "error_message": "memray failed",
    }
    resp = await client.post(
        "/api/report-memray-failure", json=failure_payload, headers=auth_headers
    )
    assert resp.status_code == 200

    # Upload successfully — this should clear the failure
    resp = await client.post(
        "/api/upload-run", json=UPLOAD_PAYLOAD, headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["results_created"] == 1

    # Verify the failure was cleared
    status = await client.get("/api/memray-status")
    data = status.json()
    assert data["has_failures"] is False
    assert data["failure_count"] == 0


async def test_memray_failure_update_newer(
    client, auth_headers, sample_binary, sample_environment
):
    """Reporting a newer failure should update the existing record."""
    older = {
        "commit_sha": "a" * 40,
        "commit_timestamp": "2025-06-15T10:00:00",
        "binary_id": "default",
        "environment_id": "linux-x86_64",
        "error_message": "old failure",
    }
    newer = {
        "commit_sha": "b" * 40,
        "commit_timestamp": "2025-06-16T10:00:00",
        "binary_id": "default",
        "environment_id": "linux-x86_64",
        "error_message": "new failure",
    }

    resp = await client.post(
        "/api/report-memray-failure", json=older, headers=auth_headers
    )
    assert resp.status_code == 200

    resp = await client.post(
        "/api/report-memray-failure", json=newer, headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["message"] == "Memray failure reported successfully"

    status = await client.get("/api/memray-status")
    data = status.json()
    assert data["failure_count"] == 1
    assert data["affected_environments"][0]["commit_sha"] == "b" * 40


async def test_memray_failure_ignore_older(
    client, auth_headers, sample_binary, sample_environment
):
    """Reporting an older failure should be ignored."""
    newer = {
        "commit_sha": "b" * 40,
        "commit_timestamp": "2025-06-16T10:00:00",
        "binary_id": "default",
        "environment_id": "linux-x86_64",
        "error_message": "newer failure",
    }
    older = {
        "commit_sha": "a" * 40,
        "commit_timestamp": "2025-06-15T10:00:00",
        "binary_id": "default",
        "environment_id": "linux-x86_64",
        "error_message": "older failure",
    }

    resp = await client.post(
        "/api/report-memray-failure", json=newer, headers=auth_headers
    )
    assert resp.status_code == 200

    resp = await client.post(
        "/api/report-memray-failure", json=older, headers=auth_headers
    )
    assert resp.status_code == 200
    assert "ignored" in resp.json()["message"].lower()

    # Original failure should remain unchanged
    status = await client.get("/api/memray-status")
    data = status.json()
    assert data["failure_count"] == 1
    assert data["affected_environments"][0]["commit_sha"] == "b" * 40
