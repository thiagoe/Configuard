"""
Devices API routes - CRUD operations
"""

import uuid
import csv
import io
from typing import Optional, List
from math import ceil

from fastapi import APIRouter, HTTPException, status, Query, Request, File, UploadFile
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import joinedload
import json
from queue import Queue
from threading import Thread
from pydantic import BaseModel

from app.core.deps import CurrentUser, DbSession
from app.models.device import Device
from app.models.device_model import DeviceModel
from app.models.brand import Brand
from app.models.category import Category
from app.models.credential import Credential
from app.models.backup_template import BackupTemplate
from app.schemas.device import (
    DeviceCreate,
    DeviceUpdate,
    DeviceResponse,
    DeviceListResponse,
)
from app.schemas.configuration import ConfigurationDetailResponse
from app.services.backup_executor import execute_backup, BackupError, BackupResult
from app.core.config import settings
from app.core.database import SessionLocal
from app.core.logging import get_api_logger
from app.services.audit import log_create, log_update, log_delete, model_to_dict
from app.services.email import send_notification

router = APIRouter()
api_logger = get_api_logger()


def _validate_reference(db, model, record_id: Optional[str], name: str) -> None:
    if record_id is None:
        return
    record = db.query(model).filter(model.id == record_id).first()
    if not record:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {name} reference",
        )


