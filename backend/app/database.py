from sqlmodel import SQLModel, create_engine, Session
from app.config import settings
import logging

logger = logging.getLogger(__name__)

engine = create_engine(
    settings.DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False
)

from sqlalchemy import text

def init_db():
    from app.models.generation import Board, ImageAsset, GenerationTask
    SQLModel.metadata.create_all(engine)
    with engine.connect() as conn:
        for col, col_type in [("is_img2img", "BOOLEAN DEFAULT 0"), ("is_upscale", "BOOLEAN DEFAULT 0")]:
            try:
                conn.execute(text(f"ALTER TABLE image_assets ADD COLUMN {col} {col_type}"))
                conn.commit()
            except Exception:
                pass
    logger.info("Database initialized successfully.")

def get_session():
    with Session(engine) as session:
        yield session
