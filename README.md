# KiTH open-source image generation benchmark

Local research toolkit for **Soem Sovanbosba** and **Eang Hourmeng**.

ComfyUI Desktop on the Windows laptop is the only generation engine. This toolkit can queue **one local job at a time** to that app, copy the PNG into the benchmark folders, and log duration / peak VRAM. It also records hardware, stores the frozen 18-prompt benchmark, supports independent scoring, exports a PDF, shows a side-by-side gallery, and draws the four required charts.

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

On the **same Windows laptop** as ComfyUI Desktop:

1. Start ComfyUI Desktop and wait until it is idle (API at `http://127.0.0.1:8188`).
2. Run `start.bat` and open **Generate**.
3. Pick **one** model and **one** prompt. Confirm the checkpoint filename matches a file in ComfyUI `models/checkpoints`.
4. Click **Generate this image once**. Do not retry because the picture looks weak. The page blocks if `Pxx_MODEL.png` already exists.
5. The PNG is copied to `benchmark/images/core/{SD15,SDXL,TURBO}/` and duration, peak VRAM, RAM, seed, and errors are written to `benchmark/dataset/dataset.json`.

Warm-up (once per model, never scored): Generate → Warm-up.

Close games and other GPU apps first. One checkpoint at a time. Optional native-size demos still go in `benchmark/images/optional_native/` by hand.

If ComfyUI is closed, Generate will say it cannot connect. You can still generate inside ComfyUI manually and fill the Gallery measurement form, but Generate is the intended path so logs stay complete.

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
