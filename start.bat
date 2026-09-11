@echo off
title Antigravity AI Local Generation Suite (100% Offline)
color 0b

echo =====================================================================
echo       ANTIGRAVITY LOCAL AI IMAGE GENERATION SUITE
echo    Headless ComfyUI + Fooocus Automation + InvokeAI Canvas
echo =====================================================================
echo.

:: 1. STRICT OFFLINE ENVIRONMENT ENFORCEMENT
set HF_HUB_OFFLINE=1
set TRANSFORMERS_OFFLINE=1
set HF_DATASETS_OFFLINE=1
set TORCH_HOME=%~dp0models\cache
set PYTHONUNBUFFERED=1

echo [OK] Offline mode enforced:
echo      HF_HUB_OFFLINE=1
echo      TRANSFORMERS_OFFLINE=1
echo      HF_DATASETS_OFFLINE=1
echo.

:: 2. CREATE DIRECTORIES
if not exist "%~dp0models\checkpoints" mkdir "%~dp0models\checkpoints"
if not exist "%~dp0models\loras" mkdir "%~dp0models\loras"
if not exist "%~dp0models\vae" mkdir "%~dp0models\vae"
if not exist "%~dp0models\controlnet" mkdir "%~dp0models\controlnet"
if not exist "%~dp0models\upscale_models" mkdir "%~dp0models\upscale_models"
if not exist "%~dp0outputs" mkdir "%~dp0outputs"

:: 3. PYTHON VIRTUAL ENVIRONMENT CHECK
set VENV_PYTHON=%~dp0.venv\Scripts\python.exe
if not exist "%VENV_PYTHON%" (
    echo [INFO] Creating Python virtual environment in .venv...
    python -m venv "%~dp0.venv"
    echo [INFO] Installing backend dependencies...
    "%~dp0.venv\Scripts\pip.exe" install -r "%~dp0backend\requirements.txt"
)

:: 4. CHECK HEADLESS COMFYUI ENGINE
if exist "%~dp0comfy_engine\ComfyUI\main.py" (
    echo [INFO] Headless ComfyUI Engine detected.
    echo [INFO] Starting Headless ComfyUI Engine on port 8188...
    start "ComfyUI Headless Engine" /d "%~dp0comfy_engine\ComfyUI" /min "%VENV_PYTHON%" "%~dp0comfy_engine\ComfyUI\main.py" --listen 127.0.0.1 --port 8188 --extra-model-paths-config "%~dp0comfy_engine\extra_model_paths.yaml"
) else (
    echo [NOTICE] ComfyUI directory not found at comfy_engine\ComfyUI.
    echo          The suite will run in standalone simulation / fallback mode.
    echo          To attach ComfyUI: git clone https://github.com/comfyanonymous/ComfyUI comfy_engine/ComfyUI
)

echo.
echo [INFO] Starting Antigravity Orchestrator Backend & Studio UI...
echo [INFO] Opening browser at http://127.0.0.1:8000
echo.

:: Open browser after 4 seconds to give engine time to initialize
start "" /b cmd /c "timeout /t 4 /nobreak >nul & start http://127.0.0.1:8000"

:: 5. LAUNCH FASTAPI SERVER
"%VENV_PYTHON%" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --app-dir "%~dp0backend"

pause
