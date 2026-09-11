"""One-image ComfyUI generation that writes into the benchmark dataset."""

from __future__ import annotations

from typing import Any

from gallery_app.comfy_client import GenerateResult, generate
from gallery_app.comfy_workflows import SAMPLER, SCHEDULER, is_api_graph, load_model_workflow_file, resolve_graph
from gallery_app.constants import MODELS, NEGATIVE_PROMPT, image_id
from gallery_app.dataset import load_dataset, sync_from_prompts_and_disk, update_row
from gallery_app.paths import image_path, warmup_path
from gallery_app.prompts import load_prompts, prompt_by_id, prompt_issues


class Blocked(RuntimeError):
    pass


def prompt_not_ready(prompt: dict[str, Any]) -> str | None:
    issues = prompt_issues(prompt)
    if issues:
        return " ".join(issues)
    return None


def run_core_image(
    *,
    prompt_id: str,
    model_code: str,
    checkpoint: str,
    base_url: str,
    allow_unfrozen: bool = False,
) -> GenerateResult:
    prompts = load_prompts()
    if not prompts.get("frozen") and not allow_unfrozen:
        raise Blocked("Freeze the 18 prompts before collecting scored images (Prompts page).")
    prompt = prompt_by_id(prompts, prompt_id)
    reason = prompt_not_ready(prompt)
    if reason and not allow_unfrozen:
        raise Blocked(f"{prompt_id} is not ready: {reason}")

    dest = image_path(prompt_id, model_code)
    if dest.is_file():
        raise Blocked(
            f"{dest.name} already exists. The PDF forbids replacing a generated image, even a weak one."
        )

    key = image_id(prompt_id, model_code)
    prefix = key
    graph, workflow_version = resolve_graph(
        model_code,
        checkpoint=checkpoint,
        prompt=prompt.get("prompt") or "",
        seed=int(prompt.get("seed") or 0),
        filename_prefix=prefix,
    )
    result = generate(graph, base=base_url)
    data = sync_from_prompts_and_disk()
    fields: dict[str, Any] = {
        "checkpoint_filename": checkpoint,
        "workflow_version": workflow_version,
        "positive_prompt": prompt.get("prompt") or "",
        "negative_prompt": NEGATIVE_PROMPT,
        "seed": prompt.get("seed"),
        "steps": MODELS[model_code]["steps"],
        "cfg": MODELS[model_code]["cfg"],
        "sampler": SAMPLER,
        "scheduler": SCHEDULER,
        "start_time": result.start_time,
        "generation_duration_seconds": result.duration_seconds,
        "completion_status": result.status,
        "peak_vram_gb": result.peak_vram_gb,
        "observed_system_ram_gb": result.ram_gb,
        "technical_error": result.error,
        "verification_status": "verified" if result.ok else "unverified",
    }
    if result.ok and result.image_bytes:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(result.image_bytes)
        fields["png_exists"] = True
        fields["filename"] = dest.name
        fields["comfy_output_filename"] = result.comfy_filename
    else:
        fields["png_exists"] = dest.is_file()
    update_row(data, key, fields)
    return result


def run_warmup(
    *,
    model_code: str,
    checkpoint: str,
    base_url: str,
) -> GenerateResult:
    dest = warmup_path(model_code)
    if dest.is_file():
        raise Blocked(f"{dest.name} already exists. Warm-ups are also generated once.")
    model = MODELS[model_code]
    graph, _ = resolve_graph(
        model_code,
        checkpoint=checkpoint,
        prompt="A simple ceramic mug on a wooden table, soft daylight, plain background, photorealistic.",
        seed=1,
        filename_prefix=f"WARMUP_{model_code}",
    )
    result = generate(graph, base=base_url)
    if result.ok and result.image_bytes:
        dest.parent.mkdir(parents=True, exist_ok=True)
        dest.write_bytes(result.image_bytes)
    return result


def workflow_note(model_code: str) -> str:
    data = load_model_workflow_file(model_code)
    if data and is_api_graph(data):
        return f"Using locked API workflow {MODELS[model_code]['workflow_file']}"
    return (
        f"Using built-in text-to-image graph (replace {MODELS[model_code]['workflow_file']} "
        "with ComfyUI Save API Format when you have a locked workflow)."
    )


def latest_row(prompt_id: str, model_code: str) -> dict[str, Any]:
    data = load_dataset()
    return (data.get("images") or {}).get(image_id(prompt_id, model_code)) or {}
