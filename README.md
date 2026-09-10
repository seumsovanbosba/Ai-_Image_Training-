# Antigravity Local AI Image Generation Suite

An enterprise-grade, **100% offline**, self-hosted local image generation suite fusing the best architectural paradigms of:
1. **ComfyUI (Headless Engine)**: Asynchronous JSON API DAG workflow execution, dynamic model loading, sampling pipelines, and VRAM management.
2. **Fooocus (Automation & UX)**: Automated prompt enhancement (deterministic rule-based scene expansion), multi-style preset injection, and negative prompt automation.
3. **InvokeAI (Production Canvas & Workspace)**: Interactive dual-layer canvas for inpainting with brush/eraser/mask inversion, asset boards, and SQLite-backed generation history.

---

## Architecture Diagram

```
+-------------------------------------------------------------------------+
|                  Modern SPA (React + Tailwind CSS)                      |
|  - Production Inpaint Canvas (Brush / Eraser / Invert / Export)         |
|  - Fooocus Style Tag Selector & Auto-Expansion Prompt Bar               |
|  - Realtime WebSocket Latent Preview & Progress Meter                   |
|  - InvokeAI-style Asset Boards & Metadata Inspector                     |
+-------------------------------------------------------------------------+
                                    |
                            HTTP & WebSockets
                                    |
+-------------------------------------------------------------------------+
|                  FastAPI Orchestrator Backend (:8000)                   |
|  - app/services/prompt_pipeline.py: Fooocus rule-based prompt engine    |
|  - app/services/workflow_compiler.py: Standard ComfyUI API DAG Compiler |
|  - app/services/comfy_client.py: WebSocket bridge & execution client    |
|  - app/database.py: SQLite / SQLModel asset & task persistence          |
+-------------------------------------------------------------------------+
                                    |
                            HTTP /ws (:8188)
                                    |
+-------------------------------------------------------------------------+
|                  ComfyUI Headless Engine (:8188)                        |
|  - Reads models from /models/ via extra_model_paths.yaml               |
|  - Isolated environment: HF_HUB_OFFLINE=1, TRANSFORMERS_OFFLINE=1       |
+-------------------------------------------------------------------------+
```

---

## Quick Start Guide

### Windows
Double-click `start.bat` or run:
```cmd
start.bat
```
This script automatically:
1. Enforces strict offline environment variables (`HF_HUB_OFFLINE=1`, `TRANSFORMERS_OFFLINE=1`, `HF_DATASETS_OFFLINE=1`).
2. Validates or initializes the Python virtual environment (`.venv`).
3. Launches the headless ComfyUI engine if present.
4. Starts the FastAPI server on port 8000 and opens the browser to `http://127.0.0.1:8000`.

### Linux / macOS
```bash
chmod +x start.sh
./start.sh
```

---

## Directory Structure

```
├── backend/
│   ├── app/
│   │   ├── config.py              # Configuration & offline flags
│   │   ├── database.py            # SQLite database engine
│   │   ├── main.py                # FastAPI entrypoint, CORS, static routes
│   │   ├── models/                # SQLModel & Pydantic schemas
│   │   │   ├── generation.py      # ImageAsset, Board, GenerationTask
│   │   │   └── schemas.py         # GenerateRequest, InpaintRequest
│   │   ├── services/
│   │   │   ├── comfy_client.py    # ComfyUI API client & WebSocket listener
│   │   │   ├── workflow_compiler.py # Compiles DAGs (SDXL, Flux, SD1.5, Inpaint)
│   │   │   ├── prompt_pipeline.py # Fooocus prompt processor & style injector
│   │   │   └── model_manager.py   # Local safetensors model scanner
│   │   ├── routers/               # API endpoints
│   │   │   ├── generate.py        # /api/generate, /api/inpaint, /api/interrupt
│   │   │   ├── websocket.py       # /api/progress/{task_id}
│   │   │   ├── gallery.py         # /api/images, /api/boards
│   │   │   └── models.py          # /api/models, /api/styles, /api/resolutions
│   │   └── data/
│   │       ├── styles.json        # Curated Fooocus style presets
│   │       └── resolutions.json   # Native SDXL & SD 1.5 aspect ratios
│   ├── requirements.txt
│   └── tests/
│       └── test_api.py            # Automated test suite
├── comfy_engine/
│   ├── comfy_manager.py           # Headless supervisor & health monitor
│   └── extra_model_paths.yaml     # Maps ComfyUI directly to /models
├── frontend/                      # React + TypeScript + Vite + Tailwind CSS
│   ├── dist/                      # Pre-built production SPA bundle
│   └── src/
│       ├── components/
│       │   ├── canvas/            # Inpaint canvas with brush, eraser, mask export
│       │   ├── prompt/            # Prompt bar with Fooocus style chips
│       │   ├── controls/          # Engine controls & live latent progress
│       │   └── gallery/           # Boards & image inspector
│       ├── services/              # API & WebSocket client
│       └── types/                 # TypeScript interfaces
├── models/
│   ├── checkpoints/               # Drop .safetensors (SDXL, Flux, SD 1.5) here
│   ├── loras/                     # LoRA weights (pick in the prompt dock)
│   ├── vae/                       # Variational Autoencoders
│   ├── controlnet/                # ControlNet weights
│   └── upscale_models/            # RealESRGAN / UltraSharp for Upscale 2x
├── docs/
│   └── LORA_TRAINING.md           # Kohya checklist for the Windows GPU PC
├── outputs/                       # Generated image files
├── start.bat                      # Windows launcher
├── start.sh                       # Linux launcher
└── README.md
```

