"""
Tests using fixtures derived from production data.

These verify that the API behaves correctly with real-world data shapes,
including a case where deltablue_base shows a ~10.5% high watermark
regression between two consecutive nogil commits while json_dumps_base
and nbody_base remain unchanged.
"""

import pytest
import pytest_asyncio

from app.models import Binary, Environment, Commit, Run, BenchmarkResult

from .production_fixtures import (
    BINARY_NOGIL,
    ENVIRONMENT_GH_ACTIONS,
    COMMIT_PREV,
    COMMIT_CURR,
    RUN_PREV,
    RUN_CURR,
    ALL_PREV_BENCHMARKS,
    ALL_CURR_BENCHMARKS,
    BENCH_DELTABLUE_PREV,
    BENCH_DELTABLUE_CURR,
)


@pytest_asyncio.fixture
async def prod_data(db_session):
    """Load the full production fixture set into the test database."""
    db_session.add(Binary(**BINARY_NOGIL))
    db_session.add(Environment(**ENVIRONMENT_GH_ACTIONS))
    await db_session.flush()

    db_session.add(Commit(**COMMIT_PREV))
    db_session.add(Commit(**COMMIT_CURR))
    await db_session.flush()

    db_session.add(Run(**RUN_PREV))
    db_session.add(Run(**RUN_CURR))
    await db_session.flush()

    for bench in ALL_PREV_BENCHMARKS + ALL_CURR_BENCHMARKS:
        db_session.add(BenchmarkResult(**bench))
    await db_session.commit()


async def test_diff_detects_regression(client, prod_data):
    """The diff endpoint should show the deltablue_base regression."""
    response = await client.get(
        "/api/diff",
        params={
            "commit_sha": COMMIT_CURR["sha"],
            "binary_id": "nogil",
            "environment_id": "gh_actions",
        },
    )
    assert response.status_code == 200
    rows = response.json()
    assert len(rows) == 3

    deltablue = next(r for r in rows if r["benchmark_name"] == "deltablue_base")
    assert deltablue["curr_metric_value"] == BENCH_DELTABLUE_CURR["high_watermark_bytes"]
    assert deltablue["prev_metric_value"] == BENCH_DELTABLUE_PREV["high_watermark_bytes"]
    assert deltablue["metric_delta_percent"] == pytest.approx(10.49, abs=0.1)

    # json_dumps_base and nbody_base should show no change
    json_dumps = next(r for r in rows if r["benchmark_name"] == "json_dumps_base")
    assert json_dumps["metric_delta_percent"] == pytest.approx(0.0)

    nbody = next(r for r in rows if r["benchmark_name"] == "nbody_base")
    assert nbody["metric_delta_percent"] == pytest.approx(0.0)


async def test_diff_previous_commit_details(client, prod_data):
    """The diff should include correct previous commit metadata."""
    response = await client.get(
        "/api/diff",
        params={
            "commit_sha": COMMIT_CURR["sha"],
            "binary_id": "nogil",
            "environment_id": "gh_actions",
        },
    )
    rows = response.json()
    deltablue = next(r for r in rows if r["benchmark_name"] == "deltablue_base")

    prev = deltablue["prev_commit_details"]
    assert prev["sha"] == COMMIT_PREV["sha"]
    assert prev["author"] == "Dino Viehland"
    assert prev["python_version"]["major"] == 3
    assert prev["python_version"]["minor"] == 15

    curr = deltablue["curr_commit_details"]
    assert curr["sha"] == COMMIT_CURR["sha"]
    assert curr["author"] == "alm"


async def test_diff_first_commit_has_no_previous(client, prod_data):
    """Diffing the earlier commit should show no previous data."""
    response = await client.get(
        "/api/diff",
        params={
            "commit_sha": COMMIT_PREV["sha"],
            "binary_id": "nogil",
            "environment_id": "gh_actions",
        },
    )
    assert response.status_code == 200
    rows = response.json()
    for row in rows:
        assert row["prev_metric_value"] is None
        assert row["metric_delta_percent"] is None
        assert row["prev_commit_details"] is None


