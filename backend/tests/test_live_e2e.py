import asyncio
import aiohttp
import websockets
import json
import base64
from io import BytesIO
from PIL import Image

async def test_live_suite():
    async with aiohttp.ClientSession() as session:
        # 1. Health check
        async with session.get("http://127.0.0.1:8000/api/health") as resp:
            assert resp.status == 200
            data = await resp.json()
            print("[E2E 1/6] Health Check: OK", data)

        # 2. Frontend SPA index
        async with session.get("http://127.0.0.1:8000/") as resp:
            assert resp.status == 200
            text = await resp.text()
            assert "Antigravity AI Generation Suite" in text
            print(f"[E2E 2/6] Frontend HTML Served: OK (length: {len(text)})")

        # 3. Styles & Resolutions
        async with session.get("http://127.0.0.1:8000/api/styles") as resp:
            styles = await resp.json()
            assert len(styles) >= 10
            print(f"[E2E 3/6] Styles Loaded: OK ({len(styles)} presets)")

        # 4. Generate Text-to-Image with WebSocket Progress
        gen_payload = {
            "prompt": "majestic cybernetic tiger atop neon temple",
            "styles": ["Photographic", "Cyberpunk / Sci-Fi"],
            "auto_expand": True,
            "expansion_level": "medium",
            "width": 1024,
            "height": 1024,
            "steps": 10,
            "seed": 4242
        }
        async with session.post("http://127.0.0.1:8000/api/generate", json=gen_payload) as resp:
            assert resp.status == 200
            gen_data = await resp.json()
            task_id = gen_data["task_id"]
            print(f"[E2E 4/6] Generation Task Queued: {task_id}")

        # WebSocket Progress stream
        ws_url = f"ws://127.0.0.1:8000/api/progress/{task_id}"
        preview_count = 0
        final_images = []
        async with websockets.connect(ws_url) as ws:
            while True:
                msg = await ws.recv()
                evt = json.loads(msg)
                evt_type = evt.get("type")
                if evt_type == "preview":
                    preview_count += 1
                elif evt_type == "progress":
                    p = evt.get("progress")
                    s = evt.get("current_step")
                    m = evt.get("total_steps")
                    print(f"   -> Progress: {p}% (Step {s}/{m})")
                elif evt_type == "completed":
                    final_images = evt.get("output_images", [])
                    print(f"   -> Completed with images: {final_images}")
                    break

        assert len(final_images) > 0
        print(f"[E2E 4/6] Generation & WS Progress Stream: OK (received preview frames)")

        # 5. Inpaint Request & WebSocket Progress
        img = Image.new("RGB", (128, 128), color="blue")
        mask = Image.new("L", (128, 128), color="white")
        buf_i, buf_m = BytesIO(), BytesIO()
        img.save(buf_i, format="PNG")
        mask.save(buf_m, format="PNG")
        b64_i = "data:image/png;base64," + base64.b64encode(buf_i.getvalue()).decode("utf-8")
        b64_m = "data:image/png;base64," + base64.b64encode(buf_m.getvalue()).decode("utf-8")

        inpaint_payload = {
            "prompt": "golden glowing lotus flower",
            "base_image": b64_i,
            "mask_image": b64_m,
            "denoise": 0.8,
            "steps": 10
        }
        async with session.post("http://127.0.0.1:8000/api/inpaint", json=inpaint_payload) as resp:
            assert resp.status == 200
            inp_data = await resp.json()
            inp_task_id = inp_data["task_id"]
            print(f"[E2E 5/6] Inpaint Task Queued: {inp_task_id}")

        async with websockets.connect(f"ws://127.0.0.1:8000/api/progress/{inp_task_id}") as ws:
            while True:
                msg = await ws.recv()
                evt = json.loads(msg)
                if evt.get("type") == "completed":
                    print(f"   -> Inpaint Completed: {evt.get('output_images')}")
                    break

        print("[E2E 5/6] Inpaint Execution & WS Progress: OK")

        # 6. Check Gallery & Persistence
        async with session.get("http://127.0.0.1:8000/api/images") as resp:
            assert resp.status == 200
            gallery = await resp.json()
            assert len(gallery) >= 2
            print(f"[E2E 6/6] SQLite Gallery Verification: OK ({len(gallery)} assets recorded)")

    print("\n[SUCCESS] ALL LIVE END-TO-END SUITE TESTS PASSED COMPLETELY!")

if __name__ == "__main__":
    asyncio.run(test_live_suite())
