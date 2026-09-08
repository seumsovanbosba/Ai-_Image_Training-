from sqlmodel import SQLModel, Field, Relationship
from typing import Optional, List
from datetime import datetime
import json

class Board(SQLModel, table=True):
    __tablename__ = "boards"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    name: str = Field(index=True, unique=True)
    description: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    
    images: List["ImageAsset"] = Relationship(back_populates="board")

class ImageAsset(SQLModel, table=True):
    __tablename__ = "image_assets"
    
    id: Optional[int] = Field(default=None, primary_key=True)
    filename: str = Field(index=True)
    filepath: str
    prompt: str
    negative_prompt: Optional[str] = Field(default="")
    styles_applied: Optional[str] = Field(default="[]")  # JSON encoded list of style names
    model_name: str
    sampler: str = Field(default="euler")
    scheduler: str = Field(default="karras")
    steps: int = Field(default=30)
    cfg_scale: float = Field(default=7.0)
    seed: int
    width: int
    height: int
    is_inpaint: bool = Field(default=False)
    
    board_id: Optional[int] = Field(default=None, foreign_key="boards.id")
    board: Optional[Board] = Relationship(back_populates="images")
    created_at: datetime = Field(default_factory=datetime.utcnow)

class GenerationTask(SQLModel, table=True):
    __tablename__ = "generation_tasks"
    
    id: str = Field(primary_key=True)  # UUID or task_id
    status: str = Field(default="pending")  # pending, running, completed, failed, interrupted
    progress: float = Field(default=0.0)  # 0 to 100
    current_step: int = Field(default=0)
    total_steps: int = Field(default=30)
    preview_url: Optional[str] = Field(default=None)
    output_images: Optional[str] = Field(default="[]")  # JSON encoded list of filenames
    error_message: Optional[str] = Field(default=None)
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