@router.get("", response_model=list[DeviceResponse])
async def list_devices(
    current_user: CurrentUser,
    db: DbSession,
    search: Optional[str] = Query(None, description="Search by name, hostname, or IP"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    brand_id: Optional[str] = Query(None, description="Filter by brand"),
    category_id: Optional[str] = Query(None, description="Filter by category"),
    model_id: Optional[str] = Query(None, description="Filter by model"),
    backup_enabled: Optional[bool] = Query(None, description="Filter by backup enabled"),
):
    """
    List all devices for the current user.
    """
    query = db.query(Device).options(
        joinedload(Device.brand),
        joinedload(Device.category),
        joinedload(Device.model),
    )

    if search:
        query = query.filter(
            Device.name.ilike(f"%{search}%") |
            Device.hostname.ilike(f"%{search}%") |
            Device.ip_address.ilike(f"%{search}%")
        )

    if status_filter:
        query = query.filter(Device.status == status_filter)

    if brand_id:
        query = query.filter(Device.brand_id == brand_id)

    if category_id:
        query = query.filter(Device.category_id == category_id)

    if model_id:
        query = query.filter(Device.model_id == model_id)

    if backup_enabled is not None:
        query = query.filter(Device.backup_enabled == backup_enabled)

    devices = query.order_by(Device.name).all()

    api_logger.info("Devices listed", user_id=current_user.id, count=len(devices))
    return devices


@router.get("/paginated", response_model=DeviceListResponse)
async def list_devices_paginated(
    current_user: CurrentUser,
    db: DbSession,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: Optional[str] = Query(None, description="Search by name, hostname, or IP"),
    status_filter: Optional[str] = Query(None, alias="status", description="Filter by status"),
    brand_id: Optional[str] = Query(None, description="Filter by brand"),
    category_id: Optional[str] = Query(None, description="Filter by category"),
    model_id: Optional[str] = Query(None, description="Filter by model"),
    backup_enabled: Optional[bool] = Query(None, description="Filter by backup enabled"),
):
    """
    List devices with pagination.
    """
    query = db.query(Device).options(
        joinedload(Device.brand),
        joinedload(Device.category),
        joinedload(Device.model),
    )

    if search:
        query = query.filter(
            Device.name.ilike(f"%{search}%") |
            Device.hostname.ilike(f"%{search}%") |
            Device.ip_address.ilike(f"%{search}%")
        )

    if status_filter:
        query = query.filter(Device.status == status_filter)

    if brand_id:
        query = query.filter(Device.brand_id == brand_id)

    if category_id:
        query = query.filter(Device.category_id == category_id)

    if model_id:
        query = query.filter(Device.model_id == model_id)

    if backup_enabled is not None:
        query = query.filter(Device.backup_enabled == backup_enabled)

    total = query.count()
    total_pages = ceil(total / page_size) if total > 0 else 1

    devices = query.order_by(Device.name).offset((page - 1) * page_size).limit(page_size).all()

    return DeviceListResponse(
        items=devices,
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


CSV_FIELDS = [
    "name", "ip_address", "hostname", "port", "protocol", "status", "backup_enabled",
    "notes", "brand_name", "category_name", "model_name", "credential_name",
]


class DeviceImportResult(BaseModel):
    """Summary of a bulk import operation"""
    total: int
    created: int
    skipped: int
    errors: List[dict]


@router.get("/export")
async def export_devices(
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Export all devices as a CSV file for backup/migration.
    Sensitive fields (credential_id, template_id) are excluded.
    Brand and category names are included for portability.
    """
    devices = db.query(Device).options(
        joinedload(Device.brand),
        joinedload(Device.category),
        joinedload(Device.model),
        joinedload(Device.credential),
    ).order_by(Device.name).all()

    output = io.StringIO()
    writer = csv.DictWriter(output, fieldnames=CSV_FIELDS, lineterminator="\n")
    writer.writeheader()

    for d in devices:
        writer.writerow({
            "name": d.name,
            "ip_address": d.ip_address,
            "hostname": d.hostname or "",
            "port": d.port,
            "protocol": "telnet" if d.port == 23 else "ssh",
            "status": d.status,
            "backup_enabled": "true" if d.backup_enabled else "false",
            "notes": d.notes or "",
            "brand_name": d.brand.name if d.brand else "",
            "category_name": d.category.name if d.category else "",
            "model_name": d.model.name if d.model else "",
            "credential_name": d.credential.name if d.credential else "",
        })

    csv_bytes = output.getvalue().encode("utf-8-sig")  # BOM for Excel compatibility
    headers = {"Content-Disposition": "attachment; filename=devices_export.csv"}
    return StreamingResponse(
        iter([csv_bytes]),
        media_type="text/csv; charset=utf-8",
        headers=headers,
    )


@router.post("/import", response_model=DeviceImportResult, status_code=status.HTTP_200_OK)
async def import_devices(
    current_user: CurrentUser,
    db: DbSession,
    file: UploadFile = File(...),
):
    """
    Bulk-import devices from an uploaded CSV file.
    Skips devices whose name+ip_address combination already exists.
    Resolves brand and category by name when provided.
    """
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Only CSV files are accepted")

    content = await file.read()
    try:
        text = content.decode("utf-8-sig")  # handle BOM if present
    except UnicodeDecodeError:
        text = content.decode("latin-1")

    reader = csv.DictReader(io.StringIO(text))

    required = {"name", "ip_address"}
    if reader.fieldnames is None or not required.issubset(set(reader.fieldnames)):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"CSV must contain columns: {', '.join(required)}",
        )

    rows = list(reader)
    if not rows:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="CSV file is empty")

    created = 0
    skipped = 0
    errors = []

    def _bool(val: str, default: bool) -> bool:
        v = (val or "").strip().lower()
        if v in ("true", "1", "yes", "sim"): return True
        if v in ("false", "0", "no", "nao", "não"): return False
        return default

    # Pre-fetch all existing records for name lookup (mutable dicts updated on create)
    brands: dict[str, str] = {b.name.lower(): b.id for b in db.query(Brand).all()}
    categories: dict[str, str] = {c.name.lower(): c.id for c in db.query(Category).all()}
    models: dict[str, str] = {m.name.lower(): m.id for m in db.query(DeviceModel).all()}
    credentials: dict[str, str] = {c.name.lower(): c.id for c in db.query(Credential).all()}

    def _get_or_create_brand(nm: str) -> str:
        key = nm.lower()
        if key not in brands:
            obj = Brand(id=str(uuid.uuid4()), user_id=current_user.id, name=nm)
            db.add(obj)
            db.flush()
            brands[key] = obj.id
        return brands[key]

    def _get_or_create_category(nm: str) -> str:
        key = nm.lower()
        if key not in categories:
            obj = Category(id=str(uuid.uuid4()), user_id=current_user.id, name=nm)
            db.add(obj)
            db.flush()
            categories[key] = obj.id
        return categories[key]

    def _get_or_create_model(nm: str, b_id: str | None, c_id: str | None) -> str:
        key = nm.lower()
        if key not in models:
            obj = DeviceModel(id=str(uuid.uuid4()), user_id=current_user.id, name=nm,
                              brand_id=b_id, category_id=c_id)
            db.add(obj)
            db.flush()
            models[key] = obj.id
        return models[key]

    def _get_or_create_credential(nm: str) -> str:
        key = nm.lower()
        if key not in credentials:
            obj = Credential(id=str(uuid.uuid4()), user_id=current_user.id,
                             name=nm, username="admin")
            db.add(obj)
            db.flush()
            credentials[key] = obj.id
        return credentials[key]

    for idx, row in enumerate(rows):
        name = (row.get("name") or "").strip()
        ip_address = (row.get("ip_address") or "").strip()

        if not name or not ip_address:
            errors.append({"row": idx + 2, "name": name or "?", "error": "name and ip_address are required"})
            continue

        try:
            # Skip duplicates (same name + IP)
            existing = db.query(Device).filter(
                Device.name == name,
                Device.ip_address == ip_address,
            ).first()
            if existing:
                skipped += 1
                continue

            # Determine port: explicit port column takes priority;
            # if absent/invalid, fall back to protocol column (telnet→23, else 22)
            port_val = row.get("port", "").strip()
            protocol_val = (row.get("protocol") or "").strip().lower()
            if port_val.isdigit():
                port = int(port_val)
            elif protocol_val == "telnet":
                port = 23
            else:
                port = 22

            brand_name = (row.get("brand_name") or "").strip()
            category_name = (row.get("category_name") or "").strip()
            model_name_val = (row.get("model_name") or "").strip()
            credential_name_val = (row.get("credential_name") or "").strip()

            brand_id = _get_or_create_brand(brand_name) if brand_name else None
            category_id = _get_or_create_category(category_name) if category_name else None
            model_id = _get_or_create_model(model_name_val, brand_id, category_id) if model_name_val else None
            credential_id = _get_or_create_credential(credential_name_val) if credential_name_val else None

            device = Device(
                id=str(uuid.uuid4()),
                user_id=current_user.id,
                name=name,
                ip_address=ip_address,
                hostname=(row.get("hostname") or "").strip() or None,
                port=port,
                brand_id=brand_id,
                category_id=category_id,
                model_id=model_id,
                credential_id=credential_id,
                status=(row.get("status") or "active").strip(),
                backup_enabled=_bool(row.get("backup_enabled", ""), True),
                notes=(row.get("notes") or "").strip() or None,
            )
            db.add(device)
            db.flush()

            log_create(
                db=db,
                user_id=current_user.id,
                table_name="devices",
                record_id=device.id,
                new_data={"name": device.name, "ip_address": device.ip_address, "source": "csv_import"},
            )

            created += 1
        except Exception as exc:
            errors.append({"row": idx + 2, "name": name, "error": str(exc)})

    db.commit()
    api_logger.info("Devices CSV imported", user_id=current_user.id, created=created, skipped=skipped, errors=len(errors))

    return DeviceImportResult(total=len(rows), created=created, skipped=skipped, errors=errors)


@router.get("/{device_id}", response_model=DeviceResponse)
async def get_device(
    device_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Get a specific device by ID.
    """
    device = db.query(Device).options(
        joinedload(Device.brand),
        joinedload(Device.category),
        joinedload(Device.model),
    ).filter(Device.id == device_id).first()

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )

    return device


@router.post("", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED)
async def create_device(
    data: DeviceCreate,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Create a new device.
    """
    _validate_reference(db, Brand, data.brand_id, "brand")
    _validate_reference(db, Category, data.category_id, "category")
    _validate_reference(db, DeviceModel, data.model_id, "model")
    _validate_reference(db, Credential, data.credential_id, "credential")
    _validate_reference(db, BackupTemplate, data.backup_template_id, "backup template")

    device = Device(
        id=str(uuid.uuid4()),
        user_id=current_user.id,
        name=data.name,
        ip_address=data.ip_address,
        hostname=data.hostname,
        port=data.port,
        brand_id=data.brand_id,
        category_id=data.category_id,
        model_id=data.model_id,
        credential_id=data.credential_id,
        backup_template_id=data.backup_template_id,
        status=data.status,
        backup_enabled=data.backup_enabled,
        notes=data.notes,
    )

    db.add(device)
    db.commit()
    db.refresh(device)

    api_logger.info("Device created", user_id=current_user.id, device_id=device.id)

    # Audit log with full data
    log_create(
        db=db,
        user_id=current_user.id,
        table_name="devices",
        record_id=device.id,
        new_data=model_to_dict(device),
    )
    db.commit()

    return device


@router.patch("/{device_id}", response_model=DeviceResponse)
async def update_device(
    device_id: str,
    data: DeviceUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Update a device.
    """
    device = db.query(Device).options(
        joinedload(Device.brand),
        joinedload(Device.category),
        joinedload(Device.model),
    ).filter(Device.id == device_id).first()

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )

    # Capture old data for audit
    old_data = model_to_dict(device)

    update_data = data.model_dump(exclude_unset=True)

    if "brand_id" in update_data and update_data["brand_id"] is not None:
        _validate_reference(db, Brand, update_data["brand_id"], "brand")
    if "category_id" in update_data and update_data["category_id"] is not None:
        _validate_reference(db, Category, update_data["category_id"], "category")
    if "model_id" in update_data and update_data["model_id"] is not None:
        _validate_reference(db, DeviceModel, update_data["model_id"], "model")
    if "credential_id" in update_data and update_data["credential_id"] is not None:
        _validate_reference(db, Credential, update_data["credential_id"], "credential")
    if "backup_template_id" in update_data and update_data["backup_template_id"] is not None:
        _validate_reference(db, BackupTemplate, update_data["backup_template_id"], "backup template")

    api_logger.info("Device update - before", device_id=device.id, backup_enabled_before=device.backup_enabled, update_data=update_data)

    # Check if device is being deactivated (backup_enabled going from True to False)
    being_deactivated = (
        "backup_enabled" in update_data
        and not update_data["backup_enabled"]
        and old_data.get("backup_enabled")
    )
    device_name = device.name

    for field, value in update_data.items():
        setattr(device, field, value)

    db.commit()

    api_logger.info("Device update - after commit", device_id=device.id, backup_enabled_after=device.backup_enabled)

    if being_deactivated:
        send_notification(db, "device_disabled", {"device_name": device_name})

    # Audit log with changes
    new_data = model_to_dict(device)
    log_update(
        db=db,
        user_id=current_user.id,
        table_name="devices",
        record_id=device.id,
        old_data=old_data,
        new_data=new_data,
    )
    db.commit()

    # Reload device with relationships for response
    device = db.query(Device).options(
        joinedload(Device.brand),
        joinedload(Device.category),
        joinedload(Device.model),
    ).filter(Device.id == device.id).first()

    return device


@router.delete("/{device_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_device(
    device_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Delete a device.
    """
    device = db.query(Device).filter(Device.id == device_id).first()

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )

    # Capture data before delete for audit
    old_data = model_to_dict(device)
    device_name = device.name

    db.delete(device)

    api_logger.info("Device deleted", user_id=current_user.id, device_id=device_id)

    # Audit log with deleted data
    log_delete(
        db=db,
        user_id=current_user.id,
        table_name="devices",
        record_id=device_id,
        old_data=old_data,
    )
    db.commit()

    send_notification(db, "device_deleted", {"device_name": device_name})


@router.post("/{device_id}/backup", response_model=ConfigurationDetailResponse)
async def execute_device_backup(
    device_id: str,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Execute a manual backup for a device.

    Returns the configuration (new if changes detected, or latest existing if no changes).
    """
    device = db.query(Device).filter(Device.id == device_id).first()

    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )

    try:
        result = execute_backup(db, device, current_user.id)
    except BackupError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )
    except TimeoutError as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=str(exc),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )

    # Return the new configuration if changes detected, otherwise return the latest
    if result.configuration:
        return result.configuration
    else:
        # No changes - return the latest existing configuration
        from app.models.configuration import Configuration
        latest = db.query(Configuration).filter(
            Configuration.device_id == device_id
        ).order_by(Configuration.version.desc()).first()

        if not latest:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="No configuration available",
            )
        return latest


