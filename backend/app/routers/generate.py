from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session, select
from typing import Dict, Any
import uuid
import json
import base64
import time
from datetime import datetime
from io import BytesIO
from PIL import Image

from app.database import get_session, engine
from app.models.generation import GenerationTask, ImageAsset
from app.models.schemas import GenerateRequest, InpaintRequest, Img2ImgRequest, UpscaleRequest
from app.services.prompt_pipeline import PromptPipeline
from app.services.workflow_compiler import WorkflowCompiler
from app.services.comfy_client import comfy_client
from app.config import settings

router = APIRouter(prefix="/api", tags=["generation"])
pipeline = PromptPipeline()


def _decode_b64(data_uri: str) -> bytes:
    if "," in data_uri:
        data_uri = data_uri.split(",", 1)[1]
    return base64.b64decode(data_uri)


def _snap8(value: int) -> int:
    return max(8, int(round(value / 8) * 8))


def _inspect_image(image_bytes: bytes, fallback_w: int = 1024, fallback_h: int = 1024):
    try:
        with Image.open(BytesIO(image_bytes)) as pil_img:
            return pil_img.size
    except Exception:
        return fallback_w, fallback_h


async def _queue_image_task(session: Session, compiled: dict, req_meta: dict, steps: int):
    task_id = str(uuid.uuid4())
    actual_seed = compiled["seed"]
    workflow_dag = compiled["workflow"]

    db_task = GenerationTask(
        id=task_id,
        status="pending",
        progress=0.0,
        current_step=0,
        total_steps=steps,
        output_images="[]"
    )
    session.add(db_task)
    session.commit()

    req_meta = {**req_meta, "seed": actual_seed}

    async def on_event(event):
        if event.get("type") == "completed":
            _save_task_completion(task_id, event.get("output_images", []), req_meta)

    comfy_client.subscribe(task_id, on_event)
    await comfy_client.queue_prompt(workflow_dag, task_id)
    return task_id, actual_seed

def _save_task_completion(task_id: str, output_images: list, req_meta: dict):
    '''Callback when generation finishes to persist image assets in the database.'''
    with Session(engine) as session:
        task = session.get(GenerationTask, task_id)
        if task:
            task.status = "completed"
            task.progress = 100.0
            task.output_images = json.dumps(output_images)
            task.updated_at = datetime.utcnow()
            session.add(task)
            
            for img_name in output_images:
                img_path = str(settings.OUTPUTS_DIR / img_name)
                asset = ImageAsset(
                    filename=img_name,
                    filepath=img_path,
                    prompt=req_meta.get("prompt", ""),
                    negative_prompt=req_meta.get("negative_prompt", ""),
                    styles_applied=json.dumps(req_meta.get("styles", [])),
                    model_name=req_meta.get("model_name", "default"),
                    sampler=req_meta.get("sampler", "dpmpp_2m"),
                    scheduler=req_meta.get("scheduler", "karras"),
                    steps=req_meta.get("steps", 30),
                    cfg_scale=req_meta.get("cfg_scale", 7.0),
                    seed=req_meta.get("seed", 0),
                    width=req_meta.get("width", 1024),
                    height=req_meta.get("height", 1024),
                    is_inpaint=req_meta.get("is_inpaint", False),
                    board_id=req_meta.get("board_id")
                )
                session.add(asset)
            session.commit()

