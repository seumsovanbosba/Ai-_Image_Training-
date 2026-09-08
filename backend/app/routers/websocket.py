from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio
import json
import logging
from app.services.comfy_client import comfy_client
from app.database import engine
from sqlmodel import Session
from app.models.generation import GenerationTask

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api", tags=["websocket"])

@router.websocket("/progress/{task_id}")
async def websocket_progress_endpoint(websocket: WebSocket, task_id: str):
    await websocket.accept()
    logger.info(f"WebSocket client connected for task: {task_id}")

    queue = asyncio.Queue()

    async def event_handler(event_data: dict):
        await queue.put(event_data)

    comfy_client.subscribe(task_id, event_handler)

    try:
        # Check initial DB state
        with Session(engine) as session:
            task = session.get(GenerationTask, task_id)
            if task and task.status == "completed":
                outputs = json.loads(task.output_images or "[]")
                await websocket.send_json({
                    "type": "completed",
                    "status": "completed",
                    "progress": 100.0,
                    "output_images": outputs
                })
                return

        while True:
            # Wait for event from client or timeout to keepalive
            try:
                event = await asyncio.wait_for(queue.get(), timeout=1.0)
                await websocket.send_json(event)
                if event.get("type") in ["completed", "failed", "interrupted"]:
                    # Wait briefly before closing connection
                    await asyncio.sleep(0.5)
                    break
            except asyncio.TimeoutError:
                # Keepalive ping
                await websocket.send_json({"type": "ping"})
    except WebSocketDisconnect:
        logger.info(f"WebSocket client disconnected for task: {task_id}")
    except Exception as e:
        logger.error(f"WebSocket error for task {task_id}: {e}")
    finally:
        comfy_client.unsubscribe(task_id, event_handler)
        try:
            await websocket.close()
        except Exception:
            pass
