"""
Authentication service — handles user credential validation and user management.
Token generation is no longer needed (static API token is used instead).
"""

from typing import Optional

from sqlalchemy.orm import Session

from app.models.user import User, UserRole
from app.services.password import hash_password, verify_password
from app.core.logging import get_auth_logger, get_audit_logger

auth_logger = get_auth_logger()
audit_logger = get_audit_logger()


class AuthService:
    """Service for user authentication operations"""

    def __init__(self, db: Session):
        self.db = db

    def get_user_by_email(self, email: str) -> Optional[User]:
        """Get user by email"""
        return self.db.query(User).filter(User.email == email).first()

    def get_user_by_id(self, user_id: str) -> Optional[User]:
        """Get user by ID"""
        return self.db.query(User).filter(User.id == user_id).first()

    def create_user(
        self,
        email: str,
        password: str,
        full_name: Optional[str] = None,
        role: str = "user",
    ) -> User:
        """
        Create a new user.

        Raises:
            ValueError: If email already exists
        """
        existing = self.get_user_by_email(email)
        if existing:
            raise ValueError("Email already registered")

        user = User(
            email=email.lower(),
            password_hash=hash_password(password),
            full_name=full_name,
        )
        self.db.add(user)
        self.db.flush()

        user_role = UserRole(user_id=user.id, role=role)
        self.db.add(user_role)

        self.db.commit()
        self.db.refresh(user)

        auth_logger.info("User created", user_id=user.id, email=user.email, role=role)
        audit_logger.info(
            "User registration",
            user_id=user.id,
            action="REGISTER",
            table_name="users",
            record_id=user.id,
        )

        return user

    def authenticate(self, email: str, password: str) -> Optional[User]:
        """
        Authenticate user with email and password.
        Returns User if valid and active, None otherwise.
        """
        user = self.get_user_by_email(email.lower())

        if not user:
            auth_logger.warning("Login failed - user not found", email=email)
            return None

        if not user.is_active:
            auth_logger.warning("Login failed - user inactive", email=email, user_id=user.id)
            return None

        if not verify_password(password, user.password_hash):
            auth_logger.warning("Login failed - invalid password", email=email, user_id=user.id)
            return None

        auth_logger.info("User authenticated", user_id=user.id, email=user.email)
        audit_logger.info(
            "User login",
            user_id=user.id,
            action="LOGIN",
            table_name="users",
            record_id=user.id,
        )

        return user

    def change_password(self, user: User, current_password: str, new_password: str) -> bool:
        """
        Change user password.

        Raises:
            ValueError: If current password is incorrect
        """
        if not verify_password(current_password, user.password_hash):
            raise ValueError("Current password is incorrect")

        user.password_hash = hash_password(new_password)
        self.db.commit()

        auth_logger.info("Password changed", user_id=user.id)
        audit_logger.info(
            "Password change",
            user_id=user.id,
            action="PASSWORD_CHANGE",
            table_name="users",
            record_id=user.id,
        )

        return True
