import os
import sys
import subprocess
import time
import urllib.request
import json
import logging
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ComfyManager")

BASE_DIR = Path(__file__).resolve().parent.parent
COMFY_DIR = BASE_DIR / "comfy_engine" / "ComfyUI"
EXTRA_PATHS_CONFIG = BASE_DIR / "comfy_engine" / "extra_model_paths.yaml"

def enforce_offline_environment():
    """Guarantee strict offline execution."""
    os.environ["HF_HUB_OFFLINE"] = "1"
    os.environ["TRANSFORMERS_OFFLINE"] = "1"
    os.environ["HF_DATASETS_OFFLINE"] = "1"
    logger.info("Enforced strict offline environment (HF_HUB_OFFLINE=1, TRANSFORMERS_OFFLINE=1)")

def check_comfy_health(host="127.0.0.1", port=8188) -> bool:
    url = f"http://{host}:{port}/system_stats"
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "AntigravitySuite"})
        with urllib.request.urlopen(req, timeout=2) as resp:
            return resp.status == 200
    except Exception:
        return False

def start_comfyui_headless(host="127.0.0.1", port=8188, highvram=False):
    enforce_offline_environment()

    if not COMFY_DIR.exists() or not (COMFY_DIR / "main.py").exists():
        logger.warning(f"ComfyUI not found at {COMFY_DIR}. Please clone ComfyUI into comfy_engine/ComfyUI or install as submodule.")
        logger.info("The Antigravity backend will automatically handle offline simulation mode until ComfyUI is installed.")
        return None

    cmd = [
        sys.executable,
        str(COMFY_DIR / "main.py"),
        "--listen", host,
        "--port", str(port),
        "--extra-model-paths-config", str(EXTRA_PATHS_CONFIG)
    ]
    if highvram:
        cmd.append("--highvram")

    logger.info(f"Launching headless ComfyUI engine: {' '.join(cmd)}")
    proc = subprocess.Popen(
        cmd,
        cwd=str(COMFY_DIR),
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1
    )

    # Wait for service to become responsive
    logger.info("Waiting for ComfyUI API to become ready...")
    for _ in range(30):
        if check_comfy_health(host, port):
            logger.info("ComfyUI headless engine is ONLINE and responsive.")
            return proc
        time.sleep(1)

    logger.warning("ComfyUI did not respond within 30 seconds.")
    return proc

if __name__ == "__main__":
    proc = start_comfyui_headless()
    if proc:
        try:
            for line in proc.stdout:
                print(f"[ComfyUI] {line.strip()}")
        except KeyboardInterrupt:
            logger.info("Stopping ComfyUI...")
            proc.terminate()
            proc.wait()
