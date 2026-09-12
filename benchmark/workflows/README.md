# Locked ComfyUI workflows

The Generate page talks to ComfyUI Desktop over `http://127.0.0.1:8188`.

If these files stay as placeholders, Generate uses a built-in text-to-image graph (checkpoint + CLIP + KSampler + VAE + Save Image) with the locked 512x512 / steps / CFG / seed.

To use your own locked graph:

1. In ComfyUI, enable **Dev Mode**.
2. **Save (API Format)** — not the default UI workflow JSON.
3. Overwrite:

- `SD15.json` — Stable Diffusion 1.5, 512x512, 25 steps, CFG 7, batch 1, empty negative prompt
- `SDXL.json` — SDXL Base 1.0, 512x512, 25 steps, CFG 7, batch 1, empty negative prompt
- `TURBO.json` — SDXL Turbo, 512x512, 4 steps, CFG 1, batch 1, empty negative prompt

Generate will then patch prompt, seed, steps, CFG, and checkpoint into that API graph. Do not change locked settings after freeze.
