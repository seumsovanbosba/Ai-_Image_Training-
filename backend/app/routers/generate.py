from fastapi import APIRouter, Depends, HTTPException
from sqlmodel import Session
from typing import Optional
import uuid
import json
import base64
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
from app.services.model_manager import model_manager
from app.services.comfy_client import comfy_client
from app.config import settings

router = APIRouter(prefix="/api", tags=["generation"])
pipeline = PromptPipeline()


def _decode_b64(data_uri: str) -> bytes:
    if "," in data_uri:
        data_uri = data_uri.split(",", 1)[1]
    return base64.b64decode(data_uri)


def _resolve_image_bytes(image: str) -> bytes:
    if image.startswith("data:") or "," in image:
        return _decode_b64(image)
    raw_name = image.replace("/outputs/", "").strip("\\/")
    raw_path = settings.OUTPUTS_DIR / raw_name
    if raw_path.exists():
        return raw_path.read_bytes()
    return _decode_b64(image)


def _lora_kwargs(lora_name: Optional[str], lora_strength: float) -> dict:
    name = (lora_name or "").strip() or None
    return {"lora_name": name, "lora_strength": lora_strength}


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
    with Session(engine) as session:
        task = session.get(GenerationTask, task_id)
        if task:
            task.status = "failed"
            task.error_message = error_message
            task.updated_at = datetime.now(timezone.utc)
            session.add(task)
            session.commit()


def _save_task_interrupted(task_id: str):
    with Session(engine) as session:
        task = session.get(GenerationTask, task_id)
        if task:
            task.status = "interrupted"
            task.updated_at = datetime.now(timezone.utc)
            session.add(task)
            session.commit()


