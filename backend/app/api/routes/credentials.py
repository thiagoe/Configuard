"""
Credentials API routes - with encrypted sensitive data
"""

import uuid
from typing import Optional
from math import ceil

from fastapi import APIRouter, HTTPException, status, Query

from app.core.deps import CurrentUser, CurrentModerator, DbSession
from app.models.credential import Credential
from app.schemas.credential import (
    CredentialCreate,
    CredentialUpdate,
    CredentialResponse,
    CredentialListResponse,
)
from app.services.encryption import encrypt, decrypt
from app.core.logging import get_api_logger
from app.services.audit import log_create, log_update, log_delete

router = APIRouter()
api_logger = get_api_logger()


@router.get("", response_model=list[CredentialResponse])
async def list_credentials(
    current_user: CurrentUser,
    db: DbSession,
    search: Optional[str] = Query(None, description="Search by name"),
):
    """
    List all credentials (without sensitive data).
    """
    query = db.query(Credential)

    if search:
        query = query.filter(Credential.name.ilike(f"%{search}%"))

    query = query.order_by(Credential.name)
    credentials = query.all()

    api_logger.info("Credentials listed", user_id=current_user.id, count=len(credentials))

    return [CredentialResponse.from_credential(c) for c in credentials]


@router.get("/paginated", response_model=CredentialListResponse)
async def list_credentials_paginated(
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by name"),
):
    """
    List credentials with pagination (without sensitive data).
    """
    query = db.query(Credential)

    if search:
        query = query.filter(Credential.name.ilike(f"%{search}%"))

    total = query.count()
    total_pages = ceil(total / page_size) if total > 0 else 1

    query = query.order_by(Credential.name)
    query = query.offset((page - 1) * page_size).limit(page_size)
    credentials = query.all()

    return CredentialListResponse(
        items=[CredentialResponse.from_credential(c) for c in credentials],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{credential_id}", response_model=CredentialResponse)
async def get_credential(
    credential_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Get a specific credential by ID (without sensitive data).
    """
    credential = db.query(Credential).filter(
        Credential.id == credential_id,
    ).first()

    if not credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credential not found",
        )

    return CredentialResponse.from_credential(credential)


@router.post("", response_model=CredentialResponse, status_code=status.HTTP_201_CREATED)
async def create_credential(
    data: CredentialCreate,
    current_user: CurrentModerator,
    db: DbSession,
):
    """
    Create a new credential with encrypted sensitive data.
    """
    # Check for duplicate name
    existing = db.query(Credential).filter(
        Credential.name == data.name,
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Credential with this name already exists",
        )

    # Encrypt sensitive data
    password_encrypted = encrypt(data.password) if data.password else None
    private_key_encrypted = encrypt(data.private_key) if data.private_key else None
    passphrase_encrypted = encrypt(data.passphrase) if data.passphrase else None

    credential = Credential(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        name=data.name,
        description=data.description,
        username=data.username,
        password_encrypted=password_encrypted,
        private_key_encrypted=private_key_encrypted,
        passphrase_encrypted=passphrase_encrypted,
    )

    db.add(credential)
    db.commit()
    db.refresh(credential)

    api_logger.info("Credential created", user_id=current_user.id, credential_id=credential.id)

    # Audit log (without sensitive data)
    log_create(
        db=db,
        user_id=current_user.id,
        table_name="credentials",
        record_id=credential.id,
        new_data={
            "name": credential.name,
            "description": credential.description,
            "username": credential.username,
        },
    )
    db.commit()

    return CredentialResponse.from_credential(credential)


@router.patch("/{credential_id}", response_model=CredentialResponse)
async def update_credential(
    credential_id: str,
    data: CredentialUpdate,
    current_user: CurrentModerator,
    db: DbSession,
):
    """
    Update a credential.
    """
    credential = db.query(Credential).filter(
        Credential.id == credential_id,
    ).first()

    if not credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credential not found",
        )

    # Capture old data for audit (without sensitive data)
    old_data = {
        "name": credential.name,
        "description": credential.description,
        "username": credential.username,
    }

    # Check for duplicate name if updating
    if data.name and data.name != credential.name:
        existing = db.query(Credential).filter(
            Credential.name == data.name,
            Credential.id != credential_id,
        ).first()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Credential with this name already exists",
            )

    # Update non-sensitive fields
    if data.name is not None:
        credential.name = data.name
    if data.description is not None:
        credential.description = data.description
    if data.username is not None:
        credential.username = data.username

    # Update encrypted fields
    if data.password is not None:
        credential.password_encrypted = encrypt(data.password) if data.password else None
    if data.private_key is not None:
        credential.private_key_encrypted = encrypt(data.private_key) if data.private_key else None
    if data.passphrase is not None:
        credential.passphrase_encrypted = encrypt(data.passphrase) if data.passphrase else None

    db.commit()
    db.refresh(credential)

    api_logger.info("Credential updated", user_id=current_user.id, credential_id=credential.id)

    # Audit log with changes (without sensitive data)
    new_data = {
        "name": credential.name,
        "description": credential.description,
        "username": credential.username,
    }
    log_update(
        db=db,
        user_id=current_user.id,
        table_name="credentials",
        record_id=credential.id,
        old_data=old_data,
        new_data=new_data,
    )
    db.commit()

    return CredentialResponse.from_credential(credential)


@router.delete("/{credential_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_credential(
    credential_id: str,
    current_user: CurrentModerator,
    db: DbSession,
):
    """
    Delete a credential.
    """
    credential = db.query(Credential).filter(
        Credential.id == credential_id,
    ).first()

    if not credential:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Credential not found",
        )

    # Check if credential is in use
    if credential.devices:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete credential that is assigned to devices",
        )

    # Capture data before delete for audit (without sensitive data)
    old_data = {
        "name": credential.name,
        "description": credential.description,
        "username": credential.username,
    }

    db.delete(credential)

    api_logger.info("Credential deleted", user_id=current_user.id, credential_id=credential_id)

    # Audit log with deleted data
    log_delete(
        db=db,
        user_id=current_user.id,
        table_name="credentials",
        record_id=credential_id,
        old_data=old_data,
    )
    db.commit()
