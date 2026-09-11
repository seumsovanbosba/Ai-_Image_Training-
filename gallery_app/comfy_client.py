"""Talk to a local ComfyUI Desktop instance (127.0.0.1 only)."""

from __future__ import annotations

import json
import subprocess
import time
import uuid
from dataclasses import dataclass, field
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlparse
from urllib.request import Request, urlopen

DEFAULT_BASE = "http://127.0.0.1:8188"
ALLOWED_HOSTS = {"127.0.0.1", "localhost"}


class ComfyError(RuntimeError):
    pass


def validate_base_url(base: str) -> str:
    raw = (base or DEFAULT_BASE).strip().rstrip("/")
    parsed = urlparse(raw if "://" in raw else f"http://{raw}")
    host = (parsed.hostname or "").lower()
    if host not in ALLOWED_HOSTS:
        raise ComfyError(
            f"ComfyUI URL must be local ({', '.join(sorted(ALLOWED_HOSTS))}), not {host!r}. "
            "Do not expose ComfyUI to the network."
        )
    scheme = parsed.scheme or "http"
    port = parsed.port or (443 if scheme == "https" else 8188)
    return f"{scheme}://{parsed.hostname}:{port}"


def _request(url: str, *, data: dict | None = None, timeout: float = 30) -> Any:
    body = None
    headers = {"Accept": "application/json"}
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = Request(url, data=body, headers=headers, method="POST" if body else "GET")
    try:
        with urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
            ctype = resp.headers.get("Content-Type", "")
            if "json" in ctype or (raw[:1] in (b"{", b"[")):
                return json.loads(raw.decode("utf-8") or "null")
            return raw
    except HTTPError as exc:
        detail = exc.read().decode("utf-8", errors="replace")[:800]
        raise ComfyError(f"ComfyUI HTTP {exc.code}: {detail or exc.reason}") from exc
    except URLError as exc:
        raise ComfyError(
            "Cannot reach ComfyUI. Start ComfyUI Desktop on this computer first "
            f"({url}). {exc.reason}"
        ) from exc
    except TimeoutError as exc:
        raise ComfyError(f"ComfyUI timed out: {url}") from exc


def ping(base: str = DEFAULT_BASE) -> dict[str, Any]:
    url = validate_base_url(base)
    stats = _request(f"{url}/system_stats", timeout=5)
    if not isinstance(stats, dict):
        raise ComfyError("ComfyUI system_stats returned an unexpected response.")
    return stats


def list_checkpoints(base: str = DEFAULT_BASE) -> list[str]:
    url = validate_base_url(base)
    try:
        data = _request(f"{url}/models/checkpoints", timeout=10)
        if isinstance(data, list):
            return [str(x) for x in data]
    except ComfyError:
        pass
    info = None
    try:
        info = _request(f"{url}/object_info/CheckpointLoaderSimple", timeout=10)
    except ComfyError:
        try:
            info = _request(f"{url}/object_info", timeout=30)
        except ComfyError:
            return []
    if isinstance(info, dict):
        node = info.get("CheckpointLoaderSimple") or next(iter(info.values()), {})
        opts = (
            ((node.get("input") or {}).get("required") or {})
            .get("ckpt_name")
        )
        if isinstance(opts, list) and opts and isinstance(opts[0], list):
            return [str(x) for x in opts[0]]
    return []


def vram_from_stats(stats: dict[str, Any] | None) -> float | None:
    if not stats:
        return None
    devices = stats.get("devices") or []
    peaks = []
    for dev in devices:
        total = dev.get("vram_total")
        free = dev.get("vram_free")
        if total is None:
            continue
        try:
            used = float(total) - float(free or 0)
            peaks.append(used / (1024 ** 3))
        except (TypeError, ValueError):
            continue
    return round(max(peaks), 3) if peaks else None


def vram_from_nvidia_smi() -> float | None:
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=memory.used", "--format=csv,noheader,nounits"],
            capture_output=True,
            text=True,
            timeout=5,
            check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        return None
    if result.returncode != 0:
        return None
    values = []
    for line in result.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            values.append(float(line) / 1024.0)
        except ValueError:
            continue
    return round(max(values), 3) if values else None


def sample_vram(base: str) -> float | None:
    used = vram_from_nvidia_smi()
    try:
        stats_used = vram_from_stats(ping(base))
    except ComfyError:
        stats_used = None
    candidates = [x for x in (used, stats_used) if x is not None]
    return max(candidates) if candidates else None


def ram_gb() -> float | None:
    try:
        import psutil  # type: ignore

        return round(psutil.virtual_memory().used / (1024 ** 3), 2)
    except Exception:
        return None


def queue_busy(base: str) -> bool:
    url = validate_base_url(base)
    try:
        data = _request(f"{url}/queue", timeout=5)
    except ComfyError:
        return False
    running = data.get("queue_running") or []
    pending = data.get("queue_pending") or []
    return bool(running or pending)


