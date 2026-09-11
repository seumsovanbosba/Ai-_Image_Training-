# Antigravity Local AI Suite: Architecture & Object Removal Deep Dive

---

## 1. Executive Summary

This codebase is the **Antigravity Local AI Image Generation & Training Suite**, an offline, self-hosted image generation and customization environment. It synthesizes three major open-source paradigms:

1. **ComfyUI (Headless Execution Engine)**: Asynchronous JSON API Directed Acyclic Graph (DAG) compilation, modular node execution, and direct VRAM/hardware orchestration.
2. **Fooocus (Automation & Prompt Engine)**: Automated prompt enhancement (deterministic rule-based scene expansion), multi-style preset injection, and negative prompt deduplication.
3. **InvokeAI (Production Workspace & Canvas)**: Dual-layer interactive inpaint canvas (brush, eraser, mask inversion), asset boards, and SQLite-backed generation lineage.

---

## 2. Full System Architecture

### 2.1 System Topology Diagram

```
+-------------------------------------------------------------------------------+
|                    FRONTEND CLIENT (React 18 + Vite + Tailwind)              |
|  - Studio View: Conversation timeline, prompt dock, image reference drawer   |
|  - Canvas View: Interactive Inpaint Canvas (Brush / Eraser / Invert / Export) |
|  - WebSocket Progress Listener: Realtime latent previews & sampling steps     |
|  - Gallery View: Board organization, image inspector, metadata viewer         |
+-------------------------------------------------------------------------------+
                                        |
                 REST API (HTTP :8000)  |  WebSockets (/api/progress/{task_id})
                                        v
+-------------------------------------------------------------------------------+
|                       BACKEND ORCHESTRATOR (FastAPI :8000)                    |
|  - Router Layer: /api/generate, /api/img2img, /api/inpaint, /api/upscale       |
|  - Prompt Pipeline (Fooocus Engine): Style injection & rule-based expansion   |
|  - Workflow Compiler: High-level params -> ComfyUI JSON DAGs                  |
|  - Comfy Client: Asynchronous HTTP/WebSocket bridge to port 8188              |
|  - Database: SQLite (SQLModel) -> GenerationTask, ImageAsset, Board           |
+-------------------------------------------------------------------------------+
                                        |
                  HTTP POST /prompt     |  WS /ws?clientId={id}
                  HTTP POST /upload/image
                                        v
+-------------------------------------------------------------------------------+
|                      COMFYUI HEADLESS ENGINE (:8188)                          |
|  - extra_model_paths.yaml -> Maps models/ directly into ComfyUI               |
|  - CheckpointLoaderSimple (SDXL base 1.0, 6.94 GB safetensors)               |
|  - LoraLoader (models/loras/*.safetensors)                                    |
|  - KSampler / VAEEncode / VAEEncodeForInpaint / VAEDecode                     |
|  - UpscaleModelLoader (models/upscale_models/RealESRGAN_x4plus.pth)           |
|  - Strictly Offline: HF_HUB_OFFLINE=1, TRANSFORMERS_OFFLINE=1                  |
+-------------------------------------------------------------------------------+
```

---

### 2.2 Directory Structure & Module Breakdown

