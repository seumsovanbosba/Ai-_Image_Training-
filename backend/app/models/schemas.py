from pydantic import BaseModel, Field, field_serializer
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone

class GenerateRequest(BaseModel):
    prompt: str
    negative_prompt: Optional[str] = ""
    styles: List[str] = Field(default_factory=list)
    auto_expand: bool = False
    expansion_level: str = "medium"
    width: int = 1024
    height: int = 1024
    model_name: Optional[str] = "sd_xl_base_1.0.safetensors"
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
    expansion_level: str = "medium"
    base_image: str  # Base64 data URL or server filename
    mask_image: str  # Base64 data URL or server filename
    denoise: float = 0.85
    width: Optional[int] = 1024
    height: Optional[int] = 1024
    model_name: Optional[str] = "sd_xl_base_1.0.safetensors"
    sampler: str = "dpmpp_2m"
    scheduler: str = "karras"
    steps: int = 30
    cfg_scale: float = 7.0
    seed: Optional[int] = -1
    board_id: Optional[int] = None

class Img2ImgRequest(BaseModel):
    prompt: str
    negative_prompt: Optional[str] = ""
    styles: List[str] = Field(default_factory=list)
    auto_expand: bool = False
    expansion_level: str = "medium"
    image: str  # Base64 data URL or server filename
    fidelity: float = 0.65  # 0.1 to 0.9 (higher = closer to source image)
    width: Optional[int] = 1024
    height: Optional[int] = 1024
    model_name: Optional[str] = "sd_xl_base_1.0.safetensors"
    sampler: str = "dpmpp_2m"
    scheduler: str = "karras"
    steps: int = 30
    cfg_scale: float = 7.0
    seed: Optional[int] = -1
    board_id: Optional[int] = None

class UpscaleRequest(BaseModel):
    image_id: Optional[int] = None
    image: Optional[str] = None  # Base64 data URL or filename if image_id not provided
    prompt: Optional[str] = None
    negative_prompt: Optional[str] = None
    scale_factor: float = 2.0
    denoise: float = 0.30
    model_name: Optional[str] = "sd_xl_base_1.0.safetensors"
    sampler: str = "dpmpp_2m"
    scheduler: str = "karras"
    steps: int = 20
    cfg_scale: float = 7.0
    seed: Optional[int] = -1

class BoardCreate(BaseModel):
    name: str
    description: Optional[str] = None

class BoardRead(BaseModel):
    id: int
    name: str
    description: Optional[str]
    created_at: datetime
    image_count: int = 0

    @field_serializer("created_at")
    def serialize_created_at(self, dt: datetime, _info):
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

class ImageAssetRead(BaseModel):
    id: int
    filename: str
    filepath: str
    url: str
    prompt: str
    negative_prompt: Optional[str] = ""
    styles_applied: List[str] = []
    model_name: str
    sampler: str
    scheduler: str
    steps: int
    cfg_scale: float
    seed: int
    width: int
    height: int
    is_inpaint: bool = False
    is_img2img: bool = False
    is_upscale: bool = False
    board_id: Optional[int] = None
    created_at: datetime

    @field_serializer("created_at")
    def serialize_created_at(self, dt: datetime, _info):
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

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