def clamp_image_for_diffusion(image_bytes: bytes, max_dim: int = 1024) -> tuple:
    '''
    Ensures input image for img2img or inpaint is safely scaled to fit within SDXL bounds.
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

        new_w = max(64, round(target_w / 64) * 64)
        new_h = max(64, round(target_h / 64) * 64)

        if (new_w, new_h) != (orig_w, orig_h):
            pil_img = pil_img.resize((new_w, new_h), Image.Resampling.LANCZOS)

        buf = BytesIO()
        pil_img.save(buf, format="PNG")
        return buf.getvalue(), new_w, new_h


def clamp_mask_to_dimensions(mask_bytes: bytes, target_w: int, target_h: int) -> bytes:
    with Image.open(BytesIO(mask_bytes)) as mask_img:
        if mask_img.size != (target_w, target_h):
            mask_img = mask_img.resize((target_w, target_h), Image.Resampling.NEAREST)
        buf = BytesIO()
        mask_img.save(buf, format="PNG")
        return buf.getvalue()


@router.post("/generate")
async def generate_image(req: GenerateRequest, session: Session = Depends(get_session)):
    task_id = str(uuid.uuid4())

    processed = pipeline.process(
        prompt=req.prompt,
        negative_prompt=req.negative_prompt or "",
        styles=req.styles,
        auto_expand=req.auto_expand,
        expansion_level=req.expansion_level
    )

    model_name = req.model_name or "sd_xl_base_1.0.safetensors"
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
        batch_size=req.batch_size,
        **_lora_kwargs(req.lora_name, req.lora_strength),
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

    async def on_event(event):
        ev_type = event.get("type")
        if ev_type == "completed":
            _save_task_completion(task_id, event.get("output_images", []), req_meta)
        elif ev_type == "failed":
            _save_task_failure(task_id, event.get("error", "Generation failed"))
        elif ev_type == "interrupted":
            _save_task_interrupted(task_id)

    comfy_client.subscribe(task_id, on_event)
    await comfy_client.queue_prompt(workflow_dag, task_id)

    return {
        "task_id": task_id,
        "seed": actual_seed,
        "processed_prompt": processed
    }


@router.post("/inpaint")
async def inpaint_image(req: InpaintRequest, session: Session = Depends(get_session)):
    task_id = str(uuid.uuid4())

    processed = pipeline.process(
        prompt=req.prompt,
        negative_prompt=req.negative_prompt or "",
        styles=req.styles,
        auto_expand=req.auto_expand,
        expansion_level=req.expansion_level
    )

    base_fn = f"inpaint_base_{task_id[:8]}.png"
    mask_fn = f"inpaint_mask_{task_id[:8]}.png"

    raw_base_bytes = _decode_b64(req.base_image)
    raw_mask_bytes = _decode_b64(req.mask_image)

    base_bytes, img_w, img_h = clamp_image_for_diffusion(raw_base_bytes, max_dim=1024)
    mask_bytes = clamp_mask_to_dimensions(raw_mask_bytes, img_w, img_h)

    await comfy_client.upload_image(base_bytes, base_fn)
    await comfy_client.upload_image(mask_bytes, mask_fn)

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
        seed=req.seed,
        **_lora_kwargs(req.lora_name, req.lora_strength),
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


@router.post("/img2img")
async def img2img_image(req: Img2ImgRequest, session: Session = Depends(get_session)):
    task_id = str(uuid.uuid4())

    processed = pipeline.process(
        prompt=req.prompt,
        negative_prompt=req.negative_prompt or "",
        styles=req.styles,
        auto_expand=req.auto_expand,
        expansion_level=req.expansion_level
    )

    img_fn = f"img2img_{task_id[:8]}.png"
    raw_bytes = _resolve_image_bytes(req.image)
    img_bytes, img_w, img_h = clamp_image_for_diffusion(raw_bytes, max_dim=1024)
    await comfy_client.upload_image(img_bytes, img_fn)

    f = max(0.05, min(0.95, req.fidelity))
    denoise = round(1.0 - (f * 0.85), 2)
    denoise = max(0.15, min(0.95, denoise))
    if processed.get("is_text_edit"):
        denoise = min(max(denoise, 0.35), 0.50)

    model_name = req.model_name or "sd_xl_base_1.0.safetensors"
    compiled = WorkflowCompiler.compile_img2img(
        prompt=processed["positive_prompt"],
        base_image_name=img_fn,
        negative_prompt=processed["negative_prompt"],
        model_name=model_name,
        steps=req.steps,
        cfg=req.cfg_scale,
        sampler_name=req.sampler,
        scheduler=req.scheduler,
        denoise=denoise,
        seed=req.seed,
        **_lora_kwargs(req.lora_name, req.lora_strength),
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

    return {
        "task_id": task_id,
        "seed": actual_seed,
        "processed_prompt": processed,
        "denoise": denoise
    }


@router.post("/upscale")
async def upscale_image(req: UpscaleRequest, session: Session = Depends(get_session)):
    task_id = str(uuid.uuid4())

    upscale_model = req.upscale_model_name or model_manager.find_upscale_model()
    if not upscale_model:
        raise HTTPException(
            status_code=400,
            detail=(
                "No upscale model found in models/upscale_models/. "
                "On the GPU PC run: python scripts/download_upscale_model.py "
                "then restart start.bat. Bicubic stretch is disabled on purpose."
            ),
        )

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
        img_bytes = _resolve_image_bytes(req.image)
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
        upscale_model_name=upscale_model,
        target_width=target_w,
        target_height=target_h,
        prompt=prompt,
        negative_prompt=negative_prompt,
        model_name=model_name,
        steps=req.steps,
        cfg=req.cfg_scale,
        sampler_name=sampler,
        scheduler=scheduler,
        denoise=req.denoise,
        seed=seed,
        **_lora_kwargs(req.lora_name, req.lora_strength),
    )

    actual_seed = compiled["seed"]
    workflow_dag = compiled["workflow"]

    db_task = GenerationTask(
        id=task_id,
        status="pending",
        progress=0.0,
        current_step=0,
        total_steps=max(req.steps, 1),
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
        "target_height": target_h,
        "upscale_model": upscale_model,
        "denoise": req.denoise,
    }


@router.post("/interrupt")
async def interrupt_generation():
    success = await comfy_client.interrupt()
    return {"status": "ok", "interrupted": success}
