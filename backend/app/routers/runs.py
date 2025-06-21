"""Runs router for the Memory Tracker API."""

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional

from .. import schemas, crud
from ..database import get_database
from ..config import get_settings

router = APIRouter(prefix="/api", tags=["runs"])
settings = get_settings()


@router.get("/runs", response_model=List[schemas.Run])
async def get_runs(
    commit_sha: Optional[str] = None,
    binary_id: Optional[str] = None,
    environment_id: Optional[str] = None,
    skip: int = 0,
    limit: int = settings.default_page_size,
    db: AsyncSession = Depends(get_database),
):
    runs = await crud.get_runs(
        db,
        commit_sha=commit_sha,
        binary_id=binary_id,
        environment_id=environment_id,
        skip=skip,
        limit=limit,
    )
    return [
        schemas.Run(
            run_id=run.run_id,
            commit_sha=run.commit_sha,
            binary_id=run.binary_id,
            environment_id=run.environment_id,
            python_version=schemas.PythonVersion(
                major=run.python_major, minor=run.python_minor, patch=run.python_patch
            ),
            timestamp=run.timestamp,
        )
        for run in runs
    ]