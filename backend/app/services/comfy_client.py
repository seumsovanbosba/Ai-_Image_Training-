import asyncio
import json
import logging
import uuid
import aiohttp
import websockets
from pathlib import Path
from typing import Dict, Any, Optional, Callable, List
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont
import base64
import time

from app.config import settings
from app.services.workflow_compiler import WorkflowCompiler

logger = logging.getLogger(__name__)

class ComfyUIClient:
    def __init__(self, host: str = None, port: int = None):
        self.host = host or settings.COMFY_HOST
        self.port = port or settings.COMFY_PORT
        self.base_url = f"http://{self.host}:{self.port}"
        self.ws_url = f"ws://{self.host}:{self.port}/ws"
        self.client_id = str(uuid.uuid4())
        self.active_tasks: Dict[str, Dict[str, Any]] = {}
        self.subscribers: Dict[str, List[Callable]] = {}
        self._ws_task: Optional[asyncio.Task] = None
        self._is_running = False

    async def is_comfy_running(self) -> bool:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.base_url}/system_stats", timeout=aiohttp.ClientTimeout(total=2)) as resp:
                    return resp.status == 200
        except Exception:
            return False

    async def get_system_stats(self) -> Dict[str, Any]:
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.base_url}/system_stats", timeout=aiohttp.ClientTimeout(total=3)) as resp:
                    if resp.status == 200:
                        return await resp.json()
        except Exception as e:
            logger.debug(f"ComfyUI not reachable: {e}")
        return {"status": "offline", "devices": []}

    async def get_available_models(self) -> List[str]:
        '''
        Queries ComfyUI for loaded/available checkpoints.
        '''
        try:
            async with aiohttp.ClientSession() as session:
                async with session.get(f"{self.base_url}/object_info/CheckpointLoaderSimple", timeout=aiohttp.ClientTimeout(total=3)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        ckpts = data.get("CheckpointLoaderSimple", {}).get("input", {}).get("required", {}).get("ckpt_name", [[]])[0]
                        if isinstance(ckpts, list):
                            return ckpts
        except Exception as e:
            logger.debug(f"Failed to query ComfyUI models via API: {e}")
        return []

    async def upload_image(self, image_bytes: bytes, filename: str, subfolder: str = "", overwrite: bool = True) -> Dict[str, Any]:
        '''
        Uploads an image or mask to ComfyUI's input directory.
        '''
        data = aiohttp.FormData()
        data.add_field('image', image_bytes, filename=filename, content_type='image/png')
        data.add_field('overwrite', 'true' if overwrite else 'false')
        if subfolder:
            data.add_field('subfolder', subfolder)

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(f"{self.base_url}/upload/image", data=data, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                    if resp.status == 200:
                        return await resp.json()
                    else:
                        text = await resp.text()
                        raise RuntimeError(f"Failed to upload image to ComfyUI: {resp.status} - {text}")
        except aiohttp.ClientError as e:
            # Fallback: save locally in outputs/inputs if ComfyUI is offline
            save_path = settings.OUTPUTS_DIR / filename
            with open(save_path, "wb") as f:
                f.write(image_bytes)
            return {"name": filename, "subfolder": subfolder, "type": "input"}

    async def queue_prompt(self, workflow_dag: Dict[str, Any], task_id: str) -> str:
        '''
        Submits DAG workflow to ComfyUI /prompt.
        '''
        payload = {
            "prompt": workflow_dag,
            "client_id": self.client_id,
            "extra_data": {"task_id": task_id}
        }
        
        is_up = await self.is_comfy_running()
        if is_up:
            async with aiohttp.ClientSession() as session:
                async with session.post(f"{self.base_url}/prompt", json=payload, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status == 200:
                        data = await resp.json()
                        prompt_id = data.get("prompt_id", task_id)
                        self.active_tasks[prompt_id] = {"task_id": task_id, "status": "queued"}
                        return prompt_id
                    else:
                        err = await resp.text()
                        raise RuntimeError(f"ComfyUI prompt error {resp.status}: {err}")
        else:
            # If ComfyUI is installed, raise error so user is alerted rather than misled by synthetic mock graphic
            comfy_main = settings.BASE_DIR / "comfy_engine" / "ComfyUI" / "main.py"
            if comfy_main.exists():
                logger.error(f"ComfyUI engine is offline or still starting up at {self.base_url}. Task {task_id} aborted.")
                raise RuntimeError("ComfyUI engine is offline or still starting up. Please wait for the engine to finish loading on port 8188.")
            else:
                # Fallback mock simulator mode only when ComfyUI is not installed at all
                logger.info(f"ComfyUI not installed; running task {task_id} in offline simulation mode.")
                asyncio.create_task(self._simulate_generation(task_id, workflow_dag))
                return task_id

    async def interrupt(self) -> bool:
        '''
        Interrupts running execution on ComfyUI.
        '''
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(f"{self.base_url}/interrupt", timeout=aiohttp.ClientTimeout(total=5)) as resp:
                    return resp.status == 200
        except Exception:
            return False

    async def fetch_image(self, filename: str, subfolder: str = "", folder_type: str = "output") -> bytes:
        params = {"filename": filename, "subfolder": subfolder, "type": folder_type}
        async with aiohttp.ClientSession() as session:
            async with session.get(f"{self.base_url}/view", params=params, timeout=aiohttp.ClientTimeout(total=30)) as resp:
                if resp.status == 200:
                    return await resp.read()
                raise RuntimeError(f"Failed to fetch image {filename}: status {resp.status}")

    def subscribe(self, task_id: str, callback: Callable):
        if task_id not in self.subscribers:
            self.subscribers[task_id] = []
        self.subscribers[task_id].append(callback)

    def unsubscribe(self, task_id: str, callback: Callable):
        if task_id in self.subscribers and callback in self.subscribers[task_id]:
            self.subscribers[task_id].remove(callback)

    async def _notify(self, task_id: str, event_data: Dict[str, Any]):
        subscribers = self.subscribers.get(task_id, [])
        for cb in subscribers:
            try:
                if asyncio.iscoroutinefunction(cb):
                    await cb(event_data)
                else:
                    cb(event_data)
            except Exception as e:
                logger.error(f"Error in subscriber callback: {e}")

    async def start_ws_listener(self):
        '''
        Connects to ComfyUI's WebSocket to receive execution progress, errors, and previews.
        '''
        self._is_running = True
        while self._is_running:
            try:
                ws_url = f"{self.ws_url}?clientId={self.client_id}"
                async with websockets.connect(ws_url, max_size=100 * 1024 * 1024) as ws:
                    logger.info(f"Connected to ComfyUI WebSocket at {ws_url}")
                    while self._is_running:
                        msg = await ws.recv()
                        if isinstance(msg, str):
                            data = json.loads(msg)
                            msg_type = data.get("type")
                            msg_data = data.get("data", {})
                            
                            if msg_type == "status":
                                pass
                            elif msg_type == "execution_start":
                                prompt_id = msg_data.get("prompt_id")
                                task_info = self.active_tasks.get(prompt_id)
                                if task_info:
                                    await self._notify(task_info["task_id"], {
                                        "type": "start",
                                        "status": "running",
                                        "progress": 0.0
                                    })
                            elif msg_type == "progress":
                                value = msg_data.get("value", 0)
                                max_val = msg_data.get("max", 1)
                                prompt_id = msg_data.get("prompt_id")
                                progress_pct = round((value / max_val) * 100, 1)
                                task_info = self.active_tasks.get(prompt_id)
                                if task_info:
                                    await self._notify(task_info["task_id"], {
                                        "type": "progress",
                                        "status": "running",
                                        "current_step": value,
                                        "total_steps": max_val,
                                        "progress": progress_pct
                                    })
                            elif msg_type == "executed":
                                prompt_id = msg_data.get("prompt_id")
                                output_data = msg_data.get("output", {})
                                images_info = output_data.get("images", [])
                                task_info = self.active_tasks.get(prompt_id)
                                if task_info and images_info:
                                    saved_filenames = []
                                    for img_meta in images_info:
                                        fn = img_meta.get("filename")
                                        sub = img_meta.get("subfolder", "")
                                        ftype = img_meta.get("type", "output")
                                        img_bytes = await self.fetch_image(fn, sub, ftype)
                                        target_file = settings.OUTPUTS_DIR / fn
                                        with open(target_file, "wb") as f:
                                            f.write(img_bytes)
                                        saved_filenames.append(fn)

                                    await self._notify(task_info["task_id"], {
                                        "type": "completed",
                                        "status": "completed",
                                        "progress": 100.0,
                                        "output_images": saved_filenames
                                    })
                                    del self.active_tasks[prompt_id]
                            elif msg_type == "execution_error":
                                prompt_id = msg_data.get("prompt_id")
                                exception_message = msg_data.get("exception_message", "Unknown execution error")
                                node_type = msg_data.get("node_type", "ComfyNode")
                                err_msg = f"{node_type} error: {exception_message}"
                                logger.error(f"ComfyUI execution error for prompt {prompt_id}: {err_msg}")
                                task_info = self.active_tasks.get(prompt_id)
                                if task_info:
                                    await self._notify(task_info["task_id"], {
                                        "type": "failed",
                                        "status": "failed",
                                        "error": err_msg
                                    })
                                    del self.active_tasks[prompt_id]
                            elif msg_type == "execution_interrupted":
                                prompt_id = msg_data.get("prompt_id")
                                logger.info(f"ComfyUI execution interrupted for prompt {prompt_id}")
                                task_info = self.active_tasks.get(prompt_id)
                                if task_info:
                                    await self._notify(task_info["task_id"], {
                                        "type": "interrupted",
                                        "status": "interrupted"
                                    })
                                    del self.active_tasks[prompt_id]
                        elif isinstance(msg, bytes):
                            # Binary latent preview: 8-byte header followed by JPEG/PNG bytes
                            if len(msg) > 8:
                                preview_bytes = msg[8:]
                                b64_img = base64.b64encode(preview_bytes).decode('utf-8')
                                # Broadcast preview to active tasks
                                for prompt_id, task_info in self.active_tasks.items():
                                    await self._notify(task_info["task_id"], {
                                        "type": "preview",
                                        "preview_base64": f"data:image/jpeg;base64,{b64_img}"
                                    })
            except Exception as e:
                logger.debug(f"ComfyUI WS reconnecting in 3s... ({e})")
                # Fail any pending active tasks so frontend doesn't hang indefinitely
                for prompt_id, task_info in list(self.active_tasks.items()):
                    await self._notify(task_info["task_id"], {
                        "type": "failed",
                        "status": "failed",
                        "error": f"ComfyUI engine disconnected: {e}"
                    })
                    del self.active_tasks[prompt_id]
                await asyncio.sleep(3)

    async def _simulate_generation(self, task_id: str, workflow_dag: Dict[str, Any]):
        '''
        Offline high-fidelity generation simulator when ComfyUI process is starting up or in dry-run mode.
        Allows immediate testing of UI, WebSockets, canvas inpainting, and database pipelines.
        '''
        await asyncio.sleep(0.5)
        steps = 20
        # Determine prompt and dimensions from workflow DAG
        prompt_text = "Generated Image"
        width, height = 1024, 1024
        for k, v in workflow_dag.items():
            if v.get("class_type") == "CLIPTextEncode" and k == "2":
                prompt_text = v.get("inputs", {}).get("text", prompt_text)
            if v.get("class_type") == "EmptyLatentImage":
                width = v.get("inputs", {}).get("width", 1024)
                height = v.get("inputs", {}).get("height", 1024)

        for step in range(1, steps + 1):
            await asyncio.sleep(0.15)
            progress = round((step / steps) * 100, 1)
            
            # Generate preview frame
            img = Image.new("RGB", (min(width, 512), min(height, 512)), color=(20 + step * 2, 25 + step * 3, 40 + step * 4))
            draw = ImageDraw.Draw(img)
            draw.text((20, 20), f"Antigravity Offline Suite", fill=(200, 220, 255))
            draw.text((20, 50), f"Step {step}/{steps} ({progress}%)", fill=(180, 255, 180))
            draw.text((20, 80), f"Prompt: {prompt_text[:40]}...", fill=(220, 220, 220))
            draw.rectangle([20, 120, int(20 + (progress / 100) * 200), 130], fill=(99, 102, 241))
            
            buffered = BytesIO()
            img.save(buffered, format="JPEG", quality=65)
            b64_img = base64.b64encode(buffered.getvalue()).decode('utf-8')

            await self._notify(task_id, {
                "type": "progress",
                "status": "running",
                "current_step": step,
                "total_steps": steps,
                "progress": progress,
                "preview_base64": f"data:image/jpeg;base64,{b64_img}"
            })

        # Generate final crisp output image
        final_img = Image.new("RGB", (width, height), color=(15, 23, 42))
        draw = ImageDraw.Draw(final_img)
        # Decorative gradient-like grid
        for i in range(0, width, 64):
            draw.line([(i, 0), (i, height)], fill=(30, 41, 59), width=1)
        for j in range(0, height, 64):
            draw.line([(0, j), (width, j)], fill=(30, 41, 59), width=1)

        draw.rounded_rectangle([40, 40, width - 40, height - 40], radius=16, outline=(99, 102, 241), width=3)
        draw.text((60, 60), "Antigravity AI Generation Suite (Offline Engine)", fill=(248, 250, 252))
        draw.text((60, 100), f"Resolution: {width}x{height}", fill=(148, 163, 184))
        draw.text((60, 130), f"Prompt: {prompt_text[:80]}", fill=(226, 232, 240))
        draw.text((60, 160), f"Timestamp: {time.strftime('%Y-%m-%d %H:%M:%S')}", fill=(148, 163, 184))
        draw.text((60, 200), "Status: 100% Offline Generation Complete", fill=(74, 222, 128))

        filename = f"antigravity_{task_id[:8]}_{int(time.time())}.png"
        filepath = settings.OUTPUTS_DIR / filename
        final_img.save(filepath, format="PNG")

        await self._notify(task_id, {
            "type": "completed",
            "status": "completed",
            "progress": 100.0,
            "output_images": [filename]
        })

comfy_client = ComfyUIClient()
