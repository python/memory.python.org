"""Benchmarks router for the Memory Tracker API."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List

from .. import schemas, crud, models
from ..database import get_database
from ..config import get_settings, Constants

router = APIRouter(prefix="/api", tags=["benchmarks"])
settings = get_settings()


@router.get("/benchmarks", response_model=List[str])
async def get_all_benchmark_names(db: AsyncSession = Depends(get_database)):
    """
    Get all available benchmark names in the database.
    """
    result = await db.execute(
        select(models.BenchmarkResult.benchmark_name)
        .distinct()
        .order_by(models.BenchmarkResult.benchmark_name)
    )
    return result.scalars().all()


@router.get("/benchmark-names", response_model=List[str])
async def get_benchmark_names(
    environment_id: str,
    binary_id: str,
    python_major: int,
    python_minor: int,
    db: AsyncSession = Depends(get_database),
):
    """
    Get available benchmark names for given filters using optimized query.
    """
    result = await db.execute(
        select(models.BenchmarkResult.benchmark_name)
        .join(models.Run)
        .join(models.Commit)
        .where(
            and_(
                models.Run.environment_id == environment_id,
                models.Run.binary_id == binary_id,
                models.Commit.python_major == python_major,
                models.Commit.python_minor == python_minor,
            )
        )
        .distinct()
        .order_by(models.BenchmarkResult.benchmark_name)
    )
    return result.scalars().all()


@router.get("/diff", response_model=List[schemas.DiffTableRow])
async def get_diff_table(
    commit_sha: str,
    binary_id: str,
    environment_id: str,
    metric_key: str = Constants.DEFAULT_METRIC_KEY,
    db: AsyncSession = Depends(get_database),
):
    # Get the selected commit
    selected_commit = await crud.get_commit_by_sha(db, sha=commit_sha)
    if not selected_commit:
        raise HTTPException(status_code=404, detail="Commit not found")

    # Get all benchmark names for this commit, binary, and environment
    runs = await crud.get_runs(
        db, commit_sha=commit_sha, binary_id=binary_id, environment_id=environment_id
    )
    if not runs:
        raise HTTPException(
            status_code=404,
            detail="No runs found for this commit, binary, and environment",
        )

    current_run = runs[0]  # Get the latest run
    current_results = await crud.get_benchmark_results(db, run_id=current_run.run_id)

    # Efficiently find the previous commit that was tested with the same binary and environment
    prev_commit = await crud.get_previous_commit_with_binary_and_environment(
        db, selected_commit, binary_id, environment_id
    )

    prev_results_map = {}
    if prev_commit:
        prev_runs = await crud.get_runs(
            db,
            commit_sha=prev_commit.sha,
            binary_id=binary_id,
            environment_id=environment_id,
        )
        if prev_runs:
            prev_results = await crud.get_benchmark_results(
                db, run_id=prev_runs[0].run_id
            )
            # Create a map for O(1) lookup
            prev_results_map = {r.benchmark_name: r for r in prev_results}

    rows = []
    for result in current_results:
        curr_metric_value = getattr(result, metric_key, 0)

        row_data = {
            "benchmark_name": result.benchmark_name,
            "curr_metric_value": curr_metric_value,
            "curr_commit_details": schemas.Commit(
                sha=selected_commit.sha,
                timestamp=selected_commit.timestamp,
                message=selected_commit.message,
                author=selected_commit.author,
                python_version=schemas.PythonVersion(
                    major=selected_commit.python_major,
                    minor=selected_commit.python_minor,
                    patch=selected_commit.python_patch,
                ),
            ),
            "metric_key": metric_key,
            "curr_python_version_str": f"{selected_commit.python_major}.{selected_commit.python_minor}.{selected_commit.python_patch}",
            "curr_result_id": result.id,
        }

        # Try to find previous commit's data for comparison
        if prev_commit and result.benchmark_name in prev_results_map:
            prev_result = prev_results_map[result.benchmark_name]
            if prev_result:
                prev_metric_value = getattr(prev_result, metric_key, 0)
                row_data.update(
                    {
                        "prev_metric_value": prev_metric_value,
                        "prev_commit_details": schemas.Commit(
                            sha=prev_commit.sha,
                            timestamp=prev_commit.timestamp,
                            message=prev_commit.message,
                            author=prev_commit.author,
                            python_version=schemas.PythonVersion(
                                major=prev_commit.python_major,
                                minor=prev_commit.python_minor,
                                patch=prev_commit.python_patch,
                            ),
                        ),
                        "prev_python_version_str": f"{prev_commit.python_major}.{prev_commit.python_minor}.{prev_commit.python_patch}",
                    }
                )

                if prev_metric_value > 0:
                    row_data["metric_delta_percent"] = (
                        (curr_metric_value - prev_metric_value) / prev_metric_value
                    ) * 100

        rows.append(schemas.DiffTableRow(**row_data))

    return rows


@router.get("/trends", response_model=List[dict])
async def get_benchmark_trends(
    benchmark_name: str,
    binary_id: str,
    environment_id: str,
    limit: int = 50,
    db: AsyncSession = Depends(get_database),
):
    """
    Get benchmark performance trends over time using optimized CTE queries.
    Much faster than the general filtered endpoint for time series data.
    """
    trends = await crud.get_benchmark_trends(
        db,
        benchmark_name=benchmark_name,
        binary_id=binary_id,
        environment_id=environment_id,
        limit=limit,
    )
    return trends


@router.post("/trends-batch", response_model=schemas.BatchTrendResponse)
async def get_batch_benchmark_trends(
    request: schemas.BatchTrendRequest,
    db: AsyncSession = Depends(get_database),
):
    """
    Get multiple benchmark performance trends in a single request.
    This endpoint reduces the number of database queries and network requests
    when fetching trends for multiple benchmark-binary combinations.
    """
    results = {}
    
    for trend_query in request.trend_queries:
        key = f"{trend_query.binary_id}:{trend_query.benchmark_name}"
        trends = await crud.get_benchmark_trends(
            db,
            benchmark_name=trend_query.benchmark_name,
            binary_id=trend_query.binary_id,
            environment_id=trend_query.environment_id,
            limit=trend_query.limit,
        )
        results[key] = trends
    
    return schemas.BatchTrendResponse(results=results)


@router.get("/flamegraph/{result_id}", response_model=dict)
async def get_flamegraph(result_id: str, db: AsyncSession = Depends(get_database)):
    result = await crud.get_benchmark_result_by_id(db, result_id=result_id)
    if not result:
        raise HTTPException(status_code=404, detail="Benchmark result not found")

    return {
        "flamegraph_html": result.flamegraph_html or "",
        "benchmark_name": result.benchmark_name,
        "result_id": result_id,
    }