```
c:\Ai Training\
├── backend/
│   ├── app/
│   │   ├── config.py                 # Paths, CORS, offline settings, model dirs
│   │   ├── database.py               # SQLite engine, session management (SQLModel)
│   │   ├── main.py                   # FastAPI app entrypoint, static files, lifecycle
│   │   ├── models/                   # SQLModel & Pydantic schemas
│   │   │   ├── generation.py         # DB tables: ImageAsset, GenerationTask, Board
│   │   │   └── schemas.py            # Pydantic schemas: GenerateRequest, InpaintRequest, etc.
│   │   ├── routers/
│   │   │   ├── generate.py           # Core endpoints: /generate, /img2img, /inpaint, /upscale
│   │   │   ├── websocket.py          # WebSocket handler: /api/progress/{task_id}
│   │   │   ├── gallery.py            # Image assets & board CRUD
│   │   │   └── models.py             # Checkpoints, styles, and resolutions queries
│   │   ├── services/
│   │   │   ├── prompt_pipeline.py    # Fooocus style/negative/expansion processor
│   │   │   ├── workflow_compiler.py  # Compiles high-level requests into ComfyUI DAGs
│   │   │   ├── comfy_client.py       # Asynchronous bridge to ComfyUI (HTTP & WS)
│   │   │   └── model_manager.py      # Scans models/ directory for checkpoints & loras
│   │   └── data/
│   │       ├── styles.json           # Fooocus style preset definitions
│   │       └── resolutions.json      # Aspect ratio presets
│   └── tests/                        # Automated API tests
├── comfy_engine/
│   ├── comfy_manager.py              # Headless process supervisor and health probe
│   └── extra_model_paths.yaml        # Maps ComfyUI model loaders directly to models/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── canvas/InpaintCanvas.tsx         # Dual-layer inpainting canvas
│   │   │   ├── studio/PromptDock.tsx            # Floating prompt dock with LoRA & tool selectors
│   │   │   ├── studio/ImageReferenceModal.tsx   # Img2Img reference image selector
│   │   │   ├── studio/ConversationTimeline.tsx  # Turn-by-turn generation stream
│   │   │   ├── prompt/StylePicker.tsx           # Fooocus style tag chips
│   │   │   └── gallery/                         # Asset viewer & boards
│   │   ├── services/api.ts                      # Axios/fetch client & WebSocket client
│   │   └── App.tsx                              # Central state machine & dispatch coordinator
├── models/
│   ├── checkpoints/                  # Base weights (sd_xl_base_1.0.safetensors)
│   ├── loras/                        # Trained LoRA weights (*.safetensors)
│   ├── upscale_models/               # RealESRGAN_x4plus.pth
│   ├── vae/                          # Optional custom VAEs
│   └── controlnet/                   # Optional ControlNet weights
├── outputs/                          # Persistent generated images (PNG)
├── scripts/
│   ├── prepare_lora_dataset.py       # Prepares Kohya-ss training datasets from raw photos
│   ├── download_model.py             # HuggingFace downloader for SDXL base
│   └── download_upscale_model.py     # Downloader for RealESRGAN upscaler
├── docs/
│   └── LORA_TRAINING.md              # Complete Kohya-ss training guide for Windows 11 GPU
├── database.sqlite                   # SQLite database storing generation metadata & tasks
├── start.bat                         # Windows automated launcher (enforces offline flags)
└── start.sh                          # Linux launcher
```

---

## 3. How the Core Pipelines Work

### 3.1 Prompt Processing Pipeline (`prompt_pipeline.py`)
Before any diffusion begins, the user's raw prompt passes through:
1. **Edit Intent Detection**: Determines if the prompt is an edit instruction (e.g. `"remove the words from the banners"`, `"erase glasses"`). If an edit intent is found, automatic expansion is disabled so the prompt isn't overwhelmed by cinematic fluff.
2. **Deterministic Auto-Expansion (Fooocus style)**: Categorizes the prompt into Portrait, Landscape, or Creature, then injects specialized lighting, camera lens parameters, and detail tokens.
3. **Style Injection**: Replaces `{prompt}` in style templates (from `styles.json`) and extracts negative prompt tokens.
4. **Negative Prompt Deduplication**: Merges default base negatives (`"low quality"`, `"distorted"`, etc.) with user negatives and style negatives, removing duplicates.

### 3.2 ComfyUI Workflow Compilation (`workflow_compiler.py`)
Instead of executing Python diffusion code directly in FastAPI, the backend builds **ComfyUI API DAGs**:
- **Text-to-Image (`compile_txt2img`)**:
  - `CheckpointLoaderSimple` (Node 1) -> `CLIPTextEncode` Positive (Node 2) & Negative (Node 3).
  - Optional `LoraLoader` (Node 9) dynamically spliced between Checkpoint and CLIP.
  - `EmptyLatentImage` (Node 4) -> `KSampler` (Node 5, denoise = 1.0) -> `VAEDecode` (Node 6) -> `SaveImage` (Node 7).
- **Image-to-Image (`compile_img2img`)**:
  - `LoadImage` (Node 10) -> `VAEEncode` (Node 14) -> `KSampler` (Node 5, denoise = 0.15 - 0.65).
  - Retains latent spatial structure from the source image while nudging details based on prompt.
