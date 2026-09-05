import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base

from config import get_settings

settings = get_settings()

# Ensure the data/ directory exists for SQLite file-based DB
if settings.database_url.startswith("sqlite"):
    os.makedirs("./data", exist_ok=True)

connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}

# NOTE ON MIGRATION TO MYSQL:
# Nothing below is SQLite-specific except `connect_args`. To move to MySQL,
# change DATABASE_URL in .env to a mysql+pymysql:// DSN and run
# `alembic upgrade head`. No application code changes needed.
engine = create_engine(settings.database_url, connect_args=connect_args, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    """FastAPI dependency: yields a DB session and guarantees it's closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create all tables. Called once at app startup."""
    from database import models  # noqa: F401  (register models on Base)
    Base.metadata.create_all(bind=engine)
