# KiTH internship instruction pack

Open-source image generation benchmark on an 8 GB VRAM computer.

**Team:** Soem Sovanbosba (Bosba) and Eang Hourmeng (HourMeng)
**Duration:** six working days
**This file:** the operating manual for both students. Follow it together with the official KiTH PDF.

---

## 1. Research question

Which openly available text-to-image model provides the best balance of prompt adherence, visual quality, generation speed and memory use on an 8 GB VRAM computer?

## 2. What this project is (and is not)

This is a **controlled academic benchmark**. It is not a product, a cloud service, or a training project.

**Included**

- Local inference of three existing checkpoints in ComfyUI Desktop (Windows)
- A frozen 18-prompt benchmark and 54 original images
- Performance measurements (time, VRAM, completion, errors)
- Independent scoring, agreed scores, four comparison charts
- A simple local comparison gallery and this research toolkit
- A 6–8 page report (excluding appendices) and an 8–10 slide presentation

**Not included**

- Training a diffusion model from scratch
- Fine-tuning, DreamBooth, LoRA, or merging checkpoints
- A production image generator, accounts, cloud hosting, or public model hosting
- Regenerating, replacing, or hiding weak images

### What this repository will not build

Do not add any of the following. They violate the PDF.

- Inpaint canvas, img2img, upscale, style presets, or a conversational studio
- A custom generator that dumps all 18 prompts into ComfyUI at once
- Parallel generation, batch size greater than 1, or loading more than one checkpoint at a time
- Login, cloud upload, or exposing ComfyUI to the public internet

ComfyUI Desktop on Bosba’s Windows laptop is the **only** generation engine. This repo records hardware, stores the frozen prompts, registers the 54 images, scores them, shows the gallery, and exports a PDF.

---

## 3. Roles

### Soem Sovanbosba — Student 1

Prompt design and visual evaluation lead.

Responsible for the prompt benchmark, objective checklists, scoring process, analysis workbook, charts, report findings, and presentation of visual comparisons.

### Eang Hourmeng — Student 2

Deployment and workflow lead.

Responsible for ComfyUI installation, model setup, locked workflows, controlled generation, hardware monitoring, the comparison gallery, and the technical demonstration.

Both students independently score **every** image. Neither may see the other person’s scores until both have finished all 54.

---

## 4. Models and locked settings

Use 512 × 512 for every scored core image so the workload is consistent.

| Model | Folder / ID | Role | Steps | CFG | Batch | Resolution |
| --- | --- | --- | --- | --- | --- | --- |
| Stable Diffusion 1.5 | `SD15` | Low-memory baseline | 25 | 7 | 1 | 512 × 512 |
| Stable Diffusion XL Base 1.0 | `SDXL` | Quality-oriented comparison | 25 | 7 | 1 | 512 × 512 |
| SDXL Turbo | `TURBO` | Speed-oriented comparison | 4 | 1 | 1 | 512 × 512 |

Negative prompt for the core benchmark: **empty**.
One image per request. One checkpoint loaded at a time.

The team may create **one additional native-size demonstration per model**. Those three images must live in `benchmark/images/optional_native/` and must **not** be scored.

### Official sources (cite these; do not invent mirrors)

