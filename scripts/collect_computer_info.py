#!/usr/bin/env python3
"""Collect computer specifications into benchmark/Computer_info.json.

Run on Bosba's Windows 11 laptop before installing ComfyUI, then again after
ComfyUI Desktop and the three checkpoints are in place.

    python scripts/collect_computer_info.py --stage before-install
    python scripts/collect_computer_info.py --stage after-install
"""

from __future__ import annotations

import argparse
import json
import os
import platform
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parent.parent
OUT_PATH = ROOT / "benchmark" / "Computer_info.json"


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def run_cmd(cmd: list[str] | str, shell: bool = False) -> str | None:
    try:
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=20,
            shell=shell,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if result.returncode != 0:
        return None
    text = (result.stdout or "").strip()
    return text or None


def gb(num_bytes: float) -> float:
    return round(num_bytes / (1024 ** 3), 2)


def collect_os() -> dict[str, Any]:
    return {
        "system": platform.system(),
        "release": platform.release(),
        "version": platform.version(),
        "platform": platform.platform(),
        "machine": platform.machine(),
        "python": sys.version.split()[0],
    }


def collect_cpu() -> dict[str, Any]:
    model = platform.processor() or ""
    system = platform.system()
    if system == "Linux":
        cpuinfo = Path("/proc/cpuinfo")
        if cpuinfo.exists():
            for line in cpuinfo.read_text(encoding="utf-8", errors="ignore").splitlines():
                if line.lower().startswith("model name"):
                    model = line.split(":", 1)[1].strip()
                    break
    elif system == "Windows":
        ps = run_cmd(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                "(Get-CimInstance Win32_Processor).Name",
            ]
        )
        if ps:
            model = ps.splitlines()[0].strip()
    elif system == "Darwin":
        brand = run_cmd(["sysctl", "-n", "machdep.cpu.brand_string"])
        if brand:
            model = brand
    cores = os.cpu_count()
    return {"model": model or "unknown", "logical_cores": cores}


def collect_ram() -> dict[str, Any]:
    try:
        import psutil  # type: ignore

        vm = psutil.virtual_memory()
        return {
            "total_gb": gb(vm.total),
            "available_gb": gb(vm.available),
            "source": "psutil",
        }
    except Exception:
        pass

    if platform.system() == "Linux":
        meminfo = Path("/proc/meminfo")
        if meminfo.exists():
            total_kb = available_kb = None
            for line in meminfo.read_text(encoding="utf-8", errors="ignore").splitlines():
                if line.startswith("MemTotal:"):
                    total_kb = int(line.split()[1])
                elif line.startswith("MemAvailable:"):
                    available_kb = int(line.split()[1])
            if total_kb:
                return {
                    "total_gb": round(total_kb / (1024 ** 2), 2),
                    "available_gb": round((available_kb or 0) / (1024 ** 2), 2),
                    "source": "/proc/meminfo",
                }
    if platform.system() == "Windows":
        ps = run_cmd(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                "(Get-CimInstance Win32_ComputerSystem).TotalPhysicalMemory",
            ]
        )
        if ps and ps.isdigit():
            return {
                "total_gb": gb(int(ps)),
                "available_gb": None,
                "source": "Win32_ComputerSystem",
            }
    return {"total_gb": None, "available_gb": None, "source": "unavailable"}


def collect_gpu() -> dict[str, Any]:
    smi = run_cmd(
        [
            "nvidia-smi",
            "--query-gpu=name,driver_version,memory.total,memory.free",
            "--format=csv,noheader,nounits",
        ]
    )
    if smi:
        first = smi.splitlines()[0]
        parts = [p.strip() for p in first.split(",")]
        if len(parts) >= 4:
            try:
                total_mb = float(parts[2])
                free_mb = float(parts[3])
            except ValueError:
                total_mb = free_mb = None
            return {
                "model": parts[0],
                "driver_version": parts[1],
                "vram_total_mb": total_mb,
                "vram_available_mb": free_mb,
                "vram_total_gb": round(total_mb / 1024, 2) if total_mb is not None else None,
                "source": "nvidia-smi",
            }

    if platform.system() == "Windows":
        ps = run_cmd(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                "(Get-CimInstance Win32_VideoController | Select-Object -First 1).Name",
            ]
        )
        driver = run_cmd(
            [
                "powershell",
                "-NoProfile",
                "-Command",
                "(Get-CimInstance Win32_VideoController | Select-Object -First 1).DriverVersion",
            ]
        )
        if ps:
            return {
                "model": ps.splitlines()[0].strip(),
                "driver_version": (driver or "").splitlines()[0].strip() if driver else None,
                "vram_total_mb": None,
                "vram_available_mb": None,
                "vram_total_gb": None,
                "source": "Win32_VideoController",
            }

    if platform.system() == "Linux":
        lspci = run_cmd(["lspci"])
        if lspci:
            for line in lspci.splitlines():
                if "VGA" in line or "3D controller" in line:
                    return {
                        "model": line.split(":", 2)[-1].strip() if ":" in line else line,
                        "driver_version": None,
                        "vram_total_mb": None,
                        "vram_available_mb": None,
                        "vram_total_gb": None,
                        "source": "lspci",
                    }

    return {
        "model": "unknown",
        "driver_version": None,
        "vram_total_mb": None,
        "vram_available_mb": None,
        "vram_total_gb": None,
        "source": "unavailable",
    }


