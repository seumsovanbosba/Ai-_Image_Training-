import asyncio
import aiohttp
import websockets
import json
import time
from pathlib import Path

async def run_verification():
    async with aiohttp.ClientSession() as session:
        print("=" * 60)
        print("STAGE 1: Verify API availability and fetch source image")
        print("=" * 60)

        # 1. Fetch images from API
        async with session.get("http://127.0.0.1:8000/api/images") as resp:
            images = await resp.json()
            print(f"[INFO] Found {len(images)} existing image assets in database.")

        source_img = None
        if images:
            for img in images:
                if not img.get("is_upscale"):
                    source_img = img
                    break
            if not source_img:
                source_img = images[0]

        if not source_img:
            print("[INFO] No source image found. Generating a quick base image (10 steps)...")
            payload = {
                "prompt": "a sleek minimalist ceramic vase on a wooden table, soft studio lighting",
                "styles": ["Photographic"],
                "auto_expand": False,
                "model_name": "sd_xl_base_1.0.safetensors",
                "width": 1024,
                "height": 1024,
                "steps": 10,
                "cfg_scale": 7.0,
                "seed": 4242
            }
            async with session.post("http://127.0.0.1:8000/api/generate", json=payload) as gen_resp:
                gen_data = await gen_resp.json()
                task_id = gen_data["task_id"]
            
            async with websockets.connect(f"ws://127.0.0.1:8000/api/progress/{task_id}") as ws:
                while True:
                    msg = await ws.recv()
                    evt = json.loads(msg)
                    if evt.get("type") == "completed":
                        break
            
            async with session.get("http://127.0.0.1:8000/api/images") as resp:
                images = await resp.json()
                source_img = images[0]

        print(f"[SUCCESS] Selected source image ID #{source_img['id']}: {source_img['filename']} ({source_img['width']}x{source_img['height']})")

        print("\n" + "=" * 60)
        print("STAGE 2: Test 2x Upscale (Hi-Res Refinement Pass)")
        print("=" * 60)

        upscale_payload = {
            "image_id": source_img["id"],
            "prompt": source_img["prompt"],
            "scale_factor": 2.0,
            "denoise": 0.28,
            "steps": 12,
            "cfg_scale": 6.5
        }
        print(f"[INFO] Sending POST /api/upscale for image ID #{source_img['id']} (scale_factor=2.0, denoise=0.28)...")
        async with session.post("http://127.0.0.1:8000/api/upscale", json=upscale_payload) as up_resp:
            assert up_resp.status == 200, f"Upscale failed with status {up_resp.status}: {await up_resp.text()}"
            up_data = await up_resp.json()
            up_task_id = up_data["task_id"]
            print(f"[INFO] Upscale task queued: {up_task_id}, Target: {up_data['target_width']}x{up_data['target_height']}")

        print(f"[INFO] Connecting to progress WebSocket: ws://127.0.0.1:8000/api/progress/{up_task_id}")
        t0 = time.time()
        async with websockets.connect(f"ws://127.0.0.1:8000/api/progress/{up_task_id}") as ws:
            while True:
                msg = await ws.recv()
                evt = json.loads(msg)
                if evt.get("type") == "progress":
                    print(f"   [UPSCALE] Step {evt.get('current_step')}/{evt.get('total_steps')} ({evt.get('progress')}%)", flush=True)
                elif evt.get("type") == "completed":
                    print(f"[SUCCESS] Upscale finished in {time.time() - t0:.1f}s. Outputs: {evt.get('output_images')}")
                    break

        # Verify database record
        async with session.get("http://127.0.0.1:8000/api/images") as resp:
            latest_images = await resp.json()
            upscaled_asset = latest_images[0]
            print(f"[INFO] Latest DB asset: #{upscaled_asset['id']} {upscaled_asset['filename']}")
            print(f"       Prompt: {upscaled_asset['prompt']}")
            print(f"       Dimensions: {upscaled_asset['width']}x{upscaled_asset['height']}")
            print(f"       is_upscale: {upscaled_asset.get('is_upscale')}")

            expected_w = int(source_img["width"] * 2.0)
            expected_h = int(source_img["height"] * 2.0)
            assert upscaled_asset.get("is_upscale") is True, "Expected is_upscale to be True"
            assert upscaled_asset["width"] == expected_w, f"Expected width {expected_w}, got {upscaled_asset['width']}"
            assert upscaled_asset["height"] == expected_h, f"Expected height {expected_h}, got {upscaled_asset['height']}"
            print("[PASS] 2x Upscale test successfully verified: Dimensions doubled, is_upscale=True!")

        print("\n" + "=" * 60)
        print("STAGE 3: Test Image-to-Image Reference with Fidelity")
        print("=" * 60)

        # Test Img2Img using source image file URL
        img2img_payload = {
            "prompt": "a futuristic glowing neon cyber aesthetic version of the object",
            "image": source_img["url"],
            "fidelity": 0.70,
            "width": source_img["width"],
            "height": source_img["height"],
            "steps": 12,
            "cfg_scale": 7.0
        }
        print(f"[INFO] Sending POST /api/img2img with fidelity=0.70 using source: {source_img['url']}...")
        async with session.post("http://127.0.0.1:8000/api/img2img", json=img2img_payload) as i2i_resp:
            assert i2i_resp.status == 200, f"Img2Img failed with status {i2i_resp.status}: {await i2i_resp.text()}"
            i2i_data = await i2i_resp.json()
            i2i_task_id = i2i_data["task_id"]
            print(f"[INFO] Img2Img task queued: {i2i_task_id}, calculated denoise: {i2i_data.get('denoise')}")

        t0 = time.time()
        async with websockets.connect(f"ws://127.0.0.1:8000/api/progress/{i2i_task_id}") as ws:
            while True:
                msg = await ws.recv()
                evt = json.loads(msg)
                if evt.get("type") == "progress":
                    print(f"   [IMG2IMG] Step {evt.get('current_step')}/{evt.get('total_steps')} ({evt.get('progress')}%)", flush=True)
                elif evt.get("type") == "completed":
                    print(f"[SUCCESS] Img2Img finished in {time.time() - t0:.1f}s. Outputs: {evt.get('output_images')}")
                    break

        async with session.get("http://127.0.0.1:8000/api/images") as resp:
            latest_images = await resp.json()
            img2img_asset = latest_images[0]
            print(f"[INFO] Latest DB asset: #{img2img_asset['id']} {img2img_asset['filename']}")
            print(f"       Prompt: {img2img_asset['prompt']}")
            print(f"       Dimensions: {img2img_asset['width']}x{img2img_asset['height']}")
            print(f"       is_img2img: {img2img_asset.get('is_img2img')}")

            assert img2img_asset.get("is_img2img") is True, "Expected is_img2img to be True"
            print("[PASS] Img2Img test successfully verified: is_img2img=True, generation completed smoothly!")

        print("\n" + "=" * 60)
        print("ALL VERIFICATION CHECKS PASSED PERFECTLY!")
        print("=" * 60)

if __name__ == "__main__":
    asyncio.run(run_verification())
