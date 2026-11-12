import os
from collections.abc import Generator

from dotenv import load_dotenv
from sqlalchemy import URL, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

load_dotenv()


class Base(DeclarativeBase):
    pass


def _database_url() -> str | URL:
    configured_url = os.getenv("DATABASE_URL")
    if configured_url:
        return configured_url

    return URL.create(
        "mysql+pymysql",
        username=os.getenv("MYSQL_USER", "order_user"),
        password=os.getenv("MYSQL_PASSWORD", "change_me"),
        host=os.getenv("MYSQL_HOST", "localhost"),
        port=int(os.getenv("MYSQL_PORT", "3306")),
        database=os.getenv("MYSQL_DATABASE", "order_service_db"),
        query={"charset": "utf8mb4"},
    )


engine = create_engine(_database_url(), pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
