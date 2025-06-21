"""Binaries router for the Memory Tracker API."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List
import logging

from .. import schemas, crud
from ..database import get_database
from ..logging_config import get_logger

router = APIRouter(prefix="/api", tags=["binaries"])


@router.get("/binaries", response_model=List[schemas.Binary])
async def get_binaries(db: AsyncSession = Depends(get_database)):
    logger = get_logger("api.binaries")
    logger.info("Fetching all binaries")

    try:
        binaries = await crud.get_binaries(db)
        logger.info(f"Successfully retrieved binaries", extra={"count": len(binaries)})

        return [
            schemas.Binary(
                id=binary.id,
                name=binary.name,
                flags=binary.flags,
                description=binary.description,
                color=binary.color,
                icon=binary.icon,
                display_order=binary.display_order,
            )
            for binary in binaries
        ]
    except Exception as e:
        logger.error(f"Failed to fetch binaries", extra={"error": str(e)})
        raise HTTPException(status_code=500, detail="Failed to fetch binaries")


@router.get("/binaries/{binary_id}", response_model=schemas.Binary)
async def get_binary(binary_id: str, db: AsyncSession = Depends(get_database)):
    logger = logging.getLogger(__name__)
    logger.info(f"Fetching binary: {binary_id}")
    binary = await crud.get_binary_by_id(db, binary_id=binary_id)
    if binary is None:
        logger.warning(f"Binary not found: {binary_id}")
        raise HTTPException(status_code=404, detail="Binary not found")

    logger.info(f"Found binary: {binary.name} with {len(binary.flags)} flags")
    return schemas.Binary(
        id=binary.id,
        name=binary.name,
        flags=binary.flags,
        description=binary.description,
        color=binary.color,
        icon=binary.icon,
        display_order=binary.display_order,
    )


@router.get("/binaries/{binary_id}/environments", response_model=List[dict])
async def get_environments_for_binary(
    binary_id: str, db: AsyncSession = Depends(get_database)
):
    binary = await crud.get_binary_by_id(db, binary_id=binary_id)
    if binary is None:
        raise HTTPException(status_code=404, detail="Binary not found")

    environments = await crud.get_environments_for_binary(db, binary_id=binary_id)
    return environments


@router.get(
    "/binaries/{binary_id}/environments/{environment_id}/commits",
    response_model=List[dict],
)
async def get_commits_for_binary_and_environment(
    binary_id: str, environment_id: str, db: AsyncSession = Depends(get_database)
):
    binary = await crud.get_binary_by_id(db, binary_id=binary_id)
    if binary is None:
        raise HTTPException(status_code=404, detail="Binary not found")

    environment = await crud.get_environment_by_id(db, environment_id=environment_id)
    if environment is None:
        raise HTTPException(status_code=404, detail="Environment not found")

    commits = await crud.get_commits_for_binary_and_environment(
        db, binary_id=binary_id, environment_id=environment_id
    )
    return commits