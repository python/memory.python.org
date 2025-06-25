"""Upload router for the Memory Tracker API."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, delete, desc, func, update, and_
from sqlalchemy.exc import IntegrityError
from datetime import datetime
import logging

from .. import schemas, crud, models
from ..database import get_database, transaction_scope
from ..auth import get_current_token

router = APIRouter(prefix="/api", tags=["upload"])


async def cleanup_old_flamegraphs_if_needed(db: AsyncSession, environment_id: str, max_flamegraphs: int = 100):
    """
    Set flamegraph_html to NULL for runs older than the last max_flamegraphs in this environment.
    """
    logger = logging.getLogger(__name__)
    
    keep_runs_result = await db.execute(
        select(models.Run.run_id).where(
            models.Run.environment_id == environment_id
        ).order_by(desc(models.Run.timestamp)).limit(max_flamegraphs)
    )
    keep_run_ids = [row[0] for row in keep_runs_result.fetchall()]
    
    if not keep_run_ids:
        return 0
    
    total_flamegraphs_result = await db.execute(
        select(func.count()).select_from(models.BenchmarkResult).join(models.Run).where(
            models.Run.environment_id == environment_id,
            models.BenchmarkResult.flamegraph_html.is_not(None)
        )
    )
    total_flamegraphs_before = total_flamegraphs_result.scalar()
    
    count_query = select(func.count()).select_from(models.BenchmarkResult).where(
        and_(
            models.BenchmarkResult.run_id.not_in(keep_run_ids),
            models.BenchmarkResult.flamegraph_html.is_not(None)
        )
    )
    count_result = await db.execute(count_query)
    rows_to_clean = count_result.scalar()
    
    if rows_to_clean == 0:
        logger.info(f"No flamegraphs need cleaning for environment '{environment_id}' (all {total_flamegraphs_before} flamegraphs are from recent runs)")
        return 0
    
    cleanup_query = update(models.BenchmarkResult).where(
        and_(
            models.BenchmarkResult.run_id.not_in(keep_run_ids),
            models.BenchmarkResult.flamegraph_html.is_not(None)
        )
    ).values(flamegraph_html=None)
    
    try:
        result = await db.execute(cleanup_query)
        await db.commit()
        
        verify_result = await db.execute(count_query)
        remaining = verify_result.scalar()
        actual_cleaned = rows_to_clean - remaining
        
        final_flamegraphs_result = await db.execute(
            select(func.count()).select_from(models.BenchmarkResult).join(models.Run).where(
                models.Run.environment_id == environment_id,
                models.BenchmarkResult.flamegraph_html.is_not(None)
            )
        )
        total_flamegraphs_after = final_flamegraphs_result.scalar()
        
        if actual_cleaned > 0:
            logger.info(f"Cleaned up {actual_cleaned} flamegraphs for environment '{environment_id}': {total_flamegraphs_before} → {total_flamegraphs_after} flamegraphs remaining")
        else:
            logger.error(f"Cleanup FAILED for environment '{environment_id}'. Expected to clean {rows_to_clean}, but {remaining} still remain")
        
        return actual_cleaned
        
    except Exception as e:
        logger.error(f"Exception during cleanup for environment '{environment_id}': {e}")
        await db.rollback()
        raise




@router.post("/upload-run", response_model=dict)
async def upload_worker_run(
    upload_data: schemas.WorkerRunUpload,
    db: AsyncSession = Depends(get_database),
    current_token: models.AuthToken = Depends(get_current_token),
):
    logger = logging.getLogger(__name__)

    logger.info(
        f"Authenticated upload request from token '{current_token.name}' for binary_id='{upload_data.binary_id}', environment_id='{upload_data.environment_id}'"
    )
    logger.debug(
        f"Upload contains {len(upload_data.benchmark_results)} benchmark results"
    )

    metadata = upload_data.metadata

    # Extract commit information
    commit_info = metadata.get("commit", {})
    commit_sha = commit_info.get("hexsha")
    if not commit_sha:
        logger.error("Upload failed: Missing commit SHA in metadata")
        raise HTTPException(status_code=400, detail="Missing commit SHA in metadata")

    logger.info(f"Processing upload for commit {commit_sha[:8]}")

    # Extract Python version
    version_info = metadata.get("version", {})
    python_version = schemas.PythonVersion(
        major=version_info.get("major"),
        minor=version_info.get("minor"),
        patch=version_info.get(
            "micro", 0
        ),  # 'micro' in metadata maps to 'patch' in our schema
    )
    logger.debug(
        f"Extracted Python version: {python_version.major}.{python_version.minor}.{python_version.patch}"
    )

    # Use provided binary_id and environment_id from worker
    binary_id = upload_data.binary_id
    environment_id = upload_data.environment_id

    # Validate binary exists
    logger.debug(f"Validating binary '{binary_id}' exists")
    binary = await crud.get_binary_by_id(db, binary_id=binary_id)
    if not binary:
        logger.error(f"Upload failed: Binary '{binary_id}' not found")
        raise HTTPException(
            status_code=400,
            detail=f"Binary '{binary_id}' not found. Binaries must be pre-registered.",
        )
    logger.info(f"Binary '{binary_id}' validated successfully")

    # Validate environment exists
    logger.debug(f"Validating environment '{environment_id}' exists")
    environment = await crud.get_environment_by_id(db, environment_id=environment_id)
    if not environment:
        logger.error(f"Upload failed: Environment '{environment_id}' not found")
        raise HTTPException(
            status_code=400,
            detail=f"Environment '{environment_id}' not found. Environments must be pre-registered.",
        )
    logger.info(f"Environment '{environment_id}' validated successfully")

    # Validate configure flags - the registered binary flags must be a subset of uploaded flags
    configure_vars = metadata.get("configure_vars", {})
    uploaded_config_args = configure_vars.get("CONFIG_ARGS", "")
    uploaded_flags = (
        set(uploaded_config_args.split()) if uploaded_config_args else set()
    )
    registered_flags = set(binary.flags) if binary.flags else set()

    logger.debug(
        f"Configure flags validation: registered={sorted(registered_flags)}, uploaded={sorted(uploaded_flags)}"
    )
    logger.debug(f"Raw CONFIG_ARGS from metadata: '{uploaded_config_args}'")

    # Check if registered flags are a subset of uploaded flags
    if registered_flags and not registered_flags.issubset(uploaded_flags):
        missing_flags = registered_flags - uploaded_flags
        logger.error(
            f"Upload failed: Configure flags mismatch for binary '{binary_id}'. "
            f"Missing flags: {sorted(missing_flags)}, "
            f"Required: {sorted(registered_flags)}, "
            f"Provided: {sorted(uploaded_flags)}"
        )
        raise HTTPException(
            status_code=400,
            detail=f"Binary '{binary_id}' requires configure flags {sorted(missing_flags)} but upload only has {sorted(uploaded_flags)}. "
            f"Registered configure flags {sorted(registered_flags)} must be a subset of upload configure flags.",
        )
    logger.info(f"Configure flags validation passed for binary '{binary_id}'")

    # Note: Duplicate commits are now prevented by database unique constraint on (commit_sha, binary_id, environment_id)

    # Create or get commit
    logger.debug(f"Looking up commit {commit_sha[:8]} in database")
    commit = await crud.get_commit_by_sha(db, sha=commit_sha)
    if not commit:
        logger.info(f"Commit {commit_sha[:8]} not found, creating new commit record")
        # Create commit from metadata
        commit_data = schemas.CommitCreate(
            sha=commit_sha,
            timestamp=datetime.fromisoformat(
                commit_info.get("committed_date", "").replace("Z", "+00:00")
            ),
            message=commit_info.get("message", ""),
            author=commit_info.get("author", ""),
            python_version=python_version,
        )
        try:
            commit = await crud.create_commit(db, commit_data)
            logger.info(f"Successfully created commit record for {commit_sha[:8]}")
        except Exception as e:
            logger.error(f"Failed to create commit record for {commit_sha[:8]}: {e}")
            raise HTTPException(
                status_code=500, detail=f"Failed to create commit record: {str(e)}"
            )
    else:
        logger.debug(f"Found existing commit record for {commit_sha[:8]}")

    # Create run
    run_id = f"run_{commit_sha[:8]}_{binary_id}_{environment_id}_{int(datetime.now().timestamp())}"
    logger.info(f"Creating run with ID: {run_id}")
    run_data = schemas.RunCreate(
        run_id=run_id,
        commit_sha=commit_sha,
        binary_id=binary_id,
        environment_id=environment_id,
        python_version=python_version,
        timestamp=datetime.now(),
    )

    try:
        new_run = await crud.create_run(db, run_data)
        logger.info(f"Successfully created run record: {run_id}")

        # Create benchmark results
        created_results = []
        logger.info(
            f"Processing {len(upload_data.benchmark_results)} benchmark results"
        )
        for i, benchmark_result in enumerate(upload_data.benchmark_results, 1):
            logger.debug(
                f"Processing benchmark result {i}/{len(upload_data.benchmark_results)}: {benchmark_result.benchmark_name}"
            )
            # Convert worker format to internal format
            stats_json = benchmark_result.stats_json

            # Extract key metrics from the stats JSON
            result_json = schemas.BenchmarkResultJson(
                high_watermark_bytes=stats_json.get("metadata", {}).get(
                    "peak_memory", 0
                ),
                allocation_histogram=[
                    [item["min_bytes"], item["count"]]
                    for item in stats_json.get("allocation_size_histogram", [])
                ],
                total_allocated_bytes=stats_json.get("total_bytes_allocated", 0),
                top_allocating_functions=[
                    schemas.TopAllocatingFunction(
                        function=alloc["location"],
                        count=alloc.get("count", 0),
                        total_size=alloc["size"],
                    )
                    for alloc in stats_json.get("top_allocations_by_size", [])[:10]
                ],
                benchmark_name=benchmark_result.benchmark_name,
            )

            result_data = schemas.BenchmarkResultCreate(
                run_id=run_id,
                benchmark_name=benchmark_result.benchmark_name,
                result_json=result_json,
                flamegraph_html=benchmark_result.flamegraph_html,
            )
            try:
                created_result = await crud.create_benchmark_result(db, result_data)
                created_results.append(created_result.id)
                logger.debug(
                    f"Successfully created benchmark result for {benchmark_result.benchmark_name}"
                )
            except Exception as e:
                logger.error(
                    f"Failed to create benchmark result for {benchmark_result.benchmark_name}: {e}"
                )
                raise

        logger.info(
            f"Upload completed successfully: run_id={run_id}, created {len(created_results)} benchmark results"
        )

        # Clean up old flamegraphs if we have more than 100 runs for this environment
        await cleanup_old_flamegraphs_if_needed(db, environment_id, max_flamegraphs=100)

        return {
            "message": "Worker run uploaded successfully",
            "run_id": run_id,
            "commit_sha": commit_sha,
            "binary_id": binary_id,
            "environment_id": environment_id,
            "results_created": len(created_results),
            "result_ids": created_results,
        }

    except IntegrityError as e:
        # Handle unique constraint violation for duplicate commit+binary+environment
        if "unique_commit_binary_env" in str(e).lower():
            logger.error(f"Upload failed: Duplicate run for commit {commit_sha[:8]}, binary '{binary_id}', environment '{environment_id}'")
            raise HTTPException(
                status_code=409,
                detail=f"A run already exists for commit {commit_sha[:8]} with binary '{binary_id}' and environment '{environment_id}'. Duplicate uploads are not allowed."
            )
        else:
            logger.error(f"Database integrity error during upload: {e}")
            raise HTTPException(status_code=500, detail=f"Database integrity error: {str(e)}")
    except HTTPException:
        # Re-raise HTTP exceptions (validation errors) as-is
        raise
    except Exception as e:
        logger.error(f"Unexpected error during upload processing: {e}")
        raise HTTPException(
            status_code=500, detail=f"Failed to upload worker run: {str(e)}"
        )