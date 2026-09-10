from pathlib import Path
from typing import List, Dict, Any, Optional
from app.config import settings
from app.services.comfy_client import comfy_client
import logging

logger = logging.getLogger(__name__)

PREFERRED_UPSCALERS = [
    "RealESRGAN_x4plus.pth",
    "4x-UltraSharp.pth",
    "4x-UltraSharp.safetensors",
    "RealESRGAN_x4plus.safetensors",
]


class ModelManager:
    def __init__(self, models_dir: Path = None):
        self.models_dir = models_dir or settings.MODELS_DIR
        self.checkpoints_dir = self.models_dir / "checkpoints"
        self.loras_dir = self.models_dir / "loras"
        self.vae_dir = self.models_dir / "vae"
        self.upscale_dir = self.models_dir / "upscale_models"

    def scan_local_checkpoints(self) -> List[Dict[str, Any]]:
        models = []
        if not self.checkpoints_dir.exists():
            return models

        for ext in ["*.safetensors", "*.ckpt", "*.bin"]:
            for file_path in self.checkpoints_dir.glob(ext):
                size_bytes = file_path.stat().st_size
                size_gb = round(size_bytes / (1024 ** 3), 2)
                name = file_path.name
                lower_name = name.lower()

                if "xl" in lower_name or "sdxl" in lower_name:
                    m_type = "sdxl"
                elif "flux" in lower_name:
                    m_type = "flux"
                elif "1.5" in lower_name or "v1-5" in lower_name:
                    m_type = "sd15"
                else:
                    m_type = "sdxl" if size_gb > 5.0 else "sd15"

                models.append({
                    "name": name,
                    "path": str(file_path),
                    "type": m_type,
                    "size_gb": size_gb
                })

        return models

    def scan_loras(self) -> List[Dict[str, Any]]:
        loras = []
        if not self.loras_dir.exists():
            return loras
        for ext in ["*.safetensors", "*.ckpt", "*.pt"]:
            for file_path in self.loras_dir.glob(ext):
                size_bytes = file_path.stat().st_size
                loras.append({
                    "name": file_path.name,
                    "path": str(file_path),
                    "size_mb": round(size_bytes / (1024 ** 2), 1),
                })
        loras.sort(key=lambda x: x["name"].lower())
        return loras

    def find_upscale_model(self) -> Optional[str]:
        if not self.upscale_dir.exists():
            return None
        for name in PREFERRED_UPSCALERS:
            if (self.upscale_dir / name).exists():
                return name
        for ext in ["*.pth", "*.safetensors", "*.pt"]:
            matches = sorted(self.upscale_dir.glob(ext))
            if matches:
                return matches[0].name
        return None

    async def get_all_models(self) -> List[Dict[str, Any]]:
        local_models = self.scan_local_checkpoints()
        comfy_models = await comfy_client.get_available_models()

        existing_names = {m["name"] for m in local_models}
        for cm in comfy_models:
            if cm not in existing_names:
                lower = cm.lower()
                m_type = "sdxl" if "xl" in lower else ("flux" if "flux" in lower else "sd15")
                local_models.append({
                    "name": cm,
                    "path": cm,
                    "type": m_type,
                    "size_gb": 0.0
                })

        if not local_models:
            local_models = [
                {"name": "sd_xl_base_1.0.safetensors", "path": "models/checkpoints/sd_xl_base_1.0.safetensors", "type": "sdxl", "size_gb": 6.46},
                {"name": "v1-5-pruned-emaonly.safetensors", "path": "models/checkpoints/v1-5-pruned-emaonly.safetensors", "type": "sd15", "size_gb": 3.97},
                {"name": "flux1-schnell.safetensors", "path": "models/checkpoints/flux1-schnell.safetensors", "type": "flux", "size_gb": 11.9}
            ]

        return local_models

model_manager = ModelManager()
