#!/usr/bin/env python3
"""Build a Kohya-style SDXL LoRA dataset folder from a folder of photos.

The Golden Rules of LoRA Dataset Preparation:
1. "Caption what you want to control; leave uncapped what you want to be permanent."
   - If your subject wears glasses in some photos, explicitly caption "wearing eyeglasses"
     in the sidecar .txt file so the model disentangles glasses from character identity.
   - If an object appears in every photo without being captioned, the model permanently
     bakes it into the trigger word!
2. Pre-Cleaning Workflow (for unwanted objects present across photos):
   - Raw training images -> Inpaint/remove unwanted object (using Antigravity Inpaint Canvas)
   - Save cleaned images -> Run prepare_lora_dataset.py -> Train with Kohya.

Example (Windows 11 GPU PC):

    python scripts/prepare_lora_dataset.py ^
      --input D:\\photos\\character ^
      --output D:\\lora_data ^
      --trigger "ohwx person" ^
      --repeats 10

Produces:

    D:\\lora_data\\img\\10_ohwx person\\001.png
    D:\\lora_data\\img\\10_ohwx person\\001.txt
    ...

Point Kohya's image folder at D:\\lora_data\\img
"""
from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("Pillow is required. pip install Pillow")
    sys.exit(1)

IMAGE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".bmp"}


def short_side_resize(img: Image.Image, target: int) -> Image.Image:
    w, h = img.size
    short = min(w, h)
    if short == 0:
        return img
    if short == target:
        rgb = img.convert("RGB") if img.mode != "RGB" else img
        return rgb
    scale = target / float(short)
    nw = max(64, int(round(w * scale)))
    nh = max(64, int(round(h * scale)))
    rgb = img.convert("RGB") if img.mode != "RGB" else img
    return rgb.resize((nw, nh), Image.Resampling.LANCZOS)


def caption_for(src: Path, trigger: str) -> str:
    sidecar = src.with_suffix(".txt")
    if sidecar.exists():
        text = sidecar.read_text(encoding="utf-8").strip()
        if text:
            if trigger.lower() not in text.lower():
                return f"{trigger}, {text}"
            return text
    return f"{trigger}, photograph"


def main():
    parser = argparse.ArgumentParser(description="Prepare a Kohya SDXL LoRA image folder")
    parser.add_argument("--input", required=True, help="Folder of source photos")
    parser.add_argument("--output", required=True, help="Dataset root (will contain img/)")
    parser.add_argument("--trigger", default="ohwx person", help="Rare trigger word(s)")
    parser.add_argument("--repeats", type=int, default=10, help="Kohya folder repeat prefix")
    parser.add_argument("--size", type=int, default=1024, help="Resize so the short side is this")
    args = parser.parse_args()

    src_dir = Path(args.input)
    if not src_dir.is_dir():
        print(f"[ERROR] Input folder not found: {src_dir}")
        sys.exit(1)

    class_dir = Path(args.output) / "img" / f"{args.repeats}_{args.trigger}"
    if class_dir.exists():
        shutil.rmtree(class_dir)
    class_dir.mkdir(parents=True, exist_ok=True)

    files = sorted(p for p in src_dir.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_EXTS)
    if not files:
        print(f"[ERROR] No images in {src_dir}")
        sys.exit(1)

    for i, src in enumerate(files, start=1):
        stem = f"{i:03d}"
        try:
            with Image.open(src) as im:
                out = short_side_resize(im, args.size)
                dest_img = class_dir / f"{stem}.png"
                out.save(dest_img, format="PNG")
        except Exception as exc:
            print(f"[WARN] Skip {src.name}: {exc}")
            continue
        (class_dir / f"{stem}.txt").write_text(caption_for(src, args.trigger) + "\n", encoding="utf-8")
        print(f"[OK] {src.name} -> {stem}.png")

    count = len(list(class_dir.glob("*.png")))
    print(f"\n[DONE] {count} images in {class_dir}")
    print("In Kohya GUI: Image folder = the parent img/ directory (not the 10_ trigger folder).")
    print(f"Trigger to use in prompts: {args.trigger}")
    print("\n[NOTE] Concept Disentanglement Check:")
    print("  - 'Caption what you want to control; leave uncapped what you want to be permanent.'")
    print("  - If the character wears glasses/hats in some photos, make sure their .txt sidecars")
    print("    explicitly mention 'wearing eyeglasses' or 'wearing hat' so the accessory remains controllable.")
    print("  - If all photos contain an unwanted object, pre-clean them using the Inpaint Canvas before training.")


if __name__ == "__main__":
    main()