---

## Adding Models (.safetensors)

Place your `.safetensors` files directly in `models/checkpoints/`:
- **SDXL**: `models/checkpoints/sd_xl_base_1.0.safetensors`
- **Flux**: `models/checkpoints/flux1-schnell.safetensors`
- **SD 1.5**: `models/checkpoints/v1-5-pruned-emaonly.safetensors`

The application automatically scans this folder and populates the Model selector in the UI.

### LoRA (trained add-on, not a full model)

1. Train on the Windows 11 GPU PC using [docs/LORA_TRAINING.md](docs/LORA_TRAINING.md).
2. Copy `your_lora.safetensors` into `models/loras/` (do not commit the file).
3. Restart `start.bat`. Pick the LoRA in the prompt dock, strength 0.7–1.0, and include the trigger word in the prompt.

### Upscale 2x (RealESRGAN, not bicubic stretch)

Upscale needs a dedicated upscaler, not SDXL at 2048. On the GPU PC, once:

```bat
python scripts/download_upscale_model.py
```

That drops `RealESRGAN_x4plus.pth` into `models/upscale_models/`. Restart `start.bat`. The result chip shows pixel size (e.g. 1024×1024 → 2048×2048).

If the file is missing, `/api/upscale` returns 400 instead of silently stretching the same picture.

### Image edits (“remove the words from the banners”)

Attach the photo (`+` → Image-to-Image Reference) or click **Use as Reference** on a result. An edit-shaped prompt auto-routes to img2img and is rewritten into a desired-state caption. For one specific word, mask it on **Canvas** (inpaint) — that is more reliable than a global regen.

---

## Attaching ComfyUI

The suite includes an automated fallback simulation engine so you can test and explore the interface immediately. To attach full GPU-accelerated ComfyUI inference:

```bash
git clone https://github.com/comfyanonymous/ComfyUI comfy_engine/ComfyUI
.venv\Scripts\pip install -r comfy_engine/ComfyUI/requirements.txt
```

Once cloned, `start.bat` will detect `comfy_engine/ComfyUI/main.py` and run it automatically in headless mode on port 8188!

---

## API Reference

### Text-to-Image Generation
- `POST /api/generate`
```json
{
  "prompt": "a cybernetic tiger in an overgrown temple",
  "styles": ["Photographic", "Cinematic"],
  "auto_expand": true,
  "expansion_level": "medium",
  "width": 1024,
  "height": 1024,
  "steps": 30,
  "cfg_scale": 7.0,
  "sampler": "dpmpp_2m",
  "scheduler": "karras",
  "seed": -1,
  "lora_name": null,
  "lora_strength": 0.8
}
```

### Image-to-Image
- `POST /api/img2img` — `image` (data URL or `/outputs/filename.png`) + `fidelity` (0.1–0.9, higher stays closer to the photo)

### Upscale
- `POST /api/upscale` — `image_id` or `image`, `scale_factor` 2. Requires a file in `models/upscale_models/`

### LoRAs
- `GET /api/loras`

### Inpainting
- `POST /api/inpaint`
```json
{
  "prompt": "golden royal crown",
  "base_image": "data:image/png;base64,...",
  "mask_image": "data:image/png;base64,...",
  "denoise": 0.85,
  "steps": 30
}
```

### Real-time Progress & Preview WebSocket
- `WS /api/progress/{task_id}`
Streams JSON payloads with:
- `progress`: 0 to 100%
- `current_step`: current sampling step
- `total_steps`: total steps
- `preview_base64`: real-time latent preview frame data URI
- `output_images`: completed file list
