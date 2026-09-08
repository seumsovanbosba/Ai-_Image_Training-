import asyncio
import aiohttp
import websockets
import json
import time

async def test_live_sdxl_inference():
    async with aiohttp.ClientSession() as session:
        payload = {
            "prompt": "a cute robotic cat sitting on a futuristic neon desk, sharp focus",
            "styles": ["Photographic"],
            "auto_expand": True,
            "model_name": "sd_xl_base_1.0.safetensors",
            "width": 1024,
            "height": 1024,
            "steps": 15,
            "cfg_scale": 7.0,
            "seed": 999
        }
        print("[INFO] Submitting SDXL generation request to FastAPI orchestrator...")
        async with session.post("http://127.0.0.1:8000/api/generate", json=payload) as resp:
            data = await resp.json()
            task_id = data["task_id"]
            seed = data["seed"]
            print(f"[INFO] Task Queued: {task_id} (Seed: {seed})")

        ws_url = f"ws://127.0.0.1:8000/api/progress/{task_id}"
        print(f"[INFO] Connecting to WebSocket: {ws_url}")
        async with websockets.connect(ws_url) as ws:
            start_t = time.time()
            while True:
                msg = await ws.recv()
                evt = json.loads(msg)
                evt_type = evt.get("type")
                if evt_type == "progress":
                    step = evt.get("current_step")
                    total = evt.get("total_steps")
                    pct = evt.get("progress")
                    print(f"   [SDXL GPU INFERENCE] Step {step}/{total} ({pct}%)", flush=True)
                elif evt_type == "completed":
                    duration = time.time() - start_t
                    print(f"\n[SUCCESS] SDXL Generation Finished in {duration:.1f}s!")
                    print(f"          Output images: {evt.get('output_images')}")
                    break

if __name__ == "__main__":
    asyncio.run(test_live_sdxl_inference())
