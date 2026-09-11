"""Required calculations and chart series."""

from __future__ import annotations

from typing import Any

from gallery_app.constants import MODEL_CODES, MODELS, all_image_ids, split_image_id
from gallery_app.dataset import load_dataset
from gallery_app.scoring import is_complete_entry, load_agreed


def _agreed_map() -> dict[str, dict[str, Any]]:
    return load_agreed().get("scores") or {}


def model_metrics() -> dict[str, dict[str, Any]]:
    dataset = load_dataset().get("images") or {}
    agreed = _agreed_map()
    out: dict[str, dict[str, Any]] = {}
    for code in MODEL_CODES:
        keys = [k for k in all_image_ids() if split_image_id(k)[1] == code]
        quality_vals = []
        adherence_vals = []
        times = []
        completed = 0
        vrams = []
        scored = 0
        for key in keys:
            row = dataset.get(key) or {}
            status = (row.get("completion_status") or "").lower()
            if status == "completed":
                completed += 1
            duration = row.get("generation_duration_seconds")
            if duration is not None:
                try:
                    times.append(float(duration))
                except (TypeError, ValueError):
                    pass
            vram = row.get("peak_vram_gb")
            if vram is not None:
                try:
                    vrams.append(float(vram))
                except (TypeError, ValueError):
                    pass
            entry = agreed.get(key) or {}
            if is_complete_entry(entry):
                scored += 1
                quality_vals.append(int(entry["total"]))
                adherence_vals.append(int(entry["prompt_adherence"]))
        out[code] = {
            "code": code,
            "name": MODELS[code]["name"],
            "average_quality": round(sum(quality_vals) / 18, 3) if quality_vals else None,
            "average_prompt_adherence": round(sum(adherence_vals) / 18, 3) if adherence_vals else None,
            "average_generation_time": round(sum(times) / 18, 3) if times else None,
            "completion_rate": round((completed / 18) * 100, 1),
            "peak_vram_gb": max(vrams) if vrams else None,
            "agreed_scored_count": scored,
            "time_count": len(times),
            "vram_count": len(vrams),
            "completed_count": completed,
        }
    return out


def chart_series() -> dict[str, dict[str, Any]]:
    metrics = model_metrics()
    labels = [metrics[c]["name"] for c in MODEL_CODES]
    return {
        "labels": labels,
        "codes": list(MODEL_CODES),
        "average_quality": [metrics[c]["average_quality"] or 0 for c in MODEL_CODES],
        "average_prompt_adherence": [metrics[c]["average_prompt_adherence"] or 0 for c in MODEL_CODES],
        "average_generation_time": [metrics[c]["average_generation_time"] or 0 for c in MODEL_CODES],
        "peak_vram_gb": [metrics[c]["peak_vram_gb"] or 0 for c in MODEL_CODES],
        "metrics": metrics,
    }
