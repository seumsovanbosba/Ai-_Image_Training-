"""54-image dataset: create rows from prompts, scan PNGs, record performance."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from gallery_app.constants import (
    CORE_HEIGHT,
    CORE_WIDTH,
    MODEL_CODES,
    MODELS,
    NEGATIVE_PROMPT,
    PROMPT_IDS,
    all_image_ids,
    image_id,
)
from gallery_app.io_util import load_json, save_json
from gallery_app.paths import ROOT, DATASET, WORKFLOWS, image_path, native_path, warmup_path
from gallery_app.prompts import load_prompts, prompt_by_id


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def empty_row(prompt: dict[str, Any], model_code: str) -> dict[str, Any]:
    model = MODELS[model_code]
    pid = prompt["id"]
    key = image_id(pid, model_code)
    path = image_path(pid, model_code)
    return {
        "image_id": key,
        "prompt_id": pid,
        "category": prompt["category"],
        "objective_checklist": list(prompt.get("visible_requirements") or []),
        "model_name": model["name"],
        "model_code": model_code,
        "checkpoint_filename": "",
        "workflow_version": model["workflow_file"],
        "positive_prompt": prompt.get("prompt") or "",
        "negative_prompt": NEGATIVE_PROMPT,
        "seed": prompt.get("seed"),
        "width": CORE_WIDTH,
        "height": CORE_HEIGHT,
        "steps": model["steps"],
        "cfg": model["cfg"],
        "sampler": "",
        "scheduler": "",
        "start_time": "",
        "generation_duration_seconds": None,
        "completion_status": "pending",
        "peak_vram_gb": None,
        "observed_system_ram_gb": None,
        "technical_error": "",
        "filename": f"{key}.png",
        "folder_location": str(path.relative_to(ROOT)),
        "verification_status": "unverified",
        "png_exists": path.is_file(),
        "excluded_from_scores": False,
    }


def default_dataset() -> dict[str, Any]:
    prompts = load_prompts()
    images: dict[str, Any] = {}
    for pid in PROMPT_IDS:
        prompt = prompt_by_id(prompts, pid)
        for code in MODEL_CODES:
            row = empty_row(prompt, code)
            images[row["image_id"]] = row
    return {
        "schema_version": 1,
        "updated_at": now_iso(),
        "images": images,
    }


def load_dataset() -> dict[str, Any]:
    data = load_json(DATASET, None)
    if not data or "images" not in data:
        data = default_dataset()
        save_dataset(data)
    return data


def save_dataset(data: dict[str, Any]) -> None:
    data["updated_at"] = now_iso()
    save_json(DATASET, data)


def sync_from_prompts_and_disk(data: dict[str, Any] | None = None) -> dict[str, Any]:
    """Refresh prompt text, checklist, seeds, and png_exists without wiping measurements."""
    data = data or load_dataset()
    prompts = load_prompts()
    images = data.setdefault("images", {})
    for pid in PROMPT_IDS:
        prompt = prompt_by_id(prompts, pid)
        for code in MODEL_CODES:
            key = image_id(pid, code)
            path = image_path(pid, code)
            if key not in images:
                images[key] = empty_row(prompt, code)
            row = images[key]
            row["prompt_id"] = pid
            row["category"] = prompt["category"]
            row["objective_checklist"] = list(prompt.get("visible_requirements") or [])
            row["positive_prompt"] = prompt.get("prompt") or ""
            row["negative_prompt"] = NEGATIVE_PROMPT
            row["seed"] = prompt.get("seed")
            row["model_name"] = MODELS[code]["name"]
            row["model_code"] = code
            row["workflow_version"] = MODELS[code]["workflow_file"]
            row["width"] = CORE_WIDTH
            row["height"] = CORE_HEIGHT
            row["steps"] = MODELS[code]["steps"]
            row["cfg"] = MODELS[code]["cfg"]
            row["filename"] = f"{key}.png"
            row["folder_location"] = str(path.relative_to(ROOT))
            row["png_exists"] = path.is_file()
            row["excluded_from_scores"] = False
    data["images"] = images
    save_dataset(data)
    return data


def get_row(data: dict[str, Any], image_key: str) -> dict[str, Any]:
    return data["images"][image_key]


def update_row(data: dict[str, Any], image_key: str, fields: dict[str, Any]) -> dict[str, Any]:
    row = data["images"][image_key]
    row.update(fields)
    save_dataset(data)
    return row


def missing_core_images(data: dict[str, Any]) -> list[str]:
    missing = []
    for key in all_image_ids():
        row = data.get("images", {}).get(key)
        if not row or not row.get("png_exists"):
            missing.append(key)
    return missing


def audit_filenames(data: dict[str, Any]) -> dict[str, Any]:
    from gallery_app.paths import MODEL_FOLDERS

    expected = set(all_image_ids())
    found: set[str] = set()
    extras: list[str] = []
    for code, folder in MODEL_FOLDERS.items():
        if not folder.exists():
            continue
        for png in folder.glob("*.png"):
            stem = png.stem
            if stem in expected:
                found.add(stem)
            else:
                extras.append(str(png))
    missing = sorted(expected - found)
    duplicates: list[str] = []
    return {
        "expected": 54,
        "found": len(found),
        "missing": missing,
        "unexpected_files": extras,
        "duplicates": duplicates,
        "warmup": {code: warmup_path(code).is_file() for code in MODEL_CODES},
        "optional_native": {code: native_path(code).is_file() for code in MODEL_CODES},
        "workflows": {
            code: (WORKFLOWS / MODELS[code]["workflow_file"]).is_file() for code in MODEL_CODES
        },
    }
