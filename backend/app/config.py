from pydantic_settings import BaseSettings
from pathlib import Path
import os

class Settings(BaseSettings):
    PROJECT_NAME: str = "Antigravity AI Generation Suite"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"
    
    # Base paths
    BASE_DIR: Path = Path(__file__).resolve().parent.parent.parent
    BACKEND_DIR: Path = BASE_DIR / "backend"
    MODELS_DIR: Path = BASE_DIR / "models"
    OUTPUTS_DIR: Path = BASE_DIR / "outputs"
    DATA_DIR: Path = BACKEND_DIR / "app" / "data"
    COMFY_DIR: Path = BASE_DIR / "comfy_engine"
    
    # ComfyUI Connection
    COMFY_HOST: str = "127.0.0.1"
    COMFY_PORT: int = 8188
    COMFY_API_URL: str = "http://127.0.0.1:8188"
    COMFY_WS_URL: str = "ws://127.0.0.1:8188/ws"
    
    # Offline guarantees
    HF_HUB_OFFLINE: str = "1"
    TRANSFORMERS_OFFLINE: str = "1"
    HF_DATASETS_OFFLINE: str = "1"
    
    # Database
    DATABASE_URL: str = f"sqlite:///{BASE_DIR / 'database.sqlite'}"
    
    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()

# Ensure directories exist
settings.MODELS_DIR.mkdir(parents=True, exist_ok=True)
settings.OUTPUTS_DIR.mkdir(parents=True, exist_ok=True)
settings.DATA_DIR.mkdir(parents=True, exist_ok=True)
(settings.MODELS_DIR / "checkpoints").mkdir(parents=True, exist_ok=True)
(settings.MODELS_DIR / "loras").mkdir(parents=True, exist_ok=True)
(settings.MODELS_DIR / "vae").mkdir(parents=True, exist_ok=True)
(settings.MODELS_DIR / "controlnet").mkdir(parents=True, exist_ok=True)
(settings.MODELS_DIR / "upscale_models").mkdir(parents=True, exist_ok=True)

# Enforce offline environment variables
os.environ["HF_HUB_OFFLINE"] = settings.HF_HUB_OFFLINE
os.environ["TRANSFORMERS_OFFLINE"] = settings.TRANSFORMERS_OFFLINE
os.environ["HF_DATASETS_OFFLINE"] = settings.HF_DATASETS_OFFLINE