- **Inpaint Canvas (`compile_inpaint`)**:
  - `LoadImage` Base (Node 10) + `LoadImage` Mask (Node 11).
  - `VAEEncodeForInpaint` (Node 12) with `grow_mask_by = 6` pixel feathering.
  - `KSampler` (Node 5, denoise = 0.85).
- **Upscaling (`compile_upscale`)**:
  - `UpscaleModelLoader` (Node 20) -> `ImageUpscaleWithModel` (Node 21) -> `ImageScale` (Node 22).

### 3.3 Real-time Latent Streaming (`websocket.py` & `comfy_client.py`)
1. Backend opens a persistent WebSocket connection to ComfyUI (`ws://127.0.0.1:8188/ws?clientId={id}`).
2. During KSampler execution, ComfyUI transmits binary preview frames of decoded latents.
3. Backend parses step progression (`step / total_steps`) and relays JSON/base64 frames over `/api/progress/{task_id}` to the React frontend in real time.
4. When finished, `SaveImage` saves the PNG in `outputs/` and the backend records an `ImageAsset` in `database.sqlite`.

---

## 4. What You Are Trying to Do & Why It Struggles

### 4.1 The Task
Based on your workflow history and prompt queries:
- **Concept Training / Fine-tuning**: You are training or preparing to train a character/subject (e.g. "prime Mr. Leo") using a base model or LoRA, using reference images.
- **The Core Problem**: You have a reference image that contains an unwanted object (e.g., glasses, accessories, hats, or background items), and you are trying to **remove that specific object** while keeping the rest of the reference image / character intact.

### 4.2 Why It Struggles: The Mathematics and Mechanics of Diffusion Models

Many users expect diffusion models to work like Photoshop or a conversational assistant ("Please remove the glasses from this photo"). However, diffusion models struggle with this due to four core architectural constraints:

#### Constraint 1: The Denoising Dilemma in Latent Space (Img2Img)
In standard Image-to-Image (`/api/img2img`):
$$\mathbf{z}_t = \sqrt{\bar{\alpha}_t} \mathbf{z}_0 + \sqrt{1 - \bar{\alpha}_t} \boldsymbol{\epsilon}$$
- Where $\mathbf{z}_0$ is the latent encoding of your reference image, and $t$ is determined by the `denoise` level ($1.0 - \text{fidelity}$).
- **If Fidelity is High (Denoise is Low, e.g. 0.3 - 0.5)**:
  The latent noise still holds the high-contrast edge gradients and shapes of the object (e.g., the black rims of glasses, reflections). Because diffusion only denoises slightly, the model **cannot erase** these structural edges; it can only re-texture them.
- **If Fidelity is Low (Denoise is High, e.g. 0.8+)**:
  The object is finally destroyed, but so is the entire facial identity, head angle, background, and lighting. The model generates an almost entirely new picture.

#### Constraint 2: The "Pink Elephant" Problem in Cross-Attention
When you write `"remove the glasses"` or `"man without glasses"`:
- The text encoder (CLIP / OpenCLIP) tokenizes the prompt into words: `["remove", "the", "glasses"]`.
- The cross-attention layers in the UNet compute:
  $$\text{Attention}(Q, K, V) = \text{softmax}\left(\frac{QK^T}{\sqrt{d_k}}\right)V$$
- The token `"glasses"` activates the visual features for *glasses*. The model does not understand the abstract negative operator `"remove"` or `"without"`; it only recognizes that the concept *glasses* has high attention weight. As a result, **prompting "remove glasses" actively causes the model to regenerate glasses!**

#### Constraint 3: Negative Prompts Are Not Erasers
Putting `"glasses"` into the negative prompt tells the model: *"During denoising steps, push the vector away from points that resemble glasses."*
- This works well when starting from pure random noise (text-to-image).
- In image-to-image, however, the glasses are already physically present in the latent $\mathbf{z}_t$. A negative prompt cannot erase high-contrast latent pixels that are already baked into the starting state.

#### Constraint 4: LoRA Dataset Concept Entanglement (If Training)
If you are training a LoRA using reference images where the character is wearing glasses:
- The neural network links the trigger word (e.g. `ohwx person`) with all consistent pixels across the training set.
- If 70% or 100% of your training photos have glasses, the LoRA learns:
  $$\text{Trigger} = \text{Face} + \text{Glasses}$$
