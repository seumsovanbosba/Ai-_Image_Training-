from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlmodel import Session, select
from typing import Dict, Any
import uuid
import json
import base64
import time
from datetime import datetime, timezone
from io import BytesIO
import random
from pathlib import Path
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
            task.updated_at = datetime.now(timezone.utc)
            session.add(task)
            
            for img_name in output_images:
                img_path = str(settings.OUTPUTS_DIR / img_name)
                out_w = req_meta.get("width", 1024)
                out_h = req_meta.get("height", 1024)
                try:
                    with Image.open(img_path) as p_img:
                        out_w, out_h = p_img.size
                except Exception:
                    pass
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
                    width=out_w,
                    height=out_h,
                    is_inpaint=req_meta.get("is_inpaint", False),
                    is_img2img=req_meta.get("is_img2img", False),
                    is_upscale=req_meta.get("is_upscale", False),
                    board_id=req_meta.get("board_id")
                )
                session.add(asset)
            session.commit()

def _save_task_failure(task_id: str, error_message: str):
    '''Callback when generation fails to update task state in database.'''
    with Session(engine) as session:
        task = session.get(GenerationTask, task_id)
        if task:
            task.status = "failed"
            task.error_message = error_message
            task.updated_at = datetime.now(timezone.utc)
            session.add(task)
            session.commit()

def _save_task_interrupted(task_id: str):
    '''Callback when generation is cancelled/interrupted.'''
    with Session(engine) as session:
        task = session.get(GenerationTask, task_id)
        if task:
            task.status = "interrupted"
            task.updated_at = datetime.now(timezone.utc)
            session.add(task)
            session.commit()

def clamp_image_for_diffusion(image_bytes: bytes, max_dim: int = 1024) -> tuple[bytes, int, int]:
    '''
    Ensures input image for img2img or inpaint is safely scaled to fit within SDXL bounds.
    - Preserves aspect ratio.
    - Restricts maximum dimension to max_dim (default 1024).
    - Snaps width and height to multiples of 64 for optimal VAE encoding without artifacts or OOM.
    - Converts alpha/palette to RGB.
    Returns: (processed_bytes, width, height)
    '''
    with Image.open(BytesIO(image_bytes)) as pil_img:
        if pil_img.mode in ("RGBA", "P"):
            rgb_img = Image.new("RGB", pil_img.size, (255, 255, 255))
            if pil_img.mode == "RGBA":
                rgb_img.paste(pil_img, mask=pil_img.split()[3])
            else:
                rgb_img.paste(pil_img)
            pil_img = rgb_img
        elif pil_img.mode != "RGB":
            pil_img = pil_img.convert("RGB")

        orig_w, orig_h = pil_img.size
        longest_edge = max(orig_w, orig_h)
        if longest_edge > max_dim:
            scale = max_dim / longest_edge
            target_w = int(orig_w * scale)
            target_h = int(orig_h * scale)
        else:
            target_w = orig_w
            target_h = orig_h

        # Snap to multiples of 64 (minimum 64)
        new_w = max(64, round(target_w / 64) * 64)
        new_h = max(64, round(target_h / 64) * 64)

        if (new_w, new_h) != (orig_w, orig_h):
            pil_img = pil_img.resize((new_w, new_h), Image.Resampling.LANCZOS)

        buf = BytesIO()
        pil_img.save(buf, format="PNG")
        return buf.getvalue(), new_w, new_h

def clamp_mask_to_dimensions(mask_bytes: bytes, target_w: int, target_h: int) -> bytes:
    '''
    Resizes mask image to match the exact dimensions of base image.
    Uses NEAREST resampling to keep crisp binary edges.
    '''
    with Image.open(BytesIO(mask_bytes)) as mask_img:
        if mask_img.size != (target_w, target_h):
            mask_img = mask_img.resize((target_w, target_h), Image.Resampling.NEAREST)
        buf = BytesIO()
        mask_img.save(buf, format="PNG")
        return buf.getvalue()


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
    model_name = req.model_name or "sd_xl_base_1.0.safetensors"

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
        "prompt": req.prompt.strip(),
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

    # 6. Subscribe internal database persister to completion/error events
    async def on_event(event):
        ev_type = event.get("type")
        if ev_type == "completed":
            _save_task_completion(task_id, event.get("output_images", []), req_meta)
        elif ev_type == "failed":
            _save_task_failure(task_id, event.get("error", "Generation failed"))
        elif ev_type == "interrupted":
            _save_task_interrupted(task_id)

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
        auto_expand=req.auto_expand,
        expansion_level=req.expansion_level
    )

    # 2. Decode base & mask images and upload to ComfyUI
    base_fn = f"inpaint_base_{task_id[:8]}.png"
    mask_fn = f"inpaint_mask_{task_id[:8]}.png"

<<<<<<< HEAD
    base_bytes = _decode_b64(req.base_image)
    mask_bytes = _decode_b64(req.mask_image)
=======
    def decode_b64(data_uri: str) -> bytes:
        if "," in data_uri:
            data_uri = data_uri.split(",", 1)[1]
        return base64.b64decode(data_uri)

    raw_base_bytes = decode_b64(req.base_image)
    raw_mask_bytes = decode_b64(req.mask_image)