def _history_error(entry: dict[str, Any]) -> str | None:
    status = entry.get("status") or {}
    messages = status.get("messages") or []
    for item in messages:
        if not isinstance(item, (list, tuple)) or len(item) < 2:
            continue
        kind, payload = item[0], item[1]
        if kind in {"execution_error", "execution_interrupted"}:
            if isinstance(payload, dict):
                return str(payload.get("exception_message") or payload.get("message") or payload)
            return str(payload)
    if status.get("status_str") == "error":
        return "ComfyUI reported execution_error."
    return None


def _first_image_ref(entry: dict[str, Any]) -> dict[str, str] | None:
    outputs = entry.get("outputs") or {}
    for node_out in outputs.values():
        if not isinstance(node_out, dict):
            continue
        images = node_out.get("images") or []
        if images:
            img = images[0]
            return {
                "filename": str(img.get("filename") or ""),
                "subfolder": str(img.get("subfolder") or ""),
                "type": str(img.get("type") or "output"),
            }
    return None


def download_image(base: str, ref: dict[str, str]) -> bytes:
    url = validate_base_url(base)
    query = urlencode(
        {
            "filename": ref["filename"],
            "subfolder": ref.get("subfolder") or "",
            "type": ref.get("type") or "output",
        }
    )
    data = _request(f"{url}/view?{query}", timeout=60)
    if isinstance(data, bytes):
        return data
    raise ComfyError("ComfyUI /view did not return image bytes.")


@dataclass
class GenerateResult:
    ok: bool
    prompt_id: str = ""
    duration_seconds: float | None = None
    peak_vram_gb: float | None = None
    ram_gb: float | None = None
    start_time: str = ""
    comfy_filename: str = ""
    error: str = ""
    status: str = "pending"
    image_bytes: bytes = field(default_factory=bytes)


def generate(
    graph: dict[str, Any],
    *,
    base: str = DEFAULT_BASE,
    timeout_seconds: float = 600,
    poll_interval: float = 0.6,
) -> GenerateResult:
    """Queue one graph. Do not retry. Records peak VRAM while waiting."""
    url = validate_base_url(base)
    if queue_busy(url):
        return GenerateResult(
            ok=False,
            error="ComfyUI is already running a job. Wait for it to finish (one image at a time).",
            status="failed",
        )

    client_id = str(uuid.uuid4())
    start = time.time()
    start_iso = time.strftime("%Y-%m-%dT%H:%M:%S")
    peak = sample_vram(url)
    ram_peak = ram_gb()

    try:
        submitted = _request(
            f"{url}/prompt",
            data={"prompt": graph, "client_id": client_id},
            timeout=30,
        )
    except ComfyError as exc:
        return GenerateResult(ok=False, error=str(exc), status="failed", start_time=start_iso)

    prompt_id = str((submitted or {}).get("prompt_id") or "")
    if not prompt_id:
        node_errors = (submitted or {}).get("node_errors")
        return GenerateResult(
            ok=False,
            error=f"ComfyUI rejected the workflow: {node_errors or submitted}",
            status="failed",
            start_time=start_iso,
        )

    deadline = time.time() + timeout_seconds
    last_error = ""
    while time.time() < deadline:
        now_v = sample_vram(url)
        if now_v is not None:
            peak = now_v if peak is None else max(peak, now_v)
        now_r = ram_gb()
        if now_r is not None:
            ram_peak = now_r if ram_peak is None else max(ram_peak, now_r)

        try:
            history = _request(f"{url}/history/{prompt_id}", timeout=10)
        except ComfyError as exc:
            last_error = str(exc)
            time.sleep(poll_interval)
            continue

        entry = None
        if isinstance(history, dict):
            entry = history.get(prompt_id) or (history if "outputs" in history else None)
        if entry:
            err = _history_error(entry)
            duration = round(time.time() - start, 3)
            if err:
                status = "oom" if "memory" in err.lower() or "oom" in err.lower() else "failed"
                return GenerateResult(
                    ok=False,
                    prompt_id=prompt_id,
                    duration_seconds=duration,
                    peak_vram_gb=peak,
                    ram_gb=ram_peak,
                    start_time=start_iso,
                    error=err,
                    status=status,
                )
            ref = _first_image_ref(entry)
            if ref and ref.get("filename"):
                try:
                    image_bytes = download_image(url, ref)
                except ComfyError as exc:
                    return GenerateResult(
                        ok=False,
                        prompt_id=prompt_id,
                        duration_seconds=duration,
                        peak_vram_gb=peak,
                        ram_gb=ram_peak,
                        start_time=start_iso,
                        error=str(exc),
                        status="failed",
                    )
                return GenerateResult(
                    ok=True,
                    prompt_id=prompt_id,
                    duration_seconds=duration,
                    peak_vram_gb=peak,
                    ram_gb=ram_peak,
                    start_time=start_iso,
                    comfy_filename=ref["filename"],
                    status="completed",
                    image_bytes=image_bytes,
                )
        time.sleep(poll_interval)

    return GenerateResult(
        ok=False,
        prompt_id=prompt_id,
        duration_seconds=round(time.time() - start, 3),
        peak_vram_gb=peak,
        ram_gb=ram_peak,
        start_time=start_iso,
        error=last_error or f"Timed out after {timeout_seconds:.0f}s waiting for ComfyUI.",
        status="failed",
    )
