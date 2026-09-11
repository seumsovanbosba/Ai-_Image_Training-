# KiTH open-source image generation benchmark

Local research toolkit for **Soem Sovanbosba** and **Eang Hourmeng**.

This repository does **not** generate images. ComfyUI Desktop on the Windows laptop is the only generation engine. This toolkit records hardware, stores the frozen 18-prompt benchmark, registers 54 images and measurements, supports independent scoring, exports a PDF, shows a side-by-side gallery, and draws the four required charts.

Full operating rules: [docs/INTERNSHIP_INSTRUCTION.md](docs/INTERNSHIP_INSTRUCTION.md)

## Research question

Which openly available text-to-image model provides the best balance of prompt adherence, visual quality, generation speed and memory use on an 8 GB VRAM computer?

## Models (one at a time)

| Model | ID | Locked core settings |
| --- | --- | --- |
| Stable Diffusion 1.5 | SD15 | 512x512, 25 steps, CFG 7, batch 1 |
| Stable Diffusion XL Base 1.0 | SDXL | 512x512, 25 steps, CFG 7, batch 1 |
| SDXL Turbo | TURBO | 512x512, 4 steps, CFG 1, batch 1 |

Empty negative prompt for every scored image. Same prompt and seed across the three models. Do not retry a weak result.

Official downloads:

- ComfyUI Desktop (Windows): https://comfy.org/download/
- SD 1.5: https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5
- SDXL Base 1.0: https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0
- SDXL Turbo: https://huggingface.co/stabilityai/sdxl-turbo

Put checkpoints in the ComfyUI Desktop `models/checkpoints` folder, not in this git repo.

## Install the toolkit (Linux or Windows 11)

Python 3.10+ recommended. On this repo a `.venv` is fine:

```bash
python -m venv .venv
# Linux / macOS
source .venv/bin/activate
# Windows
.venv\Scripts\activate

python -m pip install -r requirements.txt
```

### Start the local gallery / scoring app

Linux / macOS:

```bash
chmod +x start.sh
./start.sh
```

Windows 11:

```bat
start.bat
```

Or:

```bash
python -m streamlit run gallery_app/app.py
```

The app stays on your machine. Do not expose it or ComfyUI to the public internet.

## Installation and setup on the laptop (HourMeng)

1. Record the computer specification **before** installing software:

   ```bat
   python scripts/collect_computer_info.py --stage before-install
   ```

   This writes `benchmark/Computer_info.json`.

2. Install the current ComfyUI Desktop release for Windows: https://comfy.org/download/

3. Download each inference checkpoint from its official model page (filenames and URLs go in `Computer_info.json`).

4. Place checkpoint files in the ComfyUI models checkpoints folder.

5. Load or build one text-to-image workflow per model. Save them as:

   - `benchmark/workflows/SD15.json`
   - `benchmark/workflows/SDXL.json`
   - `benchmark/workflows/TURBO.json`

6. Generate one warm-up image per model. Save as `benchmark/images/warmup/WARMUP_SD15.png` (and SDXL, TURBO). Exclude warm-ups from all measurements.

7. Record after-install disk space, ComfyUI version, and checkpoints:

   ```bat
   python scripts/collect_computer_info.py --stage after-install --comfyui-version "YOUR_VERSION"
   ```

   You can also fill ComfyUI version and checkpoint sources on the **Computer info** page.

## Controlled generation

Use the **Prompts and run sheet** page as a checklist. For every image:

1. Confirm prompt ID, checkpoint, and locked workflow.
2. Confirm 512x512, batch 1, assigned seed, empty negative prompt.
3. Close extra GPU apps.
4. Generate **once** in ComfyUI Desktop. Do not retry because the image looks weak.
5. Save `Pxx_MODEL.png` into `benchmark/images/core/SD15/` (or SDXL / TURBO).
6. Enter duration, peak VRAM, RAM, errors, and completion on the **Gallery** measurement form.

Optional native-size demos (one per model) go in `benchmark/images/optional_native/` and are never scored.

## Scoring and PDF

Both students score independently on the **Scoring** page (four criteria, 0-2, plus a short comment). You cannot see the other person's scores until both have finished all 54.

Then discuss any criterion that differs by more than one point, record the agreed score, and keep both originals.

**Export to PDF** builds `KiTH_independent_scores.pdf` with fpdf2. That path works on Linux and Windows 11 without a browser print dialog.

## Gallery

Select a prompt. The three model outputs appear side by side with model, seed, steps, CFG, time, VRAM, and agreed score. Previous / next moves between prompts. Missing PNGs or data rows show a clear error.

## Charts

The **Charts** page computes, per model:

- Average quality (total agreed points / 18)
- Average prompt adherence
- Average generation time (seconds / 18)
- Completion rate
- Peak VRAM

and draws the four required bar charts.

## Folder map

```
benchmark/Computer_info.json
benchmark/prompts/prompts.json
benchmark/workflows/
benchmark/images/core/{SD15,SDXL,TURBO}/
benchmark/images/warmup/
benchmark/images/optional_native/
benchmark/dataset/dataset.json
benchmark/scores/{hourmeng,bosba,agreed}.json
gallery_app/          Streamlit toolkit
scripts/collect_computer_info.py
docs/INTERNSHIP_INSTRUCTION.md
```

## What this project will not do

No training, fine-tuning, LoRA, canvas, img2img, cloud hosting, login, or a generator that dumps all 18 prompts at once. One model loaded at a time. One image per request.

## Licenses and responsible use

Check each model's license on its official page before any public or commercial use. Do not create sexual, hateful, violent, deceptive, or discriminatory content. Do not imitate real people or use copyrighted characters, brand logos, or living artist names in prompts.