def collect_disk(path: Path) -> dict[str, Any]:
    usage = shutil.disk_usage(path)
    return {
        "path": str(path),
        "total_gb": gb(usage.total),
        "used_gb": gb(usage.used),
        "free_gb": gb(usage.free),
    }


def snapshot() -> dict[str, Any]:
    return {
        "collected_at": now_iso(),
        "hostname": platform.node(),
        "operating_system": collect_os(),
        "cpu": collect_cpu(),
        "system_ram": collect_ram(),
        "gpu": collect_gpu(),
        "disk": collect_disk(ROOT),
    }


def load_existing() -> dict[str, Any]:
    if OUT_PATH.exists():
        with OUT_PATH.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    return {
        "schema_version": 1,
        "project": "KiTH open source image generation benchmark",
        "before_install": None,
        "after_install": None,
        "comfyui": {
            "version": "",
            "build_date": "",
            "install_path": "",
        },
        "checkpoints": [],
    }


def parse_checkpoint(item: str) -> dict[str, str]:
    if "|" in item:
        filename, source = item.split("|", 1)
    else:
        filename, source = item, ""
    return {"filename": filename.strip(), "download_source": source.strip()}


def collect(
    stage: str,
    comfyui_version: str | None = None,
    comfyui_build_date: str | None = None,
    comfyui_install_path: str | None = None,
    checkpoints: list[str] | None = None,
) -> dict[str, Any]:
    data = load_existing()
    snap = snapshot()
    if stage == "before-install":
        data["before_install"] = snap
    elif stage == "after-install":
        data["after_install"] = snap
    else:
        raise ValueError(f"Unknown stage: {stage}")

    if comfyui_version:
        data.setdefault("comfyui", {})["version"] = comfyui_version
    if comfyui_build_date:
        data.setdefault("comfyui", {})["build_date"] = comfyui_build_date
    if comfyui_install_path:
        data.setdefault("comfyui", {})["install_path"] = comfyui_install_path
    if checkpoints:
        data["checkpoints"] = [parse_checkpoint(item) for item in checkpoints]

    data["last_updated"] = now_iso()
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    tmp = OUT_PATH.with_suffix(".json.tmp")
    with tmp.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
    tmp.replace(OUT_PATH)
    return data


def main() -> int:
    parser = argparse.ArgumentParser(description="Record Computer_info.json for the KiTH benchmark.")
    parser.add_argument(
        "--stage",
        required=True,
        choices=["before-install", "after-install"],
        help="before-install must run before ComfyUI is installed.",
    )
    parser.add_argument("--comfyui-version", default=None)
    parser.add_argument("--comfyui-build-date", default=None)
    parser.add_argument("--comfyui-install-path", default=None)
    parser.add_argument(
        "--checkpoint",
        action="append",
        default=[],
        help='Repeatable. Format: "filename.safetensors|https://official-source"',
    )
    args = parser.parse_args()
    data = collect(
        args.stage,
        comfyui_version=args.comfyui_version,
        comfyui_build_date=args.comfyui_build_date,
        comfyui_install_path=args.comfyui_install_path,
        checkpoints=args.checkpoint or None,
    )
    print(f"Wrote {OUT_PATH}")
    stage_key = "before_install" if args.stage == "before-install" else "after_install"
    block = data.get(stage_key) or {}
    gpu = block.get("gpu") or {}
    disk = block.get("disk") or {}
    print(f"  OS: {block.get('operating_system', {}).get('platform')}")
    print(f"  CPU: {block.get('cpu', {}).get('model')}")
    print(f"  RAM: {block.get('system_ram', {}).get('total_gb')} GB")
    print(f"  GPU: {gpu.get('model')}  driver={gpu.get('driver_version')}  VRAM={gpu.get('vram_total_gb')} GB")
    print(f"  Disk free: {disk.get('free_gb')} GB")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