@router.post("/generate")
async def generate_image(req: GenerateRequest, session: Session = Depends(get_session)):
    task_id = str(uuid.uuid4())
    
    # 1. Fooocus-style prompt processing
    processed = pipeline.process(
        prompt=req.prompt,
        negative_prompt=req.negative_prompt or "",
        styles=req.styles,
        auto_expand=req.auto_expand,
        expansion_level=req.expansion_level
    )

    # 2. Model resolution
    model_name = req.model_name or "v1-5-pruned-emaonly.safetensors"

    # 3. Compile DAG workflow
    compiled = WorkflowCompiler.compile_txt2img(
        prompt=processed["positive_prompt"],
        negative_prompt=processed["negative_prompt"],
        model_name=model_name,
        width=req.width,
        height=req.height,
        steps=req.steps,
        cfg=req.cfg_scale,
        sampler_name=req.sampler,
        scheduler=req.scheduler,
        seed=req.seed,
        batch_size=req.batch_size
    )

    actual_seed = compiled["seed"]
    workflow_dag = compiled["workflow"]

    # 4. Record task in DB
    db_task = GenerationTask(
        id=task_id,
        status="pending",
        progress=0.0,
        current_step=0,
        total_steps=req.steps,
        output_images="[]"
    )
    session.add(db_task)
    session.commit()

    # 5. Metadata for persistence
    req_meta = {
        "prompt": processed["positive_prompt"],
        "negative_prompt": processed["negative_prompt"],
        "styles": req.styles,
        "model_name": model_name,
        "sampler": req.sampler,
        "scheduler": req.scheduler,
        "steps": req.steps,
        "cfg_scale": req.cfg_scale,
        "seed": actual_seed,
        "width": req.width,
        "height": req.height,
        "is_inpaint": False,
        "board_id": req.board_id
    }

    # 6. Subscribe internal database persister to completion event
    async def on_event(event):
        if event.get("type") == "completed":
            _save_task_completion(task_id, event.get("output_images", []), req_meta)

    comfy_client.subscribe(task_id, on_event)

    # 7. Queue prompt to ComfyUI
    await comfy_client.queue_prompt(workflow_dag, task_id)

    return {
        "task_id": task_id,
        "seed": actual_seed,
        "processed_prompt": processed
    }

@router.post("/inpaint")
async def inpaint_image(req: InpaintRequest, session: Session = Depends(get_session)):
    task_id = str(uuid.uuid4())
    
    # 1. Process prompt
    processed = pipeline.process(
        prompt=req.prompt,
        negative_prompt=req.negative_prompt or "",
        styles=req.styles,
        auto_expand=req.auto_expand
    )

    # 2. Decode base & mask images and upload to ComfyUI
    base_fn = f"inpaint_base_{task_id[:8]}.png"
    mask_fn = f"inpaint_mask_{task_id[:8]}.png"

    base_bytes = _decode_b64(req.base_image)
    mask_bytes = _decode_b64(req.mask_image)

    # Inspect image dimensions
    try:
        with Image.open(BytesIO(base_bytes)) as pil_img:
            img_w, img_h = pil_img.size
    except Exception:
        img_w, img_h = req.width or 1024, req.height or 1024

    await comfy_client.upload_image(base_bytes, base_fn)
    await comfy_client.upload_image(mask_bytes, mask_fn)

    # 3. Model & DAG compilation
    model_name = req.model_name or "v1-5-pruned-emaonly.safetensors"
    compiled = WorkflowCompiler.compile_inpaint(
        prompt=processed["positive_prompt"],
        base_image_name=base_fn,
        mask_image_name=mask_fn,
        negative_prompt=processed["negative_prompt"],
        model_name=model_name,
        steps=req.steps,
        cfg=req.cfg_scale,
        sampler_name=req.sampler,
        scheduler=req.scheduler,
        denoise=req.denoise,
        seed=req.seed
    )

    actual_seed = compiled["seed"]
    workflow_dag = compiled["workflow"]

    # 4. Save Task
    db_task = GenerationTask(
        id=task_id,
        status="pending",
        progress=0.0,
        current_step=0,
        total_steps=req.steps,
        output_images="[]"
    )
    session.add(db_task)
    session.commit()

    req_meta = {
        "prompt": processed["positive_prompt"],
        "negative_prompt": processed["negative_prompt"],
        "styles": req.styles,
        "model_name": model_name,
        "sampler": req.sampler,
        "scheduler": req.scheduler,
        "steps": req.steps,
        "cfg_scale": req.cfg_scale,
        "seed": actual_seed,
        "width": img_w,
        "height": img_h,
        "is_inpaint": True,
        "board_id": req.board_id
    }

    async def on_event(event):
        if event.get("type") == "completed":
            _save_task_completion(task_id, event.get("output_images", []), req_meta)

    comfy_client.subscribe(task_id, on_event)
    await comfy_client.queue_prompt(workflow_dag, task_id)

    return {
        "task_id": task_id,
        "seed": actual_seed,
        "processed_prompt": processed
    }


