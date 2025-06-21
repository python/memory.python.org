"""Environments router for the Memory Tracker API."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from typing import List

from .. import schemas, crud
from ..database import get_database

router = APIRouter(prefix="/api", tags=["environments"])


@router.get("/environments", response_model=List[schemas.Environment])
async def get_environments(db: AsyncSession = Depends(get_database)):
    environments = await crud.get_environments(db)
    return [
        schemas.Environment(id=env.id, name=env.name, description=env.description)
        for env in environments
    ]


@router.get("/environments/{environment_id}", response_model=schemas.Environment)
async def get_environment(
    environment_id: str, db: AsyncSession = Depends(get_database)
):
    environment = await crud.get_environment_by_id(db, environment_id=environment_id)
    if environment is None:
        raise HTTPException(status_code=404, detail="Environment not found")

    return schemas.Environment(
        id=environment.id, name=environment.name, description=environment.description
    )