- ComfyUI Desktop for Windows: [https://comfy.org/download/](https://comfy.org/download/)
- Desktop install docs: [https://docs.comfy.org/installation/desktop/windows](https://docs.comfy.org/installation/desktop/windows)
- ComfyUI source: [https://github.com/comfyanonymous/ComfyUI](https://github.com/comfyanonymous/ComfyUI)
- SD 1.5: [https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5](https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5)
- SDXL Base 1.0: [https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0)
- SDXL Turbo: [https://huggingface.co/stabilityai/sdxl-turbo](https://huggingface.co/stabilityai/sdxl-turbo)
- Memory / low-VRAM guide: [https://docs.comfy.org](https://docs.comfy.org) (ComfyUI DynamicVRAM / low VRAM mode)

Record the **exact checkpoint filename** and the **page you downloaded it from** in `benchmark/Computer_info.json`.

Typical checkpoint filenames (confirm on the official page before download):

- `v1-5-pruned-emaonly.safetensors` (SD 1.5)
- `sd_xl_base_1.0.safetensors` (SDXL Base)
- `sdxl_turbo_1.0_fp16.safetensors` (SDXL Turbo)

Place files in the ComfyUI Desktop **models / checkpoints** folder, not in this git repo.

---

## 5. Low-VRAM operating rules

1. Load and test only one checkpoint at a time.
2. Generate one image per request.
3. Close games, video editors, and other GPU-intensive programs.
4. Use ComfyUI DynamicVRAM. Try low VRAM mode if a model fails.
5. Record every out-of-memory event and the setting that caused it.
6. Do not expose the local ComfyUI service to the public internet.

---

## 6. Laptop setup (HourMeng, on Bosba’s Windows 11 computer)

Do these steps in order. Do not skip the first one.

1. **Record the computer specification before installing software.**
   From the repo root:

   ```bat
   python scripts/collect_computer_info.py --stage before-install
   ```

   This writes `benchmark/Computer_info.json`.

2. **Install the current ComfyUI Desktop release for Windows** from [comfy.org/download](https://comfy.org/download/). Confirm GPU acceleration.

3. **Download the inference checkpoint** for each selected model from its official model page.

4. **Place checkpoint files** in the ComfyUI models checkpoints folder.

5. **Load or build one text-to-image workflow per model** with the locked settings above. Export and save them as:

   - `benchmark/workflows/SD15.json`
   - `benchmark/workflows/SDXL.json`
   - `benchmark/workflows/TURBO.json`

6. **Generate one warm-up image per model.** Save them in `benchmark/images/warmup/` as `WARMUP_SD15.png`, `WARMUP_SDXL.png`, `WARMUP_TURBO.png`. Exclude them from all measurements, scores, charts, and the core gallery.

7. **Record after-install specs** (disk space after ComfyUI + checkpoints, ComfyUI version, checkpoint filenames and sources):

   ```bat
   python scripts/collect_computer_info.py --stage after-install
   ```

   Optional flags:

   ```bat
   python scripts/collect_computer_info.py --stage after-install --comfyui-version "0.x.x" --comfyui-build-date "YYYY-MM-DD" --checkpoint "v1-5-pruned-emaonly.safetensors|https://huggingface.co/stable-diffusion-v1-5/stable-diffusion-v1-5"
   ```

   You can also fill ComfyUI version and checkpoints in the toolkit **Computer info** page.

### Computer information that must be in Computer_info.json

- Operating system and version
- GPU model, driver version, and available VRAM
- CPU model and system RAM
- ComfyUI version or build date
- Exact checkpoint filenames and download sources
- Available disk space before and after installation

---

## 7. Folder plan

```
benchmark/
  Computer_info.json
  prompts/prompts.json              Frozen P01–P18 (Bosba fills text)
  workflows/                        Locked ComfyUI JSON (HourMeng exports)
    SD15.json
    SDXL.json
    TURBO.json
  images/
    core/SD15/                      P01_SD15.png … P18_SD15.png
    core/SDXL/                      P01_SDXL.png … P18_SDXL.png
    core/TURBO/                     P01_TURBO.png … P18_TURBO.png
    warmup/                         3 warm-ups, never scored
    optional_native/                3 native-size demos, never scored
  dataset/dataset.json              All required data fields
  scores/
    hourmeng.json
    bosba.json
    agreed.json
gallery_app/                        Local Streamlit toolkit
scripts/collect_computer_info.py
docs/INTERNSHIP_INSTRUCTION.md      This file
README.md
```

Core images are grouped by model folder for filing. Filenames still follow the PDF convention.

---

## 8. Filename convention

| Image ID | Meaning | Filename | Folder |
| --- | --- | --- | --- |
| P04 SD15 | Prompt 4, Stable Diffusion 1.5 | `P04_SD15.png` | `benchmark/images/core/SD15/` |
| P04 SDXL | Prompt 4, SDXL Base 1.0 | `P04_SDXL.png` | `benchmark/images/core/SDXL/` |
| P04 TURBO | Prompt 4, SDXL Turbo | `P04_TURBO.png` | `benchmark/images/core/TURBO/` |

Do not rename after generation. Do not delete a weak result. If generation fails, keep the data row, set completion to failed, and record the error.

---

## 9. Eighteen-prompt benchmark

Six categories, three prompts each. Bosba writes the English sentences. HourMeng does not change a frozen prompt.

| IDs | Category | What it must test |
| --- | --- | --- |
| P01–P03 | Single subject | One clear object or character with lighting and background |
| P04–P06 | Multiple objects | Object count, color, and attribute accuracy |
| P07–P09 | Spatial relationships | Above, below, beside, behind, foreground |
| P10–P12 | Art and visual style | Watercolor, paper cut, 3D render, or flat illustration |
| P13–P15 | Education and campus | Classroom, laboratory, student event, or recruitment |
| P16–P18 | Short text rendering | One short word or phrase in a clean design |

### Prompt writing template

Subject and action, environment, visual style, composition, lighting, color palette, and important restrictions.

Each final prompt: **one clear English sentence, no more than 45 words.**

### Requirements for every prompt

- Prompt ID from P01 to P18 and one test category
- One objective checklist of two to four **visible** requirements
- The exact same positive prompt for all three models
- Empty negative prompt for the core benchmark
- One fixed seed per prompt, reused across all three models
- No living artist names, copyrighted characters, brand logos, or real people
- Pilot three prompts, remove ambiguity, then freeze the full set **before** collection

Pilot suggestion (one simple, one spatial, one text): **P01, P07, P16**. Record the pilot in `benchmark/prompts/prompts.json` under `pilot`.

Edit prompts only in `benchmark/prompts/prompts.json` (or the Prompts page). After freeze, set `"frozen": true`.

---

## 10. Controlled generation (every core image)

HourMeng, for each of the 54 images, one at a time:

1. Confirm prompt ID, exact checkpoint, and approved workflow.
2. Confirm 512 × 512, batch size 1, assigned seed, empty negative prompt.
3. Close extra GPU apps and confirm available VRAM.
4. Generate **once**. Do not retry because the result looks weak.
5. Save the original PNG using the filename convention, plus duration and workflow metadata.
6. Record peak VRAM, technical errors, and whether generation completed.
7. Enter those measurements in the toolkit (Gallery / dataset form). Confirm the data row is complete.

Day 3: P01–P09 × three models (27 images).
Day 4: P10–P18 × three models (27 images), then audit IDs for missing, duplicate, or wrong names.

Warm-up images are extra and excluded. Optional native-size demos are extra and excluded.

---

## 11. Required dataset fields

Every core image row in `benchmark/dataset/dataset.json` must include:

- Image ID, prompt ID, category, objective checklist
- Exact model name, checkpoint filename, workflow version
- Positive prompt and empty negative prompt
- Seed, width, height, steps, CFG, sampler, scheduler
- Start time, generation duration, completion status
- Peak VRAM, observed system RAM, technical error
- Two original evaluator scores, agreed score, and comments (scores live in `benchmark/scores/` and are joined in the gallery/PDF)
- Filename, folder location, verification status

The gallery must show **model, seed, steps, CFG, time, VRAM, and agreed score** (plus effort = steps/CFG).

---

## 12. Independent scoring

### Rubric (0–2 each, max 8 per image)

| Criterion | 2 points | 1 point | 0 points |
| --- | --- | --- | --- |
| Prompt adherence | All visible requirements met | Some requirements met | Main request not followed |
| Composition | Clear and balanced | Usable with minor problems | Confusing or badly arranged |
| Visual coherence | Objects and details are coherent | Minor artifacts | Major artifacts or distortion |
| Practical usefulness | Ready or easy to refine | Needs significant editing | Not usable for the purpose |

### Procedure

1. Both students score every image independently without seeing the other score.
2. Record four scores from 0 to 2 and one short evidence-based comment.
3. Compare scores only after both complete the full set of 54.
4. Discuss any criterion where the two scores differ by more than one point.
5. Record the agreed score and preserve both original scores.

Use the toolkit **Scoring** page. Choose **HourMeng** or **Bosba**. The other person’s numbers stay hidden until both sheets are complete. Then use **Agree scores** for differences greater than one point.

Export a printable PDF with the **Export PDF** button. It works on Linux and Windows 11 (pure Python, no browser print required).

---

## 13. Required calculations and charts

For each model:

- **Average quality** = total agreed points ÷ 18
- **Prompt adherence** = average prompt-adherence score
- **Average generation time** = total generation seconds ÷ 18
- **Completion rate** = completed images ÷ 18 × 100
- **Peak VRAM** = highest observed VRAM for that model

Required charts (toolkit **Charts** page):

1. Average total quality score by model
2. Average prompt adherence score by model
3. Average generation time in seconds by model
4. Peak VRAM usage by model

---

## 14. Comparison gallery (minimum)

Local Streamlit app, no upload.

- Select or open one of the 18 benchmark prompts
- Show the three model outputs side by side
- Metadata: model, seed, steps, CFG, time, VRAM, agreed score
- Previous / next prompt without editing files
- Clear error when an image or data record is missing

Start from the repo root:

```bash
python -m streamlit run gallery_app/app.py
```

On Windows: `start.bat`. On Linux: `./start.sh`.

---

## 15. Day-by-day work

### Bosba (Student 1)

| Day | Tasks | Deliverable |
| --- | --- | --- |
| 1 | Study the three official model pages. Learn prompt parts. Create folder plan awareness, filename guide, daily log, evaluation workbook. Record each model’s purpose, license, and official source. | Folder structure, naming guide, workbook, model summary |
| 2 | Write three prompts in each of six categories. Write 2–4 visible requirements each. Prepare scoring sheet. Pilot three prompts with HourMeng, revise, freeze all 18. | Eighteen approved prompts, checklists, rubric, pilot record |
| 3 | Independently score the 27 images for P01–P09. Check prompts, settings, seeds, filenames. Record evidence for failures, artifacts, low usefulness. | 27 registered images and first independent scores |
| 4 | Score P10–P18. Finish all independent scores before comparison. Resolve large differences with HourMeng. Select three strong and three weak examples. | All 54 evaluations, resolved scores, six evidence examples |
| 5 | Finalize dataset. Calculate averages. Create four charts. Draft results and discussion. | Final analysis, four charts, results draft |
| 6 | Finalize report tables, examples, limitations, appendices. Build 8–10 slides with HourMeng. Present design, visual results, ranking, responsible use. | Report sections, assigned slides, speaking role |

### HourMeng (Student 2)

| Day | Tasks | Deliverable |
| --- | --- | --- |
| 1 | Record computer spec **before** install. Install ComfyUI Desktop. Confirm GPU. Download and run SD 1.5. Save first workflow JSON, setup log, screenshots of successful local generation. | Hardware sheet, working ComfyUI, SD 1.5 workflow, evidence |
| 2 | Install SDXL Base and SDXL Turbo. One workflow each. Set fixed benchmark values. Test DynamicVRAM or low VRAM. Export all three locked workflow JSON files. | Three working models, smoke-test table, three locked workflows |
| 3 | Generate P01–P09 once with all three models. Save 27 original PNGs, metadata, time, settings, peak VRAM. One model and one image at a time. | 27 benchmark images and complete performance fields |
| 4 | Generate P10–P18 on all three models. Audit all 54 IDs. Independently score every image. | Complete 54-image dataset, audit report, independent scores |
| 5 | Comparison gallery (this toolkit). Setup and usage instructions. Technical findings. | Working gallery, source files, README, technical findings |
| 6 | Package workflows, gallery, reproducible setup. Support report and slides. Demonstrate local generation, explain 8 GB VRAM limits, present technical recommendation. | Technical package, setup guide, assigned slides, demonstration |

---

## 16. Report, slides, and recommendation

Report length: 6–8 pages excluding appendices. Use the team’s own words. Cite the official model page for every model description and license statement.

**Report sections:** title and executive summary; introduction; model background; technical setup; methodology; results; discussion; conclusion; future work; references and appendices.

**Presentation:** 12 minutes team talk, 3 minutes ComfyUI + gallery demo, 5 minutes questions. 8–10 slides.

- Bosba (~6 min): question, prompt design, scoring, visual results, charts, ranking
- HourMeng (~6 min): installation, workflows, speed, VRAM, technical recommendation, demo

Slide order is in the official PDF (title → what diffusion is → computer spec → three models → 18-prompt benchmark → rubric → quality results → time/VRAM/failures → gallery demo → recommendation).

**Final recommendation must:**

- Name the recommended model for an 8 GB VRAM computer
- Support it with quality, adherence, speed, and memory evidence
- Explain at least three limitations
- Identify when a faster or higher-quality model may be more appropriate
- Describe fine-tuning or LoRA only as possible **future** work

---

## 17. Mandatory rules

- Do not fine-tune, train, or merge a model during these six days.
- Use the same computer, prompt, resolution, and seed for each core comparison.
- Do not regenerate, replace, or hide an unsuccessful image.
- Do not create sexual, hateful, violent, deceptive, or discriminatory content.
- Do not imitate a real person or use a student’s face without written consent.
- Do not use living artist names, copyrighted characters, or brand logos in prompts.
- Do not expose the local ComfyUI service to the public internet.
- Check model licenses before any public or commercial use.

Completion standard: another student can follow the README, load the workflows, reproduce the 54-image benchmark, inspect the full dataset, and understand why the team selected its recommended model.

---

## 18. How this repo is used vs ComfyUI Desktop

| Work | Where |
| --- | --- |
| Install ComfyUI, load checkpoints, run workflows, generate PNGs | ComfyUI Desktop on the Windows laptop |
| Record `Computer_info.json` | `python scripts/collect_computer_info.py` on that laptop |
| Freeze 18 prompts and seeds | `benchmark/prompts/prompts.json` |
| File PNGs | `benchmark/images/core/{SD15,SDXL,TURBO}/` |
| Enter time / VRAM / errors | Toolkit Gallery / dataset form |
| Independent scoring and PDF | Toolkit Scoring page |
| Side-by-side comparison | Toolkit Gallery page |
| Four charts | Toolkit Charts page |
| Personal daily checklist | Toolkit Progress page (saved under `.progress/`, gitignored) |

There is no “generate 18 prompts at once” button. HourMeng uses the **Prompts and run sheet** page as a checklist and generates **one image at a time** in ComfyUI.

---

## 19. Software phases in this repository

The toolkit was built in six phases. Remaining internship work is the six-day student schedule above, not more product features.

1. This instruction pack
2. Remove unrelated studio code; hardware capture script; `benchmark/` tree
3. Prompt template; independent scoring; PDF export
4. Dataset ingest; per-image metadata; comparison gallery
5. Charts, calculations, README, workflow slots
6. Gitignored HourMeng / Bosba progress tracker