async def test_diff_with_total_allocated_metric(client, prod_data):
    """Diff should work with total_allocated_bytes metric too."""
    response = await client.get(
        "/api/diff",
        params={
            "commit_sha": COMMIT_CURR["sha"],
            "binary_id": "nogil",
            "environment_id": "gh_actions",
            "metric_key": "total_allocated_bytes",
        },
    )
    assert response.status_code == 200
    rows = response.json()
    deltablue = next(r for r in rows if r["benchmark_name"] == "deltablue_base")
    assert deltablue["metric_key"] == "total_allocated_bytes"
    assert deltablue["curr_metric_value"] == BENCH_DELTABLUE_CURR["total_allocated_bytes"]
    assert deltablue["prev_metric_value"] == BENCH_DELTABLUE_PREV["total_allocated_bytes"]


async def test_trends_returns_chronological_data(client, prod_data):
    """Trends should return data points in reverse chronological order (newest first)."""
    response = await client.get(
        "/api/trends",
        params={
            "benchmark_name": "deltablue_base",
            "binary_id": "nogil",
            "environment_id": "gh_actions",
            "python_major": 3,
            "python_minor": 15,
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2

    # Ordered by timestamp DESC: newer commit first
    assert data[0]["sha"] == COMMIT_CURR["sha"]
    assert data[0]["high_watermark_bytes"] == 1_721_155
    assert data[1]["sha"] == COMMIT_PREV["sha"]
    assert data[1]["high_watermark_bytes"] == 1_557_777


async def test_batch_trends_multiple_benchmarks(client, prod_data):
    """Batch trends should return data for multiple benchmarks at once."""
    response = await client.post(
        "/api/trends-batch",
        json={
            "trend_queries": [
                {
                    "benchmark_name": "deltablue_base",
                    "binary_id": "nogil",
                    "environment_id": "gh_actions",
                    "python_major": 3,
                    "python_minor": 15,
                    "limit": 50,
                },
                {
                    "benchmark_name": "json_dumps_base",
                    "binary_id": "nogil",
                    "environment_id": "gh_actions",
                    "python_major": 3,
                    "python_minor": 15,
                    "limit": 50,
                },
            ]
        },
    )
    assert response.status_code == 200
    results = response.json()["results"]
    assert len(results) == 2

    deltablue_key = "nogil:deltablue_base|3.15"
    json_key = "nogil:json_dumps_base|3.15"
    assert deltablue_key in results
    assert json_key in results
    assert len(results[deltablue_key]) == 2
    assert len(results[json_key]) == 2


async def test_benchmark_names_filtered_by_version(client, prod_data):
    """Benchmark names should filter correctly by Python version."""
    response = await client.get(
        "/api/benchmark-names",
        params={
            "environment_id": "gh_actions",
            "binary_id": "nogil",
            "python_major": 3,
            "python_minor": 15,
        },
    )
    assert response.status_code == 200
    names = response.json()
    assert set(names) == {"deltablue_base", "json_dumps_base", "nbody_base"}

    # Non-existent version should return empty
    response = await client.get(
        "/api/benchmark-names",
        params={
            "environment_id": "gh_actions",
            "binary_id": "nogil",
            "python_major": 3,
            "python_minor": 14,
        },
    )
    assert response.json() == []


async def test_python_versions_from_production_data(client, prod_data):
    response = await client.get("/api/python-versions")
    assert response.status_code == 200
    versions = response.json()
    assert len(versions) == 1
    assert versions[0]["major"] == 3
    assert versions[0]["minor"] == 15


async def test_environments_for_binary(client, prod_data):
    response = await client.get("/api/binaries/nogil/environments")
    assert response.status_code == 200
    envs = response.json()
    assert len(envs) == 1
    assert envs[0]["id"] == "gh_actions"
    assert envs[0]["run_count"] == 2
    assert envs[0]["commit_count"] == 2


async def test_commits_for_binary_and_environment(client, prod_data):
    response = await client.get(
        "/api/binaries/nogil/environments/gh_actions/commits"
    )
    assert response.status_code == 200
    commits = response.json()
    assert len(commits) == 2
    shas = {c["sha"][:8] for c in commits}
    assert shas == {"e05182f9", "d3d94e0e"}
