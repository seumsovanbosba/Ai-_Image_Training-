from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime

class GenerateRequest(BaseModel):
    prompt: str
    negative_prompt: Optional[str] = ""
    styles: List[str] = Field(default_factory=list)
    auto_expand: bool = True
    expansion_level: str = "medium"
    width: int = 1024
    height: int = 1024
    model_name: Optional[str] = None
    sampler: str = "dpmpp_2m"
    scheduler: str = "karras"
    steps: int = 30
    cfg_scale: float = 7.0
    seed: Optional[int] = -1
    batch_size: int = 1
    board_id: Optional[int] = None

class InpaintRequest(BaseModel):
    prompt: str
    negative_prompt: Optional[str] = ""
    styles: List[str] = Field(default_factory=list)
    auto_expand: bool = False
    base_image: str  # Base64 data URL or server filename
    mask_image: str  # Base64 data URL or server filename
    denoise: float = 0.85
    width: Optional[int] = 1024
    height: Optional[int] = 1024
    model_name: Optional[str] = None
    sampler: str = "dpmpp_2m"
    scheduler: str = "karras"
    steps: int = 30
    cfg_scale: float = 7.0
    seed: Optional[int] = -1
    board_id: Optional[int] = None

class BoardCreate(BaseModel):
    name: str
    description: Optional[str] = None

class BoardRead(BaseModel):
    id: int
    name: str
    description: Optional[str]
    created_at: datetime
    image_count: int = 0

class ImageAssetRead(BaseModel):
    id: int
    filename: str
    filepath: str
    url: str
    prompt: str
    negative_prompt: Optional[str]
    styles_applied: List[str] = []
    model_name: str
    sampler: str
    scheduler: str
    steps: int
    cfg_scale: float
    seed: int
    width: int
    height: int
    is_inpaint: bool
    board_id: Optional[int]
    created_at: datetime

class TaskStatusResponse(BaseModel):
    task_id: str
    status: str
    progress: float
    current_step: int
    total_steps: int
    preview_url: Optional[str] = None
    output_images: List[str] = []
    error_message: Optional[str] = None

class ModelInfo(BaseModel):
    name: str
    path: str
    type: str  # 'sdxl', 'flux', 'sd15', 'unknown'
    size_gb: float

class StylePreset(BaseModel):
    name: str
    category: str
    positive_prompt: str
    negative_prompt: str

class ResolutionPreset(BaseModel):
    width: int
    height: int
    label: str
    aspect_ratio: str
    target: str
