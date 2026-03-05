"""
Database configuration and session management
"""

from typing import Generator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session, declarative_base
from sqlalchemy.pool import QueuePool

from app.core.config import settings
from app.core.logging import logger

# Create SQLAlchemy engine with connection pooling
engine = create_engine(
    settings.DATABASE_URL,
    poolclass=QueuePool,
    pool_size=settings.DB_POOL_SIZE,
    max_overflow=settings.DB_MAX_OVERFLOW,
    pool_pre_ping=True,  # Enable connection health checks
    pool_recycle=3600,  # Recycle connections after 1 hour
    echo=settings.DEBUG,  # Log SQL queries in debug mode
)

# Create session factory
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# Base class for models
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """
    Dependency that provides a database session.
    Automatically closes the session after use.
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Initialize database connection and verify connectivity"""
    from sqlalchemy import text
    try:
        # Test database connection
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        logger.info(
            "Database connection established",
            host=settings.DB_HOST,
            database=settings.DB_NAME,
        )
    except Exception as e:
        logger.error(
            "Database connection failed",
            host=settings.DB_HOST,
            database=settings.DB_NAME,
            error=str(e),
        )
        raise


# Event listeners for connection pool monitoring (errors only — no per-request noise)
@event.listens_for(engine, "connect")
def on_connect(dbapi_conn, connection_record):
    logger.debug("New database connection created")


@event.listens_for(engine, "invalidate")
def on_invalidate(dbapi_conn, connection_record, exception):
    logger.warning("Database connection invalidated", error=str(exception) if exception else "unknown")