>>>>>>> refs/remotes/origin/main

    # Safely clamp base and mask images to SDXL bounds (max 1024) to prevent VAE OOM
    base_bytes, img_w, img_h = clamp_image_for_diffusion(raw_base_bytes, max_dim=1024)
    mask_bytes = clamp_mask_to_dimensions(raw_mask_bytes, img_w, img_h)

    await comfy_client.upload_image(base_bytes, base_fn)
    await comfy_client.upload_image(mask_bytes, mask_fn)

    # 3. Model & DAG compilation
    model_name = req.model_name or "sd_xl_base_1.0.safetensors"
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
        "prompt": req.prompt.strip(),
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
        ev_type = event.get("type")
        if ev_type == "completed":
            _save_task_completion(task_id, event.get("output_images", []), req_meta)
        elif ev_type == "failed":
            _save_task_failure(task_id, event.get("error", "Inpainting failed"))
        elif ev_type == "interrupted":
            _save_task_interrupted(task_id)

    comfy_client.subscribe(task_id, on_event)
    await comfy_client.queue_prompt(workflow_dag, task_id)

    return {
        "task_id": task_id,
        "seed": actual_seed,
        "processed_prompt": processed
    }

<<<<<<< HEAD

@router.post("/img2img")
async def img2img_image(req: Img2ImgRequest, session: Session = Depends(get_session)):
    '''Edit or restyle an existing image while keeping its composition.'''
=======
@router.post("/img2img")
async def img2img_image(req: Img2ImgRequest, session: Session = Depends(get_session)):
    task_id = str(uuid.uuid4())

    # 1. Process prompt with Fooocus styles
>>>>>>> refs/remotes/origin/main
    processed = pipeline.process(
        prompt=req.prompt,
        negative_prompt=req.negative_prompt or "",
        styles=req.styles,
        auto_expand=req.auto_expand,
        expansion_level=req.expansion_level
    )

<<<<<<< HEAD
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
=======
    # 2. Decode source image
    img_fn = f"img2img_{task_id[:8]}.png"

    def decode_b64(data_uri: str) -> bytes:
        if "," in data_uri:
            data_uri = data_uri.split(",", 1)[1]
        return base64.b64decode(data_uri)

    if req.image.startswith("data:") or "," in req.image:
        raw_bytes = decode_b64(req.image)
    else:
        raw_name = req.image.replace("/outputs/", "").strip("\\/")
        raw_path = settings.OUTPUTS_DIR / raw_name
        if raw_path.exists():
            raw_bytes = raw_path.read_bytes()
        else:
            raw_bytes = decode_b64(req.image)

    # Safely clamp reference image to SDXL bounds (max 1024) to prevent VAE OOM and extreme slowdown
    img_bytes, img_w, img_h = clamp_image_for_diffusion(raw_bytes, max_dim=1024)

    await comfy_client.upload_image(img_bytes, img_fn)

    # Map fidelity (0.1 to 0.9) to denoise (e.g. 0.8 fidelity -> 0.25 denoise; 0.5 fidelity -> 0.55 denoise; 0.2 fidelity -> 0.80 denoise)
    f = max(0.05, min(0.95, req.fidelity))
    denoise = round(1.0 - (f * 0.85), 2)
    denoise = max(0.15, min(0.95, denoise))

    model_name = req.model_name or "sd_xl_base_1.0.safetensors"
    compiled = WorkflowCompiler.compile_img2img(
        prompt=processed["positive_prompt"],
        base_image_name=img_fn,
>>>>>>> refs/remotes/origin/main
        negative_prompt=processed["negative_prompt"],
        model_name=model_name,
        steps=req.steps,
        cfg=req.cfg_scale,
        sampler_name=req.sampler,
        scheduler=req.scheduler,
        denoise=denoise,
<<<<<<< HEAD
        seed=req.seed,
        target_width=out_w,
        target_height=out_h,
        filename_prefix="Antigravity_Upscale"
    )

    req_meta = {
        "prompt": processed["positive_prompt"],
=======
        seed=req.seed
    )

    actual_seed = compiled["seed"]
    workflow_dag = compiled["workflow"]

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
        "prompt": req.prompt.strip(),
>>>>>>> refs/remotes/origin/main
        "negative_prompt": processed["negative_prompt"],
        "styles": req.styles,
        "model_name": model_name,
        "sampler": req.sampler,
        "scheduler": req.scheduler,
        "steps": req.steps,
        "cfg_scale": req.cfg_scale,
<<<<<<< HEAD
        "width": out_w,
        "height": out_h,
        "is_inpaint": False,
        "board_id": req.board_id
    }
    task_id, actual_seed = await _queue_image_task(session, compiled, req_meta, req.steps)
=======
        "seed": actual_seed,
        "width": img_w,
        "height": img_h,
        "is_inpaint": False,
        "is_img2img": True,
        "is_upscale": False,
        "board_id": req.board_id
    }

    async def on_event(event):
        ev_type = event.get("type")
        if ev_type == "completed":
            _save_task_completion(task_id, event.get("output_images", []), req_meta)
        elif ev_type == "failed":
            _save_task_failure(task_id, event.get("error", "Img2Img failed"))
        elif ev_type == "interrupted":
            _save_task_interrupted(task_id)

    comfy_client.subscribe(task_id, on_event)
    await comfy_client.queue_prompt(workflow_dag, task_id)

