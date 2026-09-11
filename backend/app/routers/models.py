import asyncio
from fastapi import APIRouter
from typing import List, Dict, Any, Optional
from app.services.model_manager import model_manager
from app.services.prompt_pipeline import PromptPipeline
from app.services.comfy_client import comfy_client
from app.models.schemas import ModelInfo, LoraInfo, StylePreset, ResolutionPreset

router = APIRouter(prefix="/api", tags=["models"])
pipeline = PromptPipeline()

GIB = 1024 ** 3


def _vram_payload(
    used_bytes: float,
    total_bytes: float,
    device_name: Optional[str],
    source: str,
) -> Dict[str, Any]:
    used_gb = round(used_bytes / GIB, 1)
    total_gb = round(total_bytes / GIB, 1)
    pct = round((used_bytes / total_bytes) * 100, 1) if total_bytes else 0
    return {
        "used_bytes": int(used_bytes),
        "total_bytes": int(total_bytes),
        "used_gb": used_gb,
        "total_gb": total_gb,
        "percent": pct,
        "device_name": device_name,
        "source": source,
    }


def _vram_from_comfy(stats: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    devices = (stats or {}).get("devices") or []
    if not devices:
        return None
    device = devices[0]
    total = device.get("vram_total") or device.get("torch_vram_total") or 0
    free = device.get("vram_free") or device.get("torch_vram_free") or 0
    if not total:
        return None
    return _vram_payload(total - free, total, device.get("name"), "comfyui")


async def _vram_from_nvidia_smi() -> Optional[Dict[str, Any]]:
    try:
        proc = await asyncio.create_subprocess_exec(
            "nvidia-smi",
            "--query-gpu=name,memory.used,memory.total",
            "--format=csv,noheader,nounits",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.DEVNULL,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=2)
        if proc.returncode != 0 or not stdout:
            return None
        line = stdout.decode("utf-8", errors="ignore").strip().splitlines()[0]
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 3:
            return None
        name, used_mib, total_mib = parts[0], float(parts[1]), float(parts[2])
        return _vram_payload(used_mib * 1024 * 1024, total_mib * 1024 * 1024, name, "nvidia-smi")
    except Exception:
        return None

@router.get("/models", response_model=List[ModelInfo])
async def list_models():
    models = await model_manager.get_all_models()
    return models

@router.get("/loras", response_model=List[LoraInfo])
def list_loras():
    return model_manager.scan_loras()

@router.get("/styles", response_model=List[StylePreset])
def list_styles():
    return pipeline.get_available_styles()

@router.get("/resolutions", response_model=List[ResolutionPreset])
def list_resolutions():
    return pipeline.get_available_resolutions()

from app.config import settings

@router.get("/system/status")
async def get_system_status():
    is_running = await comfy_client.is_comfy_running()
    starting = False
    try:
        from comfy_engine.comfy_manager import is_comfy_starting
        starting = is_comfy_starting()
    except Exception:
        pass

    stats = await comfy_client.get_system_stats()
    vram = _vram_from_comfy(stats)
    if vram is None:
        vram = await _vram_from_nvidia_smi()
    if vram is None:
        vram = {
            "used_bytes": 0,
            "total_bytes": 0,
            "used_gb": None,
            "total_gb": None,
            "percent": None,
            "device_name": None,
            "source": "unavailable",
        }
    return {
        "comfyui_online": is_running,
        "engine_starting": starting and not is_running,
        "offline_mode_enforced": True,
        "stats": stats,
        "vram": vram,
    }

@router.post("/system/start-engine")
async def trigger_start_engine():
    try:
        from comfy_engine.comfy_manager import ensure_comfy_running, check_comfy_health
        if check_comfy_health(settings.COMFY_HOST, settings.COMFY_PORT):
            return {"status": "already_running", "comfyui_online": True}
        asyncio.create_task(ensure_comfy_running(settings.COMFY_HOST, settings.COMFY_PORT))
        return {"status": "starting", "comfyui_online": False, "message": "ComfyUI engine launch initiated."}
    except Exception as e:
        return {"status": "error", "error": str(e), "comfyui_online": False}