- The glasses become permanently entangled with the character's face. No prompt can separate them once trained this way.

---

## 5. How to Successfully Remove the Object (Actionable Solutions)

Here are the 3 solutions designed to work within this specific architecture:

### Solution 1: Use the Inpaint Canvas (Immediate & Pixel-Perfect)
Do **not** use the general prompt dock with Image-to-Image reference to remove a small object. Instead, use the built-in **Inpaint Canvas**:

1. In the studio, click the `+` button in the prompt dock and choose **Upload Image to Inpaint** (or switch to the **Canvas** tab at the top).
2. Select the **Brush** tool on the canvas.
3. Paint **only** over the object you want removed (e.g. paint over the glasses and the bridge of the nose).
4. **CRITICAL**: Do **NOT** prompt `"remove glasses"`.
5. **Prompt what should be there instead**:
   - Good Inpaint Prompt: `"close-up of natural clear eyes, detailed realistic eyes, smooth bare skin, natural eyelids, clean nose bridge, sharp focus, 8k photograph"`
   - Negative Prompt: `"glasses, sunglasses, spectacles, frames, eyewear, blurry"`
6. Set **Denoise** to **0.85 - 0.95**.
7. Click **Generate / Inpaint**.

**Why this works**: `VAEEncodeForInpaint` locks 100% of the unmasked face. Only the masked pixels are converted to pure noise, allowing the model to fill in bare skin and eyes without changing the rest of the image.

---

### Solution 2: Disentangle Concepts in LoRA Training (If You Are Training)
If you are training a LoRA on your GPU PC using `scripts/prepare_lora_dataset.py` and Kohya-ss:

The golden rule of LoRA training: **"Caption what you want to control; leave uncapped what you want to be permanent."**

- **Wrong Approach**: You don't mention glasses in the caption. The model bakes the glasses into the trigger word (`ohwx person`).
- **Correct Approach**: In every training image where the object appears, **explicitly name it in the `.txt` sidecar caption**:
  ```text
  # 001.txt (image has glasses)
  ohwx person, wearing black eyeglasses, looking at camera, brown hair, studio lighting

  # 002.txt (image does NOT have glasses)
  ohwx person, looking at camera, brown hair, studio lighting
  ```
**Why this works**: When Kohya trains, the text encoder attributes the glasses pixels to the token `"wearing black eyeglasses"`, and attributes the facial structure to `"ohwx person"`.
When you later generate in the studio:
- Prompt: `"ohwx person, looking at camera"` $\rightarrow$ Generates **without glasses**.
- Prompt: `"ohwx person, wearing black eyeglasses"` $\rightarrow$ Generates **with glasses**.

---

### Solution 3: Pre-clean the Dataset Before Training
If your training set only has 10–20 photos and an unwanted object appears across all of them:
1. Open the photos in the built-in **Inpaint Canvas** (or external tools like Lama Cleaner, Photoshop Generative Fill, or rembg).
2. Erase/inpaint the object out of the training photos first.
3. Save the clean photos into your dataset folder.
4. Run:
   ```cmd
   python scripts/prepare_lora_dataset.py --input D:\clean_photos --output D:\lora_data --trigger "ohwx person" --repeats 10
   ```
5. Train with Kohya. The resulting LoRA will never generate the unwanted object.

---

## 6. Summary Checklist

| Goal | Tool / Feature | Right Method | Common Pitfall |
|---|---|---|---|
| Remove object from existing image | **Inpaint Canvas** (`/api/inpaint`) | Mask object tightly; prompt the **replacement** (`clear eyes, bare skin`); denoise 0.85-0.95 | Using Img2Img with "remove X" in prompt |
| Train character without object | **Kohya LoRA** (`scripts/prepare_lora_dataset.py`) | Explicitly tag the object in `.txt` captions or clean the photos before training | Leaving captions blank so the object bakes into the trigger |
| Change scene while keeping subject | **Img2Img** (`/api/img2img`) | Fidelity 0.5–0.65; describe overall new lighting or environment | Using Img2Img for fine localized surgery |
