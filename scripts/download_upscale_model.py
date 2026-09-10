#!/usr/bin/env python3
"""Download RealESRGAN_x4plus.pth into models/upscale_models/.

Run this once on the GPU PC (Windows 11) that has network access, then restart
start.bat. The file is gitignored; do not commit the weights.
"""
import sys
import time
import urllib.request
from pathlib import Path

URL = "https://github.com/xinntao/Real-ESRGAN/releases/download/v0.1.0/RealESRGAN_x4plus.pth"
DEST = Path(__file__).resolve().parent.parent / "models" / "upscale_models" / "RealESRGAN_x4plus.pth"


def download(url: str, target: Path, max_retries: int = 30):
    target.parent.mkdir(parents=True, exist_ok=True)
    temp = target.with_suffix(target.suffix + ".part")
    retries = 0
    while retries < max_retries:
        downloaded = temp.stat().st_size if temp.exists() else 0
        req = urllib.request.Request(url, headers={"User-Agent": "AntigravityDownloader/1.0"})
        if downloaded > 0:
            req.add_header("Range", f"bytes={downloaded}-")
            print(f"[INFO] Resuming from {downloaded / (1024 ** 2):.1f} MB...")
        print(f"[INFO] Connecting (attempt {retries + 1}/{max_retries})...")
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                total_header = resp.headers.get("Content-Length")
                total = int(total_header) + downloaded if total_header else None
                mode = "ab" if downloaded > 0 else "wb"
                last_log = time.time()
                chunk_bytes = 0
                with open(temp, mode) as f:
                    while True:
                        chunk = resp.read(1024 * 1024)
                        if not chunk:
                            break
                        f.write(chunk)
                        downloaded += len(chunk)
                        chunk_bytes += len(chunk)
                        now = time.time()
                        if now - last_log >= 2:
                            speed = (chunk_bytes / (1024 ** 2)) / max(now - last_log, 0.001)
                            if total:
                                pct = downloaded / total * 100
                                print(f"[DOWNLOAD] {downloaded / (1024 ** 2):.1f} / {total / (1024 ** 2):.1f} MB ({pct:.1f}%) {speed:.1f} MB/s", flush=True)
                            else:
                                print(f"[DOWNLOAD] {downloaded / (1024 ** 2):.1f} MB {speed:.1f} MB/s", flush=True)
                            last_log = now
                            chunk_bytes = 0
            temp.replace(target)
            print(f"[OK] Saved {target} ({target.stat().st_size / (1024 ** 2):.1f} MB)")
            return
        except Exception as exc:
            retries += 1
            print(f"[WARN] {exc}")
            time.sleep(min(2 * retries, 15))
    print("[ERROR] Download failed. Copy RealESRGAN_x4plus.pth into models/upscale_models/ manually.")
    sys.exit(1)


if __name__ == "__main__":
    if DEST.exists() and DEST.stat().st_size > 10 * 1024 * 1024:
        print(f"[OK] Already present: {DEST}")
        sys.exit(0)
    download(URL, DEST)
