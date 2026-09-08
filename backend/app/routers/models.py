from fastapi import APIRouter
from typing import List, Dict, Any
from app.services.model_manager import model_manager
from app.services.prompt_pipeline import PromptPipeline
from app.services.comfy_client import comfy_client
from app.models.schemas import ModelInfo, StylePreset, ResolutionPreset

router = APIRouter(prefix="/api", tags=["models"])
pipeline = PromptPipeline()

@router.get("/models", response_model=List[ModelInfo])
async def list_models():
    models = await model_manager.get_all_models()
    return models

@router.get("/styles", response_model=List[StylePreset])
def list_styles():
    return pipeline.get_available_styles()

@router.get("/resolutions", response_model=List[ResolutionPreset])
def list_resolutions():
    return pipeline.get_available_resolutions()

@router.get("/system/status")
async def get_system_status():
    is_running = await comfy_client.is_comfy_running()
    stats = await comfy_client.get_system_stats()
    return {
        "comfyui_online": is_running,
        "offline_mode_enforced": True,
        "stats": stats
    }
