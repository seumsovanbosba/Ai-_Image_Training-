"""Repository paths for the KiTH benchmark toolkit."""

from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
BENCHMARK = ROOT / "benchmark"

COMPUTER_INFO = BENCHMARK / "Computer_info.json"
PROMPTS = BENCHMARK / "prompts" / "prompts.json"
WORKFLOWS = BENCHMARK / "workflows"
DATASET = BENCHMARK / "dataset" / "dataset.json"

IMAGES_CORE = BENCHMARK / "images" / "core"
IMAGES_WARMUP = BENCHMARK / "images" / "warmup"
IMAGES_NATIVE = BENCHMARK / "images" / "optional_native"

SCORES_DIR = BENCHMARK / "scores"
SCORE_HOURMENG = SCORES_DIR / "hourmeng.json"
SCORE_BOSBA = SCORES_DIR / "bosba.json"
SCORE_AGREED = SCORES_DIR / "agreed.json"

PROGRESS_DIR = ROOT / ".progress"
PROGRESS_STATUS = PROGRESS_DIR / "status.json"

MODEL_FOLDERS = {
    "SD15": IMAGES_CORE / "SD15",
    "SDXL": IMAGES_CORE / "SDXL",
    "TURBO": IMAGES_CORE / "TURBO",
}


def image_path(prompt_id: str, model_code: str) -> Path:
    return MODEL_FOLDERS[model_code] / f"{prompt_id}_{model_code}.png"


def warmup_path(model_code: str) -> Path:
    return IMAGES_WARMUP / f"WARMUP_{model_code}.png"


def native_path(model_code: str) -> Path:
    return IMAGES_NATIVE / f"NATIVE_{model_code}.png"
