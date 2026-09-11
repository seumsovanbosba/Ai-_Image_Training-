"""Locked benchmark constants from the KiTH internship PDF."""

from typing import Any

MODEL_CODES = ("SD15", "SDXL", "TURBO")

MODELS: dict[str, dict[str, Any]] = {
    "SD15": {
        "code": "SD15",
        "name": "Stable Diffusion 1.5",
        "role": "Low memory baseline",
        "steps": 25,
        "cfg": 7.0,
        "batch": 1,
        "width": 512,
        "height": 512,
        "workflow_file": "SD15.json",
        "source": "https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5",
        "typical_checkpoint": "v1-5-pruned-emaonly.safetensors",
    },
    "SDXL": {
        "code": "SDXL",
        "name": "Stable Diffusion XL Base 1.0",
        "role": "Quality oriented comparison",
        "steps": 25,
        "cfg": 7.0,
        "batch": 1,
        "width": 512,
        "height": 512,
        "workflow_file": "SDXL.json",
        "source": "https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0",
        "typical_checkpoint": "sd_xl_base_1.0.safetensors",
    },
    "TURBO": {
        "code": "TURBO",
        "name": "SDXL Turbo",
        "role": "Speed oriented comparison",
        "steps": 4,
        "cfg": 1.0,
        "batch": 1,
        "width": 512,
        "height": 512,
        "workflow_file": "TURBO.json",
        "source": "https://huggingface.co/stabilityai/sdxl-turbo",
        "typical_checkpoint": "sdxl_turbo_1.0_fp16.safetensors",
    },
}

CATEGORIES = [
    ("Single subject", "One clear object or character with lighting and background"),
    ("Multiple objects", "Object count, color and attribute accuracy"),
    ("Spatial relationships", "Above, below, beside, behind and foreground instructions"),
    ("Art and visual style", "Watercolor, paper cut, 3D render or flat illustration"),
    ("Education and campus", "Classroom, laboratory, student event or recruitment concept"),
    ("Short text rendering", "One short word or phrase integrated into a clean design"),
]

PROMPT_IDS = [f"P{i:02d}" for i in range(1, 19)]

PILOT_PROMPT_IDS = ["P01", "P07", "P16"]

EVALUATORS = {
    "hourmeng": {"id": "hourmeng", "name": "Eang Hourmeng", "file_key": "hourmeng"},
    "bosba": {"id": "bosba", "name": "Soem Sovanbosba", "file_key": "bosba"},
}

CRITERIA = [
    ("prompt_adherence", "Prompt adherence"),
    ("composition", "Composition"),
    ("visual_coherence", "Visual coherence"),
    ("practical_usefulness", "Practical usefulness"),
]

RUBRIC = {
    "prompt_adherence": {
        2: "All visible requirements met",
        1: "Some requirements met",
        0: "Main request not followed",
    },
    "composition": {
        2: "Clear and balanced",
        1: "Usable with minor problems",
        0: "Confusing or badly arranged",
    },
    "visual_coherence": {
        2: "Objects and details are coherent",
        1: "Minor artifacts",
        0: "Major artifacts or distortion",
    },
    "practical_usefulness": {
        2: "Ready or easy to refine",
        1: "Needs significant editing",
        0: "Not usable for the purpose",
    },
}

NEGATIVE_PROMPT = ""
CORE_WIDTH = 512
CORE_HEIGHT = 512


def category_for_prompt(prompt_id: str) -> str:
    index = int(prompt_id[1:]) - 1
    return CATEGORIES[index // 3][0]


def image_id(prompt_id: str, model_code: str) -> str:
    return f"{prompt_id}_{model_code}"


def all_image_ids() -> list[str]:
    return [image_id(pid, code) for pid in PROMPT_IDS for code in MODEL_CODES]


def split_image_id(image_key: str) -> tuple[str, str]:
    prompt_id, model_code = image_key.rsplit("_", 1)
    return prompt_id, model_code
