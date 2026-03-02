"""
Backup Templates API routes - CRUD operations
"""

import uuid
from typing import Optional
from math import ceil

from fastapi import APIRouter, HTTPException, status, Query

from app.core.deps import CurrentUser, DbSession
from app.models.backup_template import BackupTemplate, TemplateStep
from app.schemas.template import (
    BackupTemplateCreate,
    BackupTemplateUpdate,
    BackupTemplateResponse,
    BackupTemplateListResponse,
    TemplateStepCreate,
    TemplateStepResponse,
)
from app.core.logging import get_api_logger
from app.services.audit import log_create, log_update, log_delete, model_to_dict

router = APIRouter()
api_logger = get_api_logger()


@router.get("", response_model=list[BackupTemplateResponse])
async def list_templates(
    current_user: CurrentUser,
    db: DbSession,
    search: Optional[str] = Query(None, description="Search by name"),
):
    """
    List all backup templates for the current user.
    """
    query = db.query(BackupTemplate)

    if search:
        query = query.filter(BackupTemplate.name.ilike(f"%{search}%"))

    query = query.order_by(BackupTemplate.name)
    templates = query.all()

    api_logger.info("Templates listed", user_id=current_user.id, count=len(templates))

    return templates


@router.get("/paginated", response_model=BackupTemplateListResponse)
async def list_templates_paginated(
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by name"),
):
    """
    List templates with pagination.
    """
    query = db.query(BackupTemplate)

    if search:
        query = query.filter(BackupTemplate.name.ilike(f"%{search}%"))

    total = query.count()
    total_pages = ceil(total / page_size) if total > 0 else 1

    query = query.order_by(BackupTemplate.name)
    query = query.offset((page - 1) * page_size).limit(page_size)
    templates = query.all()

    return BackupTemplateListResponse(
        items=templates,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.get("/{template_id}", response_model=BackupTemplateResponse)
async def get_template(
    template_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Get a specific backup template by ID.
    """
    template = db.query(BackupTemplate).filter(
        BackupTemplate.id == template_id,
    ).first()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )

    return template


@router.post("", response_model=BackupTemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(
    data: BackupTemplateCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Create a new backup template with optional steps.
    """
    # Check for duplicate name
    existing = db.query(BackupTemplate).filter(
        BackupTemplate.name == data.name,
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Template with this name already exists",
        )

    # If setting as default, unset other defaults
    if data.is_default:
        db.query(BackupTemplate).filter(
            BackupTemplate.is_default == True,
        ).update({"is_default": False})

    template = BackupTemplate(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        name=data.name,
        description=data.description,
        commands=data.commands,
        use_steps=data.use_steps,
        prompt_pattern=data.prompt_pattern,
        login_prompt=data.login_prompt,
        password_prompt=data.password_prompt,
        enable_prompt=data.enable_prompt,
        enable_required=data.enable_required,
        enable_password_required=data.enable_password_required,
        pagination_pattern=data.pagination_pattern,
        pagination_key=data.pagination_key,
        connection_timeout=data.connection_timeout,
        command_timeout=data.command_timeout,
        pre_commands=data.pre_commands,
        post_commands=data.post_commands,
        line_ending=data.line_ending,
        output_cleanup_patterns=data.output_cleanup_patterns,
        error_patterns=data.error_patterns,
        is_default=data.is_default,
    )

    db.add(template)

    # Add steps if provided
    if data.steps:
        for step_data in data.steps:
            step = TemplateStep(
                id=str(uuid.uuid4()),
                template_id=template.id,
                order=step_data.order,
                step_type=step_data.step_type,
                content=step_data.content,
                timeout=step_data.timeout,
                expect_pattern=step_data.expect_pattern,
                on_failure=step_data.on_failure,
                max_retries=step_data.max_retries,
                condition=step_data.condition,
                capture_output=step_data.capture_output,
                variable_name=step_data.variable_name,
            )
            db.add(step)

    db.commit()
    db.refresh(template)

    api_logger.info("Template created", user_id=current_user.id, template_id=template.id)

    # Audit log with full data
    log_create(
        db=db,
        user_id=current_user.id,
        table_name="backup_templates",
        record_id=template.id,
        new_data=model_to_dict(template),
    )
    db.commit()

    return template


@router.patch("/{template_id}", response_model=BackupTemplateResponse)
async def update_template(
    template_id: str,
    data: BackupTemplateUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Update a backup template.
    """
    template = db.query(BackupTemplate).filter(
        BackupTemplate.id == template_id,
    ).first()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )

    # Capture old data for audit
    old_data = model_to_dict(template)

    # Check for duplicate name if updating
    if data.name and data.name != template.name:
        existing = db.query(BackupTemplate).filter(
            BackupTemplate.name == data.name,
            BackupTemplate.id != template_id,
        ).first()

        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Template with this name already exists",
            )

    # Handle is_default flag
    if data.is_default is True:
        db.query(BackupTemplate).filter(
            BackupTemplate.is_default == True,
            BackupTemplate.id != template_id,
        ).update({"is_default": False})

    # Update fields
    if data.name is not None:
        template.name = data.name
    if data.description is not None:
        template.description = data.description
    if data.commands is not None:
        template.commands = data.commands
    if data.use_steps is not None:
        template.use_steps = data.use_steps
    if data.prompt_pattern is not None:
        template.prompt_pattern = data.prompt_pattern
    if data.login_prompt is not None:
        template.login_prompt = data.login_prompt
    if data.password_prompt is not None:
        template.password_prompt = data.password_prompt
    if data.enable_prompt is not None:
        template.enable_prompt = data.enable_prompt
    if data.enable_required is not None:
        template.enable_required = data.enable_required
    if data.enable_password_required is not None:
        template.enable_password_required = data.enable_password_required
    if data.pagination_pattern is not None:
        template.pagination_pattern = data.pagination_pattern
    if data.pagination_key is not None:
        template.pagination_key = data.pagination_key
    if data.connection_timeout is not None:
        template.connection_timeout = data.connection_timeout
    if data.command_timeout is not None:
        template.command_timeout = data.command_timeout
    if data.pre_commands is not None:
        template.pre_commands = data.pre_commands
    if data.post_commands is not None:
        template.post_commands = data.post_commands
    if data.line_ending is not None:
        template.line_ending = data.line_ending
    if data.output_cleanup_patterns is not None:
        template.output_cleanup_patterns = data.output_cleanup_patterns
    if data.error_patterns is not None:
        template.error_patterns = data.error_patterns
    if data.is_default is not None:
        template.is_default = data.is_default

    # Update steps if provided (replace all)
    if data.steps is not None:
        # Delete existing steps
        db.query(TemplateStep).filter(TemplateStep.template_id == template_id).delete()

        # Add new steps
        for step_data in data.steps:
            step = TemplateStep(
                id=str(uuid.uuid4()),
                template_id=template.id,
                order=step_data.order,
                step_type=step_data.step_type,
                content=step_data.content,
                timeout=step_data.timeout,
                expect_pattern=step_data.expect_pattern,
                on_failure=step_data.on_failure,
                max_retries=step_data.max_retries,
                condition=step_data.condition,
                capture_output=step_data.capture_output,
                variable_name=step_data.variable_name,
            )
            db.add(step)

    db.commit()
    db.refresh(template)

    api_logger.info("Template updated", user_id=current_user.id, template_id=template.id)

    # Audit log with changes
    new_data = model_to_dict(template)
    log_update(
        db=db,
        user_id=current_user.id,
        table_name="backup_templates",
        record_id=template.id,
        old_data=old_data,
        new_data=new_data,
    )
    db.commit()

    return template


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(
    template_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Delete a backup template.
    """
    template = db.query(BackupTemplate).filter(
        BackupTemplate.id == template_id,
    ).first()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )

    # Check if template is in use by devices
    if template.devices:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete template that is assigned to devices",
        )

    # Capture data before delete for audit
    old_data = model_to_dict(template)

    db.delete(template)

    api_logger.info("Template deleted", user_id=current_user.id, template_id=template_id)

    # Audit log with deleted data
    log_delete(
        db=db,
        user_id=current_user.id,
        table_name="backup_templates",
        record_id=template_id,
        old_data=old_data,
    )
    db.commit()


@router.post("/{template_id}/duplicate", response_model=BackupTemplateResponse, status_code=status.HTTP_201_CREATED)
async def duplicate_template(
    template_id: str,
    current_user: CurrentUser,
    db: DbSession,
    new_name: Optional[str] = Query(None, description="Name for the duplicated template"),
):
    """
    Duplicate a backup template with all its steps.
    """
    template = db.query(BackupTemplate).filter(
        BackupTemplate.id == template_id,
    ).first()

    if not template:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )

    # Generate new name
    base_name = new_name if new_name else f"{template.name} (Copy)"

    # Check for duplicate name
    existing = db.query(BackupTemplate).filter(
        BackupTemplate.name == base_name,
    ).first()

    if existing:
        # Append number to make unique
        counter = 1
        while True:
            test_name = f"{base_name} {counter}"
            existing = db.query(BackupTemplate).filter(
                BackupTemplate.name == test_name,
            ).first()
            if not existing:
                base_name = test_name
                break
            counter += 1

    # Create duplicate
    new_template = BackupTemplate(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        name=base_name,
        description=template.description,
        commands=template.commands,
        use_steps=template.use_steps,
        prompt_pattern=template.prompt_pattern,
        login_prompt=template.login_prompt,
        password_prompt=template.password_prompt,
        enable_prompt=template.enable_prompt,
        enable_required=template.enable_required,
        enable_password_required=template.enable_password_required,
        pagination_pattern=template.pagination_pattern,
        pagination_key=template.pagination_key,
        connection_timeout=template.connection_timeout,
        command_timeout=template.command_timeout,
        pre_commands=template.pre_commands,
        post_commands=template.post_commands,
        line_ending=template.line_ending,
        output_cleanup_patterns=template.output_cleanup_patterns,
        error_patterns=template.error_patterns,
        is_default=False,  # Never duplicate as default
    )

    db.add(new_template)

    # Duplicate steps
    for step in template.steps:
        new_step = TemplateStep(
            id=str(uuid.uuid4()),
            template_id=new_template.id,
            order=step.order,
            step_type=step.step_type,
            content=step.content,
            timeout=step.timeout,
            expect_pattern=step.expect_pattern,
            on_failure=step.on_failure,
            max_retries=step.max_retries,
            condition=step.condition,
            capture_output=step.capture_output,
            variable_name=step.variable_name,
        )
        db.add(new_step)

    db.commit()
    db.refresh(new_template)

    api_logger.info(
        "Template duplicated",
        user_id=current_user.id,
        source_id=template_id,
        new_id=new_template.id,
    )
    audit_logger.info(
        "Template duplicated",
        user_id=current_user.id,
        action="CREATE",
        table_name="backup_templates",
        record_id=new_template.id,
    )

    return new_template