>>>>>>> refs/remotes/origin/main
    return {
        "task_id": task_id,
        "seed": actual_seed,
        "processed_prompt": processed,
<<<<<<< HEAD
        "width": out_w,
        "height": out_h,
        "denoise": denoise
    }

=======
        "denoise": denoise
    }

@router.post("/upscale")
async def upscale_image(req: UpscaleRequest, session: Session = Depends(get_session)):
    task_id = str(uuid.uuid4())

    # 1. Resolve source image from database ID or raw input
    source_asset = None
    if req.image_id:
        source_asset = session.get(ImageAsset, req.image_id)
        if not source_asset:
            raise HTTPException(status_code=404, detail="Source image asset not found")
        img_path = Path(source_asset.filepath)
        if not img_path.exists():
            img_path = settings.OUTPUTS_DIR / source_asset.filename
        if not img_path.exists():
            raise HTTPException(status_code=404, detail=f"Image file {source_asset.filename} not found on disk")
        img_bytes = img_path.read_bytes()
        prompt = req.prompt or source_asset.prompt
        negative_prompt = req.negative_prompt or source_asset.negative_prompt or ""
        model_name = req.model_name or source_asset.model_name
        seed = req.seed if (req.seed is not None and req.seed >= 0) else source_asset.seed
        board_id = source_asset.board_id
        sampler = req.sampler or source_asset.sampler
        scheduler = req.scheduler or source_asset.scheduler
    elif req.image:
        def decode_b64(data_uri: str) -> bytes:
            if "," in data_uri:
                data_uri = data_uri.split(",", 1)[1]
            return base64.b64decode(data_uri)
        if req.image.startswith("data:") or "," in req.image:
            img_bytes = decode_b64(req.image)
        else:
            raw_name = req.image.replace("/outputs/", "").strip("\\/")
            img_path = settings.OUTPUTS_DIR / raw_name
            if img_path.exists():
                img_bytes = img_path.read_bytes()
            else:
                img_bytes = decode_b64(req.image)
        prompt = req.prompt or ""
        negative_prompt = req.negative_prompt or ""
        model_name = req.model_name or "sd_xl_base_1.0.safetensors"
        seed = req.seed if (req.seed is not None and req.seed >= 0) else random.randint(1, 2**32 - 1)
        board_id = None
        sampler = req.sampler or "dpmpp_2m"
        scheduler = req.scheduler or "karras"
    else:
        raise HTTPException(status_code=400, detail="Must provide either image_id or image data")

    upscale_fn = f"upscale_source_{task_id[:8]}.png"
    await comfy_client.upload_image(img_bytes, upscale_fn)

    try:
        with Image.open(BytesIO(img_bytes)) as pil_img:
            src_w, src_h = pil_img.size
    except Exception:
        src_w, src_h = 1024, 1024

    target_w = int(src_w * req.scale_factor)
    target_h = int(src_h * req.scale_factor)

    compiled = WorkflowCompiler.compile_upscale(
        base_image_name=upscale_fn,
        prompt=prompt,
        negative_prompt=negative_prompt,
        model_name=model_name,
        scale_by=req.scale_factor,
        upscale_method="bicubic",
        steps=req.steps,
        cfg=req.cfg_scale,
        sampler_name=sampler,
        scheduler=scheduler,
        denoise=req.denoise,
        seed=seed
    )

    actual_seed = compiled["seed"]
    workflow_dag = compiled["workflow"]

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

    clean_prompt = prompt.replace("[Upscaled 2x] ", "")
    req_meta = {
        "prompt": f"[Upscaled {int(req.scale_factor)}x] {clean_prompt}".strip(),
        "negative_prompt": negative_prompt,
        "styles": [],
        "model_name": model_name,
        "sampler": sampler,
        "scheduler": scheduler,
        "steps": req.steps,
        "cfg_scale": req.cfg_scale,
        "seed": actual_seed,
        "width": target_w,
        "height": target_h,
        "is_inpaint": False,
        "is_img2img": False,
        "is_upscale": True,
        "board_id": board_id
    }

    async def on_event(event):
        ev_type = event.get("type")
        if ev_type == "completed":
            _save_task_completion(task_id, event.get("output_images", []), req_meta)
        elif ev_type == "failed":
            _save_task_failure(task_id, event.get("error", "Upscaling failed"))
        elif ev_type == "interrupted":
            _save_task_interrupted(task_id)

    comfy_client.subscribe(task_id, on_event)
    await comfy_client.queue_prompt(workflow_dag, task_id)

    return {
        "task_id": task_id,
        "seed": actual_seed,
        "target_width": target_w,
        "target_height": target_h
    }
>>>>>>> refs/remotes/origin/main

@router.post("/interrupt")
async def interrupt_generation():
    success = await comfy_client.interrupt()
    return {"status": "ok", "interrupted": success}