@router.get("/{device_id}/backup/stream")
async def stream_device_backup(
    device_id: str,
    request: Request,
    db: DbSession,
    token: str = Query(None, description="Access token for SSE auth"),
    log_level: str = Query("info", description="Log level: info|verbose|debug"),
):
    """
    Stream backup execution logs via SSE.
    """
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.replace("Bearer ", "")

    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    if token != settings.API_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing API token",
        )

    device = db.query(Device).filter(Device.id == device_id).first()
    if not device:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Device not found",
        )

    # Resolve the real user_id from X-User-Id header (set by frontend after login)
    # Falls back to first admin in DB if not provided or not found
    from app.core.deps import _resolve_user
    user_id_header = request.headers.get("X-User-Id")
    resolved_user = _resolve_user(db, user_id_header)
    caller_user_id = resolved_user.id

    queue: Queue[str | None] = Queue()

    def emit(event: str, payload: dict) -> None:
        data = json.dumps(payload, ensure_ascii=False)
        queue.put(f"event: {event}\ndata: {data}\n\n")

    def run_backup():
        thread_db = SessionLocal()
        try:
            emit("status", {"message": "Iniciando backup em tempo real"})
            thread_device = thread_db.query(Device).filter(
                Device.id == device_id,
            ).first()
            if not thread_device:
                emit("error", {"message": "Device not found"})
                return

            execute_backup(
                thread_db,
                thread_device,
                caller_user_id,
                event_callback=lambda event, payload: emit(event, payload),
                log_level=log_level if log_level in ("info", "verbose", "debug") else "info",
            )
        except Exception as exc:
            emit("error", {"message": str(exc)})
        finally:
            thread_db.close()
            queue.put(None)

    Thread(target=run_backup, daemon=True).start()

    def event_stream():
        yield "event: open\ndata: {}\n\n"
        while True:
            item = queue.get()
            if item is None:
                break
            yield item

    return StreamingResponse(event_stream(), media_type="text/event-stream")
