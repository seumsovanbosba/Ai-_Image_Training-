import sys
import time
import urllib.request
from pathlib import Path

SDXL_URL = "https://huggingface.co/stabilityai/stable-diffusion-xl-base-1.0/resolve/main/sd_xl_base_1.0.safetensors"
DEST_PATH = Path(__file__).resolve().parent.parent / "models" / "checkpoints" / "sd_xl_base_1.0.safetensors"

def download_file_with_retry(url: str, target: Path, max_retries=50):
    target.parent.mkdir(parents=True, exist_ok=True)
    temp_target = target.with_suffix(".safetensors.part")

    retries = 0
    while retries < max_retries:
        downloaded = 0
        if temp_target.exists():
            downloaded = temp_target.stat().st_size

        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "AntigravityDownloader/1.0",
            }
        )
        if downloaded > 0:
            req.add_header("Range", f"bytes={downloaded}-")

        print(f"[INFO] Connecting (Attempt {retries + 1}/{max_retries})...")
        if downloaded > 0:
            print(f"[INFO] Resuming from {downloaded / (1024**3):.2f} GB...")

        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                content_length = resp.headers.get("Content-Length")
                total_bytes = int(content_length) + downloaded if content_length else None

                mode = "ab" if downloaded > 0 else "wb"
                start_time = time.time()
                bytes_since_log = 0
                last_log_time = start_time

                with open(temp_target, mode) as f:
                    while True:
                        chunk = resp.read(1024 * 1024 * 2)  # 2MB chunks
                        if not chunk:
                            break
                        f.write(chunk)
                        downloaded += len(chunk)
                        bytes_since_log += len(chunk)

                        now = time.time()
                        if now - last_log_time >= 3.0:
                            speed_mb = (bytes_since_log / (1024**2)) / (now - last_log_time)
                            if total_bytes:
                                pct = (downloaded / total_bytes) * 100
                                print(f"[DOWNLOAD] {downloaded / (1024**3):.2f} GB / {total_bytes / (1024**3):.2f} GB ({pct:.1f}%) - {speed_mb:.1f} MB/s", flush=True)
                            else:
                                print(f"[DOWNLOAD] {downloaded / (1024**2):.1f} MB downloaded - {speed_mb:.1f} MB/s", flush=True)
                            bytes_since_log = 0
                            last_log_time = now

            # If completed successfully
            if temp_target.exists():
                temp_target.rename(target)
                print(f"\n[SUCCESS] Model successfully downloaded and verified: {target}")
                print(f"          Final Size: {target.stat().st_size / (1024**3):.2f} GB")
                return True
        except Exception as e:
            retries += 1
            print(f"\n[WARN] Connection issue: {e}. Retrying in 5s ({retries}/{max_retries})...", flush=True)
            time.sleep(5)

    print("\n[ERROR] Reached maximum retries.")
    sys.exit(1)

if __name__ == "__main__":
    download_file_with_retry(SDXL_URL, DEST_PATH)
