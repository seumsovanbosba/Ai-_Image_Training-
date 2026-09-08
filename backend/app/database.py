from sqlmodel import SQLModel, create_engine, Session
from app.config import settings
import logging

logger = logging.getLogger(__name__)

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False
)

def init_db():
    from app.models.generation import Board, ImageAsset, GenerationTask
    SQLModel.metadata.create_all(engine)
    logger.info("Database initialized successfully.")

def get_session():
    with Session(engine) as session:
        yield session
