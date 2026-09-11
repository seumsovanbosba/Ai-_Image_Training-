import os
import sys
import subprocess
import time
import urllib.request
import json
import logging
import asyncio
from pathlib import Path
from typing import Optional

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("ComfyManager")

BASE_DIR = Path(__file__).resolve().parent.parent
COMFY_DIR = BASE_DIR / "comfy_engine" / "ComfyUI"
EXTRA_PATHS_CONFIG = BASE_DIR / "comfy_engine" / "extra_model_paths.yaml"
LOG_PATH = BASE_DIR / "comfy_engine" / "comfy_engine.log"

_managed_proc: Optional[subprocess.Popen] = None
_log_file_handle = None
_is_starting: bool = False


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


def is_comfy_starting() -> bool:
    global _is_starting, _managed_proc
    if _is_starting:
        return True
    if _managed_proc is not None and _managed_proc.poll() is None:
        return not check_comfy_health()
    return False


def get_python_exe() -> str:
    venv_py = BASE_DIR / ".venv" / "Scripts" / "python.exe"
    if venv_py.exists():
        return str(venv_py)
    return sys.executable


def start_comfyui_headless(host="127.0.0.1", port=8188, highvram=False, wait_ready=True) -> Optional[subprocess.Popen]:
    global _managed_proc, _log_file_handle, _is_starting
    enforce_offline_environment()

    # Already responsive on target port
    if check_comfy_health(host, port):
        logger.info(f"ComfyUI is already ONLINE and responsive at http://{host}:{port}")
        return _managed_proc

    # Managed process already running and still initializing
    if _managed_proc is not None and _managed_proc.poll() is None:
        logger.info("ComfyUI process is already active and initializing...")
        if wait_ready:
            for _ in range(30):
                if check_comfy_health(host, port):
                    logger.info("ComfyUI headless engine is ONLINE.")
                    return _managed_proc
                time.sleep(1)
        return _managed_proc

    if not COMFY_DIR.exists() or not (COMFY_DIR / "main.py").exists():
        logger.warning(f"ComfyUI not found at {COMFY_DIR}. Standalone simulation mode will be used.")
        return None

    python_exe = get_python_exe()
    cmd = [
        python_exe,
        str(COMFY_DIR / "main.py"),
        "--listen", host,
        "--port", str(port),
        "--extra-model-paths-config", str(EXTRA_PATHS_CONFIG)
    ]
    if highvram:
        cmd.append("--highvram")

    logger.info(f"Launching headless ComfyUI engine: {' '.join(cmd)}")
    _is_starting = True

    try:
        if _log_file_handle is not None and not _log_file_handle.closed:
            _log_file_handle.close()
        _log_file_handle = open(LOG_PATH, "a", encoding="utf-8", errors="replace")

        creationflags = 0
        if sys.platform == "win32":
            creationflags = subprocess.CREATE_NEW_PROCESS_GROUP

        _managed_proc = subprocess.Popen(
            cmd,
            cwd=str(COMFY_DIR),
            stdout=_log_file_handle,
            stderr=subprocess.STDOUT,
            text=True,
            creationflags=creationflags
        )
    except Exception as e:
        _is_starting = False
        logger.error(f"Failed to spawn ComfyUI subprocess: {e}")
        return None

    if wait_ready:
        logger.info("Waiting for ComfyUI API to become ready on port 8188...")
        for _ in range(40):
            if check_comfy_health(host, port):
                _is_starting = False
                logger.info("ComfyUI headless engine is ONLINE and responsive.")
                return _managed_proc
            if _managed_proc.poll() is not None:
                _is_starting = False
                logger.error(f"ComfyUI process exited prematurely with code {_managed_proc.returncode}. Check {LOG_PATH}")
                return _managed_proc
            time.sleep(1)

        _is_starting = False
        logger.warning(f"ComfyUI did not respond within 40 seconds. Check logs at {LOG_PATH}")

    return _managed_proc


async def ensure_comfy_running(host="127.0.0.1", port=8188):
    """Asynchronous background supervisor check."""
    global _is_starting
    if check_comfy_health(host, port):
        logger.info("ComfyUI is already online.")
        return True

    if not COMFY_DIR.exists() or not (COMFY_DIR / "main.py").exists():
        logger.info("ComfyUI directory not found; skipping headless auto-start.")
        return False

    logger.info("ComfyUI is offline. Automatically initiating headless engine...")
    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, lambda: start_comfyui_headless(host, port, wait_ready=False))

    # Wait up to 45 seconds for it to become ready
    for _ in range(45):
        if check_comfy_health(host, port):
            _is_starting = False
            logger.info("ComfyUI engine has successfully come ONLINE via auto-supervisor.")
            return True
        await asyncio.sleep(1)

    _is_starting = False
    logger.warning("ComfyUI auto-start timeout after 45 seconds.")
    return False


def stop_comfyui_headless():
    global _managed_proc, _log_file_handle
    if _managed_proc and _managed_proc.poll() is None:
        logger.info("Stopping managed ComfyUI process...")
        try:
            _managed_proc.terminate()
            _managed_proc.wait(timeout=5)
        except Exception as e:
            logger.warning(f"Error terminating ComfyUI process: {e}")
            try:
                _managed_proc.kill()
            except Exception:
                pass
    if _log_file_handle and not _log_file_handle.closed:
        try:
            _log_file_handle.close()
        except Exception:
            pass


if __name__ == "__main__":
    proc = start_comfyui_headless(wait_ready=True)
    if proc:
        try:
            while proc.poll() is None:
                time.sleep(1)
        except KeyboardInterrupt:
            stop_comfyui_headless()