@router.post("/img2img")
async def img2img_image(req: Img2ImgRequest, session: Session = Depends(get_session)):
    '''Edit or restyle an existing image while keeping its composition.'''
    processed = pipeline.process(
        prompt=req.prompt,
        negative_prompt=req.negative_prompt or "",
        styles=req.styles,
        auto_expand=req.auto_expand,
        expansion_level=req.expansion_level
    )

    base_bytes = _decode_b64(req.base_image)
    src_w, src_h = _inspect_image(base_bytes, req.width or 1024, req.height or 1024)
    out_w = _snap8(req.width or src_w)
    out_h = _snap8(req.height or src_h)
    longest = max(out_w, out_h)
    max_side = 1536
    if longest > max_side:
        ratio = max_side / float(longest)
        out_w = _snap8(int(round(out_w * ratio)))
        out_h = _snap8(int(round(out_h * ratio)))

    base_fn = f"img2img_base_{uuid.uuid4().hex[:8]}.png"
    await comfy_client.upload_image(base_bytes, base_fn)

    model_name = req.model_name or "v1-5-pruned-emaonly.safetensors"
    compiled = WorkflowCompiler.compile_img2img(
        prompt=processed["positive_prompt"],
        base_image_name=base_fn,
        negative_prompt=processed["negative_prompt"],
        model_name=model_name,
        steps=req.steps,
        cfg=req.cfg_scale,
        sampler_name=req.sampler,
        scheduler=req.scheduler,
        denoise=req.denoise,
        seed=req.seed,
        target_width=out_w,
        target_height=out_h,
        filename_prefix="Antigravity_I2I"
    )

    req_meta = {
        "prompt": processed["positive_prompt"],
        "negative_prompt": processed["negative_prompt"],
        "styles": req.styles,
        "model_name": model_name,
        "sampler": req.sampler,
        "scheduler": req.scheduler,
        "steps": req.steps,
        "cfg_scale": req.cfg_scale,
        "width": out_w,
        "height": out_h,
        "is_inpaint": False,
        "board_id": req.board_id
    }
    task_id, actual_seed = await _queue_image_task(session, compiled, req_meta, req.steps)
    return {
        "task_id": task_id,
        "seed": actual_seed,
        "processed_prompt": processed
    }


@router.post("/upscale")
async def upscale_image(req: UpscaleRequest, session: Session = Depends(get_session)):
    '''
    2x the current result by scaling the pixels, then lightly sampling so
    details sharpen without inventing a new scene.
    '''
    processed = pipeline.process(
        prompt=req.prompt,
        negative_prompt=req.negative_prompt or "",
        styles=req.styles,
        auto_expand=req.auto_expand,
        expansion_level=req.expansion_level
    )

    base_bytes = _decode_b64(req.base_image)
    src_w, src_h = _inspect_image(base_bytes)

    scale = max(float(req.scale or 2.0), 1.0)
    max_side = max(int(req.max_side or 2048), 64)
    longest = max(src_w, src_h)
    if longest * scale > max_side:
        scale = max_side / float(longest)

    out_w = _snap8(int(round(src_w * scale)))
    out_h = _snap8(int(round(src_h * scale)))
    # Keep upscale denoise low so the sampler cannot wander into a new image.
    denoise = min(max(float(req.denoise), 0.05), 0.45)

    base_fn = f"upscale_base_{uuid.uuid4().hex[:8]}.png"
    await comfy_client.upload_image(base_bytes, base_fn)

    model_name = req.model_name or "v1-5-pruned-emaonly.safetensors"
    compiled = WorkflowCompiler.compile_img2img(
        prompt=processed["positive_prompt"],
        base_image_name=base_fn,
        negative_prompt=processed["negative_prompt"],
        model_name=model_name,
        steps=req.steps,
        cfg=req.cfg_scale,
        sampler_name=req.sampler,
        scheduler=req.scheduler,
        denoise=denoise,
        seed=req.seed,
        target_width=out_w,
        target_height=out_h,
        filename_prefix="Antigravity_Upscale"
    )

    req_meta = {
        "prompt": processed["positive_prompt"],
        "negative_prompt": processed["negative_prompt"],
        "styles": req.styles,
        "model_name": model_name,
        "sampler": req.sampler,
        "scheduler": req.scheduler,
        "steps": req.steps,
        "cfg_scale": req.cfg_scale,
        "width": out_w,
        "height": out_h,
        "is_inpaint": False,
        "board_id": req.board_id
    }
    task_id, actual_seed = await _queue_image_task(session, compiled, req_meta, req.steps)
    return {
        "task_id": task_id,
        "seed": actual_seed,
        "processed_prompt": processed,
        "width": out_w,
        "height": out_h,
        "denoise": denoise
    }


@router.post("/interrupt")
async def interrupt_generation():
    success = await comfy_client.interrupt()
    return {"status": "ok", "interrupted": success}
