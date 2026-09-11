"""Streamlit page: one-image generate via local ComfyUI."""

from __future__ import annotations

import json

import streamlit as st

from gallery_app.comfy_client import DEFAULT_BASE, ComfyError, list_checkpoints, ping, validate_base_url
from gallery_app.constants import MODEL_CODES, MODELS, PILOT_PROMPT_IDS, PROMPT_IDS, image_id
from gallery_app.dataset import sync_from_prompts_and_disk
from gallery_app.generate_job import Blocked, run_core_image, run_warmup, workflow_note
from gallery_app.paths import COMPUTER_INFO, image_path, warmup_path
from gallery_app.prompts import load_prompts, prompt_by_id, prompt_issues


def _default_checkpoint(model_code: str) -> str:
    typical = MODELS[model_code]["typical_checkpoint"]
    if not COMPUTER_INFO.exists():
        return typical
    try:
        info = json.loads(COMPUTER_INFO.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return typical
    for item in info.get("checkpoints") or []:
        if item.get("model_code") == model_code and item.get("filename"):
            return str(item["filename"])
    return typical


def _comfy_status(base: str) -> tuple[bool, str, list[str]]:
    try:
        url = validate_base_url(base)
        stats = ping(url)
        ckpts = list_checkpoints(url)
    except ComfyError as exc:
        return False, str(exc), []
    devices = stats.get("devices") or []
    names = ", ".join(str(d.get("name") or "GPU") for d in devices) or "unknown GPU"
    return True, f"ComfyUI online ({names})", ckpts


def page_generate() -> None:
    st.title("Generate (one image)")
    st.markdown(
        "This page talks to **ComfyUI Desktop on this computer** only. "
        "One model, one prompt, one click. It copies the PNG into the benchmark folder "
        "and writes time / peak VRAM / seed into `dataset.json`. "
        "It will not replace an image that already exists."
    )

    base = st.text_input("ComfyUI URL", value=st.session_state.get("comfy_url", DEFAULT_BASE))
    st.session_state["comfy_url"] = base
    online, status_text, ckpts = _comfy_status(base)
    if online:
        st.success(status_text)
    else:
        st.error(status_text)
        st.info("On Bosba's laptop: start ComfyUI Desktop, wait until it is idle, then refresh this page.")
        return

    kind = st.radio("Job type", ["Core benchmark image", "Warm-up (excluded from scores)"], horizontal=True)
    model_code = st.selectbox(
        "Model (load only this checkpoint)",
        MODEL_CODES,
        format_func=lambda c: f"{c} — {MODELS[c]['name']} · {MODELS[c]['steps']} steps · CFG {MODELS[c]['cfg']}",
    )
    st.caption(workflow_note(model_code))

    options = ckpts or [_default_checkpoint(model_code)]
    default_ckpt = _default_checkpoint(model_code)
    index = options.index(default_ckpt) if default_ckpt in options else 0
    checkpoint = st.selectbox("Checkpoint filename (must exist in ComfyUI models/checkpoints)", options, index=index)
    extra = st.text_input("Or type a checkpoint filename", value="")
    if extra.strip():
        checkpoint = extra.strip()

    if kind.startswith("Warm-up"):
        dest = warmup_path(model_code)
        st.write(f"Will save to `{dest}`")
        if dest.is_file():
            st.warning(f"{dest.name} already exists. Warm-ups are generated once.")
            st.image(str(dest))
            return
        if st.button("Generate warm-up", type="primary", disabled=not online):
            with st.spinner("Queueing one warm-up in ComfyUI…"):
                try:
                    result = run_warmup(model_code=model_code, checkpoint=checkpoint, base_url=base)
                except Blocked as exc:
                    st.error(str(exc))
                    return
            _show_result(result, dest if dest.is_file() else None)
        return

    prompts = load_prompts()
    dataset = sync_from_prompts_and_disk()
    if not prompts.get("frozen"):
        st.warning("Prompts are not frozen yet. Freeze them on the Prompts page before scored collection.")
    pid = st.selectbox(
        "Prompt",
        PROMPT_IDS,
        format_func=lambda p: f"{p} — {prompt_by_id(prompts, p)['category']}",
    )
    prompt = prompt_by_id(prompts, pid)
    issues = prompt_issues(prompt)
    st.markdown(f"**Prompt.** {prompt.get('prompt')}")
    st.caption(f"Seed {prompt.get('seed')} · empty negative · 512×512 · {MODELS[model_code]['steps']} steps · CFG {MODELS[model_code]['cfg']}")
    if pid in PILOT_PROMPT_IDS:
        st.info(f"{pid} is a suggested pilot prompt.")
    if issues:
        st.error(" ".join(issues))

    dest = image_path(pid, model_code)
    key = image_id(pid, model_code)
    rec = dataset["images"][key]
    st.write(f"Will save to `{dest}`")
    if dest.is_file():
        st.error(f"{dest.name} already exists. Do not regenerate. Score this file instead.")
        st.image(str(dest))
        st.json(
            {
                "duration_s": rec.get("generation_duration_seconds"),
                "peak_vram_gb": rec.get("peak_vram_gb"),
                "status": rec.get("completion_status"),
            }
        )
        return

    allow_unfrozen = False
    if issues or not prompts.get("frozen"):
        allow_unfrozen = st.checkbox(
            "Generate anyway (counts as the one official attempt if a PNG is saved)"
        )

    if st.button("Generate this image once", type="primary", disabled=not online):
        if (issues or not prompts.get("frozen")) and not allow_unfrozen:
            st.error("Freeze a finished prompt, or tick the override box.")
            return
        with st.spinner(f"Generating {key} in ComfyUI (one job)…"):
            try:
                result = run_core_image(
                    prompt_id=pid,
                    model_code=model_code,
                    checkpoint=checkpoint,
                    base_url=base,
                    allow_unfrozen=allow_unfrozen,
                )
            except Blocked as exc:
                st.error(str(exc))
                return
        _show_result(result, dest if dest.is_file() else None)


def _show_result(result, image_file) -> None:
    if result.ok:
        st.success(
            f"Saved. {result.duration_seconds}s · peak VRAM {result.peak_vram_gb} GB · "
            f"RAM {result.ram_gb} GB"
        )
        if image_file is not None:
            st.image(str(image_file))
    else:
        st.error(result.error or "Generation failed.")
        st.caption(
            f"Logged as {result.status}. Duration {result.duration_seconds}s · "
            f"peak VRAM {result.peak_vram_gb} GB. This attempt is recorded; do not hide it."
        )
