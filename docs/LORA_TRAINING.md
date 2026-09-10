# SDXL LoRA training checklist (Windows 11 GPU PC)

Train on the machine that has the GPU. The Linux laptop in this repo only holds the studio UI and the ComfyUI graphs. After training, copy the small `.safetensors` LoRA into `models/loras/` and restart `start.bat`.

You do **not** compile an AI model like C++. Training writes **weights** into a file. `.safetensors` is that file. Kohya already saves `my_lora.safetensors` when it finishes.

Target roughly **12 GB+ VRAM** (24 GB is more comfortable).

## 0. Decide what you are teaching

Pick **one** concept:

- A person / character (face + body, many angles)
- A product / object
- An art style (paintings or photos with a consistent look)

Do not mix “my face + anime style + this brand logo” in the first LoRA.

## 1. Get the base model

Frozen SDXL base, already expected by this project:

`models/checkpoints/sd_xl_base_1.0.safetensors`

(~6.5 GB, [Stability AI on Hugging Face](https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0))

Training **reads** this file. It does not replace it unless you later merge.

## 2. Build a small, clean dataset

| Kind | How many images | Notes |
|---|---|---|
| Person / character | 15–40 | Different angles, lighting, clothes. Crop face reasonably. No other people. |
| Object / product | 15–30 | Plain-ish backgrounds help. |
| Style | 30–80 | Same look, varied subjects. |

Rules:

- Same quality bar (no tiny blurry phone shots mixed with 8K)
- Square-ish, not extreme panoramas
- Short side around **1024** (SDXL native)
- Strip watermarks, text, other people’s faces
- For a person: front, 3/4, side, different expressions

From this repo, on the GPU PC:

```bat
python scripts/prepare_lora_dataset.py --input D:\photos\character --output D:\lora_data --trigger "ohwx person" --repeats 10
```

That writes:

```text
D:\lora_data\img\
  10_ohwx person\
    001.png
    001.txt
    002.png
    002.txt
```

The `10_` prefix means “repeat each image 10 times per epoch.” Start around **5–15**.

## 3. Caption every image

Each image gets a `.txt` with the same name. Use a **trigger word** that almost never appears in English:

```text
ohwx person, woman standing outdoors, brown jacket, daylight, looking at camera
```

- Trigger: `ohwx person` (or `sks toy`, `mybrand bottle`)
- Rest of the caption: what is actually in the photo
- For style LoRAs, put the trigger first and describe the scene
- Draft with WD14 / BLIP if you want, then **edit by hand**

## 4. Install a trainer

Easiest GUI: [Kohya ss GUI](https://github.com/bmaltais/kohya_ss) wrapping [kohya-ss/sd-scripts](https://github.com/kohya-ss/sd-scripts)

Point it at:

- Pretrained model = `sd_xl_base_1.0.safetensors`
- Image folder = the `img/` directory from step 2
- Output folder = e.g. `trained_loras/`

Tick **SDXL**. Save as **safetensors**.

## 5. Starting settings (SDXL LoRA)

| Setting | Start here |
|---|---|
| Resolution | 1024, enable aspect-ratio buckets |
| Network rank (dim) | 16–32 (character), 32–64 (style) |
| Network alpha | same as rank, or rank/2 |
| UNet learning rate | `1e-4` with AdamW8bit |
| Text encoder LR | `1e-5` or **off** at first |
| Mixed precision | **bf16** on RTX 30/40 |
| Optimizer | AdamW8bit, or Adafactor if VRAM is tight |
| Batch size | 1 or 2 |
| Gradient checkpointing | on |
| Cache latents | on |
| Epochs | 5–15, **save every epoch** |
| Steps (rough) | ~1500–3000 total for a small character set |

## 6. Train and keep checkpoints

Keep several files:

```text
my_character-000006.safetensors
my_character-000008.safetensors
my_character-000010.safetensors
```

**Overfit** looks like: it only recreates the training photos, hands/faces collapse, or the trigger is ignored unless you copy a training caption. Use an earlier epoch if that happens.

## 7. Test in this studio

LoRA is **not** a replacement for SDXL. Load both:

1. Base: `models/checkpoints/sd_xl_base_1.0.safetensors`
2. LoRA: copy into `models/loras/my_character.safetensors`

Restart `start.bat`. In the prompt dock, pick the LoRA and set strength **0.7–1.0**. The prompt must include the trigger:

```text
ohwx person walking a dog on a sunlit street, photograph
```

## 8. Share it

Upload the **small** LoRA (often 20–200 MB), plus a note:

- Base model: SDXL 1.0
- Trigger: `ohwx person`
- Suggested strength: 0.7–1.0

Others still need their own copy of SDXL base. Do not ship the 6.5 GB file unless the license and the assignment allow it.

## Videos

Concepts first, then a Kohya walkthrough.

1. [How does Stable Diffusion work? Latent Diffusion Models EXPLAINED](https://www.youtube.com/watch?v=J87hffSMB60)
2. [LoRA vs DreamBooth vs Textual Inversion vs Hypernetworks](https://www.youtube.com/watch?v=dVjMiJsuR5o)
3. [First Ever SDXL Training With Kohya LoRA](https://www.youtube.com/watch?v=AY6DMBCIZ3A) — SECourses
4. [Generate Studio Quality Realistic Photos By Kohya LoRA](https://www.youtube.com/watch?v=TpuDOsuKIBo) — SECourses

Written:

- [Civitai: Essential Guide to Training SDXL 1.0](https://education.civitai.com/sdxl-1-0-training-overview/)
- [Hugging Face: LoRA training for SDXL](https://huggingface.co/blog/sdxl_lora_advanced_script)
- Kohya: `sdxl_train_network.py` in [kohya-ss/sd-scripts](https://github.com/kohya-ss/sd-scripts)

## What `.safetensors` is

Weights only. Not an `.exe`. Not GGUF / Ollama (those are chat models).

Path A (what you should do): Kohya `--save_model_as=safetensors` → copy into `models/loras/`. Done.

Path D (optional): bake the LoRA into a new 6+ GB checkpoint. Users then need only one file, but you cannot turn the LoRA off.
