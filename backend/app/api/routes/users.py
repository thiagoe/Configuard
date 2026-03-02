"""
User API routes
"""

import uuid

from fastapi import APIRouter, HTTPException, status
from datetime import datetime

from app.core.deps import CurrentUser, CurrentAdmin, DbSession
from app.schemas.user import UserResponse, UserUpdate, UserUpdateAdmin, UserCreate, UserListResponse
from app.models.user import User, UserRole
from app.core.logging import get_api_logger, get_audit_logger
from app.core.timezone import now
from app.services.password import hash_password

router = APIRouter()
api_logger = get_api_logger()
audit_logger = get_audit_logger()


@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: CurrentUser):
    """
    Get current user's profile.
    """
    ts = now()
    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        full_name=current_user.full_name,
        role=current_user.role_name,
        is_active=current_user.is_active,
        created_at=ts,
        updated_at=ts,
    )


@router.put("/me", response_model=UserResponse)
async def update_current_user_profile(
    data: UserUpdate,
    current_user: CurrentUser,
    db: DbSession,
):
    """
    Update current user's profile.
    """
    update_data = data.model_dump(exclude_unset=True)

    if update_data:
        for key, value in update_data.items():
            setattr(current_user, key, value)

        db.commit()
        db.refresh(current_user)

        audit_logger.info(
            "User profile updated",
            user_id=current_user.id,
            action="UPDATE",
            table_name="users",
            record_id=current_user.id,
            new_data=update_data,
        )

    return UserResponse.from_user(current_user)


# Admin routes
@router.get("", response_model=UserListResponse)
async def list_users(
    current_admin: CurrentAdmin,
    db: DbSession,
    page: int = 1,
    page_size: int = 20,
    search: str = None,
    role: str = None,
    is_active: bool = None,
):
    """
    List all users (admin only).
    """
    query = db.query(User)

    # Apply filters
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (User.email.ilike(search_filter)) | (User.full_name.ilike(search_filter))
        )

    if role:
        query = query.join(UserRole).filter(UserRole.role == role)

    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    # Get total count
    total = query.count()

    # Pagination
    total_pages = (total + page_size - 1) // page_size
    offset = (page - 1) * page_size

    users = query.order_by(User.created_at.desc()).offset(offset).limit(page_size).all()

    return UserListResponse(
        items=[UserResponse.from_user(u) for u in users],
        total=total,
        page=page,
        page_size=page_size,
        total_pages=total_pages,
    )


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    data: UserCreate,
    current_admin: CurrentAdmin,
    db: DbSession,
):
    """
    Create a new local user (admin only).
    """
    existing = db.query(User).filter(User.email == data.email.lower()).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="E-mail já cadastrado",
        )

    user = User(
        id=str(uuid.uuid4()),
        email=data.email.lower(),
        password_hash=hash_password(data.password),
        full_name=data.full_name,
        is_active=True,
    )
    db.add(user)
    db.flush()
    db.add(UserRole(user_id=user.id, role=data.role))
    db.commit()
    db.refresh(user)

    audit_logger.info(
        "User created by admin",
        user_id=current_admin.id,
        action="CREATE",
        table_name="users",
        record_id=user.id,
        new_data={"email": user.email, "role": data.role},
    )

    return UserResponse.from_user(user)


@router.get("/{user_id}", response_model=UserResponse)
async def get_user(
    user_id: str,
    current_admin: CurrentAdmin,
    db: DbSession,
):
    """
    Get user by ID (admin only).
    """
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    return UserResponse.from_user(user)


@router.put("/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: str,
    data: UserUpdateAdmin,
    current_admin: CurrentAdmin,
    db: DbSession,
):
    """
    Update user (admin only).
    """
    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    update_data = data.model_dump(exclude_unset=True)
    old_data = {
        "full_name": user.full_name,
        "is_active": user.is_active,
        "role": user.role_name,
    }

    # Handle role update separately
    if "role" in update_data:
        new_role = update_data.pop("role")
        if user.role:
            user.role.role = new_role
        else:
            role = UserRole(user_id=user.id, role=new_role)
            db.add(role)

    # Handle password update separately (hash before storing)
    if "password" in update_data:
        new_password = update_data.pop("password")
        if new_password:
            user.password_hash = hash_password(new_password)

    # Update other fields
    for key, value in update_data.items():
        setattr(user, key, value)

    db.commit()
    db.refresh(user)

    audit_logger.info(
        "User updated by admin",
        user_id=current_admin.id,
        action="UPDATE",
        table_name="users",
        record_id=user_id,
        old_data=old_data,
        new_data=data.model_dump(exclude_unset=True),
    )

    return UserResponse.from_user(user)


@router.delete("/{user_id}", response_model=dict)
async def delete_user(
    user_id: str,
    current_admin: CurrentAdmin,
    db: DbSession,
):
    """
    Delete user (admin only).
    Cannot delete self.
    """
    if user_id == current_admin.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete your own account",
        )

    user = db.query(User).filter(User.id == user_id).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    email = user.email
    db.delete(user)
    db.commit()

    audit_logger.info(
        "User deleted by admin",
        user_id=current_admin.id,
        action="DELETE",
        table_name="users",
        record_id=user_id,
        old_data={"email": email},
    )

    return {"message": "User deleted successfully"}
