"""Commits router for the Memory Tracker API."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from .. import schemas, crud
from ..database import get_database
from ..config import get_settings
from ..logging_config import get_logger

router = APIRouter(prefix="/api", tags=["commits"])
settings = get_settings()


@router.get("/commits", response_model=List[schemas.Commit])
async def get_commits(
    skip: int = 0,
    limit: int = settings.default_page_size,
    db: AsyncSession = Depends(get_database),
):
    logger = get_logger("api.commits")
    logger.info(f"Fetching commits", extra={"skip": skip, "limit": limit})

    try:
        commits = await crud.get_commits(db, skip=skip, limit=limit)
        logger.info(f"Successfully retrieved commits", extra={"count": len(commits)})

        return [
            schemas.Commit(
                sha=commit.sha,
                timestamp=commit.timestamp,
                message=commit.message,
                author=commit.author,
                python_version=schemas.PythonVersion(
                    major=commit.python_major,
                    minor=commit.python_minor,
                    patch=commit.python_patch,
                ),
            )
            for commit in commits
        ]
    except Exception as e:
        logger.error(f"Failed to fetch commits", extra={"error": str(e)})
        raise HTTPException(status_code=500, detail="Failed to fetch commits")


@router.get("/commits/{sha}", response_model=schemas.Commit)
async def get_commit(sha: str, db: AsyncSession = Depends(get_database)):
    logger = get_logger("api.commits")
    logger.info(f"Fetching commit by SHA", extra={"sha": sha})

    try:
        commit = await crud.get_commit_by_sha(db, sha=sha)
        if commit is None:
            logger.warning(f"Commit not found", extra={"sha": sha})
            raise HTTPException(status_code=404, detail="Commit not found")

        logger.info(
            f"Successfully retrieved commit",
            extra={
                "sha": commit.sha[:8],
                "author": commit.author,
                "message_length": len(commit.message),
            },
        )

        return schemas.Commit(
            sha=commit.sha,
            timestamp=commit.timestamp,
            message=commit.message,
            author=commit.author,
            python_version=schemas.PythonVersion(
                major=commit.python_major,
                minor=commit.python_minor,
                patch=commit.python_patch,
            ),
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to fetch commit", extra={"sha": sha, "error": str(e)})
        raise HTTPException(status_code=500, detail="Failed to fetch commit")


@router.get("/python-versions", response_model=List[schemas.PythonVersionFilterOption])
async def get_python_versions(db: AsyncSession = Depends(get_database)):
    versions = await crud.get_python_version_filters(db)
    return [schemas.PythonVersionFilterOption(**version) for version in versions]