#!/usr/bin/env bash
# Antigravity AI Local Generation Suite (100% Offline)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "====================================================================="
echo "      ANTIGRAVITY LOCAL AI IMAGE GENERATION SUITE"
echo "   Headless ComfyUI + Fooocus Automation + InvokeAI Canvas"
echo "====================================================================="
echo ""

# 1. STRICT OFFLINE ENVIRONMENT ENFORCEMENT
export HF_HUB_OFFLINE=1
export TRANSFORMERS_OFFLINE=1
export HF_DATASETS_OFFLINE=1
export TORCH_HOME="${SCRIPT_DIR}/models/cache"
export PYTHONUNBUFFERED=1

echo "[OK] Offline mode enforced:"
echo "     HF_HUB_OFFLINE=1"
echo "     TRANSFORMERS_OFFLINE=1"
echo "     HF_DATASETS_OFFLINE=1"
echo ""

# 2. CREATE DIRECTORIES
mkdir -p "${SCRIPT_DIR}/models/checkpoints"
mkdir -p "${SCRIPT_DIR}/models/loras"
mkdir -p "${SCRIPT_DIR}/models/vae"
mkdir -p "${SCRIPT_DIR}/models/controlnet"
mkdir -p "${SCRIPT_DIR}/outputs"

# 3. PYTHON VIRTUAL ENVIRONMENT CHECK
VENV_PYTHON="${SCRIPT_DIR}/.venv/bin/python"
if [ ! -f "$VENV_PYTHON" ]; then
    echo "[INFO] Creating Python virtual environment in .venv..."
    python3 -m venv "${SCRIPT_DIR}/.venv"
    echo "[INFO] Installing backend dependencies..."
    "${SCRIPT_DIR}/.venv/bin/pip" install -r "${SCRIPT_DIR}/backend/requirements.txt"
fi

# 4. CHECK HEADLESS COMFYUI ENGINE
if [ -f "${SCRIPT_DIR}/comfy_engine/ComfyUI/main.py" ]; then
    echo "[INFO] Starting Headless ComfyUI Engine on port 8188..."
    "$VENV_PYTHON" "${SCRIPT_DIR}/comfy_engine/ComfyUI/main.py" --listen 127.0.0.1 --port 8188 --highvram --extra-model-paths-config "${SCRIPT_DIR}/comfy_engine/extra_model_paths.yaml" &
    COMFY_PID=$!
    trap "kill $COMFY_PID" EXIT
else
    echo "[NOTICE] ComfyUI directory not found at comfy_engine/ComfyUI."
    echo "         The suite will run in standalone simulation / fallback mode."
fi

echo ""
echo "[INFO] Starting Antigravity Orchestrator Backend & Studio UI..."
echo "[INFO] Available at http://127.0.0.1:8000"
echo ""

# 5. LAUNCH FASTAPI SERVER
exec "$VENV_PYTHON" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir "${SCRIPT_DIR}/backend"
