"""Streamlit entry point for the KiTH local research toolkit."""

from __future__ import annotations

import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

import pandas as pd
import streamlit as st

from gallery_app.charts import chart_series, model_metrics
from gallery_app.constants import (
    CRITERIA,
    EVALUATORS,
    MODEL_CODES,
    MODELS,
    PILOT_PROMPT_IDS,
    PROMPT_IDS,
    RUBRIC,
    all_image_ids,
    image_id,
    split_image_id,
)
from gallery_app.dataset import (
    audit_filenames,
    sync_from_prompts_and_disk,
    update_row,
)
from gallery_app.paths import (
    COMPUTER_INFO,
    ROOT as REPO_ROOT,
    WORKFLOWS,
    image_path,
    native_path,
    warmup_path,
)
from gallery_app.pdf_export import build_scoring_pdf
from gallery_app.progress import counts as progress_counts
from gallery_app.progress import load_progress, save_progress
from gallery_app.prompts import load_prompts, prompt_by_id, prompt_issues, save_prompts
from gallery_app.ui_generate import page_generate
from gallery_app.scoring import (
    both_complete,
    comparison_rows,
    completed_count,
    criterion_keys,
    differences_over_one,
    is_complete_entry,
    load_agreed,
    load_sheet,
    sheet_complete,
    upsert_agreed,
    upsert_score,
)

st.set_page_config(
    page_title="KiTH Benchmark Toolkit",
    layout="wide",
    initial_sidebar_state="expanded",
)


def _inject_css() -> None:
    st.markdown(
        """
        <style>
        .block-container { padding-top: 1.2rem; }
        div[data-testid="stMetric"] { background: #f6f6f4; padding: 0.6rem 0.8rem; border-radius: 8px; }
        </style>
        """,
        unsafe_allow_html=True,
    )


def page_home() -> None:
    st.title("KiTH open-source image generation benchmark")
    st.caption("Local research toolkit for Eang Hourmeng and Soem Sovanbosba. ComfyUI Desktop on this computer runs the models; this app queues one image at a time and stores the logs.")
    st.markdown(
        """
        **Research question.** Which openly available text-to-image model provides the best
        balance of prompt adherence, visual quality, generation speed and memory use on an
        8 GB VRAM computer?

        Use the sidebar:

        1. **Computer info** — capture laptop specs into `Computer_info.json` (before and after install).
        2. **Prompts and run sheet** — freeze 18 prompts.
        3. **Generate** — on the laptop, send **one** prompt to local ComfyUI; PNG + VRAM/time are stored here.
        4. **Scoring** — independent HourMeng / Bosba scores, then agreed scores. Export PDF.
        5. **Gallery** — same prompt, three models side by side, with model / effort / VRAM.
        6. **Charts** — the four required comparisons.
        7. **Progress** — personal checklist (saved in `.progress/`, gitignored).
        """
    )
    prompts = load_prompts()
    data = sync_from_prompts_and_disk()
    hm = load_sheet("hourmeng")
    bb = load_sheet("bosba")
    missing = [k for k in all_image_ids() if not (data.get("images") or {}).get(k, {}).get("png_exists")]
    c1, c2, c3, c4 = st.columns(4)
    c1.metric("Prompts frozen", "Yes" if prompts.get("frozen") else "No")
    c2.metric("Core PNGs on disk", f"{54 - len(missing)} / 54")
    c3.metric("HourMeng scores", f"{completed_count(hm)} / 54")
    c4.metric("Bosba scores", f"{completed_count(bb)} / 54")
    st.info("Read `docs/INTERNSHIP_INSTRUCTION.md` before generating or scoring.")


def page_computer() -> None:
    st.title("Computer information")
    st.markdown(
        "Record specs **before** installing ComfyUI, then again **after** ComfyUI Desktop "
        "and the three checkpoints are in place. Output: `benchmark/Computer_info.json`."
    )
    col_a, col_b = st.columns(2)
    with col_a:
        if st.button("Capture before-install snapshot", type="primary"):
            _run_collect("before-install")
    with col_b:
        if st.button("Capture after-install snapshot"):
            _run_collect("after-install")

    st.subheader("ComfyUI and checkpoints (fill on the laptop)")
    info = _load_computer_info()
    comfy = info.get("comfyui") or {}
    version = st.text_input("ComfyUI version or build number", value=comfy.get("version") or "")
    build = st.text_input("ComfyUI build date", value=comfy.get("build_date") or "")
    install_path = st.text_input("ComfyUI install path", value=comfy.get("install_path") or "")
    st.caption("Checkpoint lines: `filename.safetensors | https://official-model-page`")
    existing = info.get("checkpoints") or []
    default_lines = "\n".join(
        f"{c.get('filename', '')} | {c.get('download_source', '')}".strip(" |")
        for c in existing
    ) or "\n".join(
        f"{MODELS[code]['typical_checkpoint']} | {MODELS[code]['source']}" for code in MODEL_CODES
    )
    raw = st.text_area("Checkpoints (one per line)", value=default_lines, height=120)
    if st.button("Save ComfyUI version and checkpoints"):
        info["comfyui"] = {
            "version": version.strip(),
            "build_date": build.strip(),
            "install_path": install_path.strip(),
        }
        rows = []
        for line in raw.splitlines():
            line = line.strip()
            if not line:
                continue
            if "|" in line:
                filename, source = line.split("|", 1)
            else:
                filename, source = line, ""
            rows.append({"filename": filename.strip(), "download_source": source.strip()})
        info["checkpoints"] = rows
        _save_computer_info(info)
        st.success(f"Saved {COMPUTER_INFO.relative_to(REPO_ROOT)}")
        st.rerun()

    st.subheader("Current Computer_info.json")
    if COMPUTER_INFO.exists():
        st.json(_load_computer_info())
    else:
        st.warning("No Computer_info.json yet. Run a snapshot on Bosba's Windows laptop.")


def _run_collect(stage: str) -> None:
    scripts = REPO_ROOT / "scripts"
    sys.path.insert(0, str(scripts))
    from collect_computer_info import collect  # type: ignore

    collect(stage)
    st.success(f"Wrote {COMPUTER_INFO.relative_to(REPO_ROOT)} ({stage})")


def _load_computer_info() -> dict:
    if not COMPUTER_INFO.exists():
        return {"comfyui": {}, "checkpoints": []}
    return json.loads(COMPUTER_INFO.read_text(encoding="utf-8"))


def _save_computer_info(info: dict) -> None:
    COMPUTER_INFO.parent.mkdir(parents=True, exist_ok=True)
    COMPUTER_INFO.write_text(json.dumps(info, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def page_prompts() -> None:
    st.title("Eighteen-prompt benchmark and run sheet")
    data = load_prompts()
    frozen = st.checkbox("Prompts are frozen (do not edit after collection starts)", value=bool(data.get("frozen")))
    if frozen != bool(data.get("frozen")):
        data["frozen"] = frozen
        save_prompts(data)
        st.rerun()

    st.markdown(
        f"Pilot IDs: **{', '.join(PILOT_PROMPT_IDS)}**. Empty negative prompt. "
        "Same positive prompt and seed for all three models. Max 45 words."
    )
    pilot = data.setdefault("pilot", {})
    pilot_status = st.selectbox(
        "Pilot status",
        ["not_started", "in_progress", "revised", "complete"],
        index=["not_started", "in_progress", "revised", "complete"].index(pilot.get("status") or "not_started"),
    )
    pilot_notes = st.text_area("Pilot record", value=pilot.get("notes") or "", height=80)
    if st.button("Save pilot record"):
        data["pilot"]["status"] = pilot_status
        data["pilot"]["notes"] = pilot_notes
        save_prompts(data)
        st.success("Pilot record saved.")

    st.subheader("Prompts (Bosba fills these)")
    for item in data["prompts"]:
        issues = prompt_issues(item)
        with st.expander(f"{item['id']} — {item['category']}  seed={item['seed']}", expanded=False):
            if issues:
                st.warning(" · ".join(issues))
            prompt_text = st.text_area(
                "Positive prompt",
                value=item.get("prompt") or "",
                key=f"p_{item['id']}",
                disabled=frozen,
                height=80,
            )
            req_text = st.text_area(
                "Visible requirements (one per line, 2-4)",
                value="\n".join(item.get("visible_requirements") or []),
                key=f"r_{item['id']}",
                disabled=frozen,
                height=90,
            )
            seed = st.number_input(
                "Fixed seed",
                value=int(item.get("seed") or 0),
                key=f"s_{item['id']}",
                disabled=frozen,
                step=1,
            )
            notes = st.text_input("Notes", value=item.get("notes") or "", key=f"n_{item['id']}", disabled=frozen)
            if not frozen and st.button(f"Save {item['id']}", key=f"save_{item['id']}"):
                item["prompt"] = prompt_text.strip()
                item["visible_requirements"] = [ln.strip() for ln in req_text.splitlines() if ln.strip()]
                item["seed"] = int(seed)
                item["notes"] = notes
                save_prompts(data)
                sync_from_prompts_and_disk()
                st.success(f"Saved {item['id']}")
                st.rerun()

    st.subheader("HourMeng run sheet — one model, one image at a time")
    st.markdown(
        "Use the **Generate** page on the Windows laptop (ComfyUI Desktop must be running). "
        "There is no batch of 18. Each click queues one image, copies the PNG here, and logs time/VRAM."
    )
    model_code = st.selectbox(
        "Model for this session",
        MODEL_CODES,
        format_func=lambda c: f"{c} — {MODELS[c]['name']} ({MODELS[c]['steps']} steps, CFG {MODELS[c]['cfg']})",
    )
    dataset = sync_from_prompts_and_disk()
    rows = []
    for pid in PROMPT_IDS:
        prompt = prompt_by_id(data, pid)
        key = image_id(pid, model_code)
        rec = dataset["images"][key]
        rows.append(
            {
                "image_id": key,
                "prompt": prompt.get("prompt"),
                "seed": prompt.get("seed"),
                "png": "yes" if rec.get("png_exists") else "MISSING",
                "duration_s": rec.get("generation_duration_seconds"),
                "peak_vram_gb": rec.get("peak_vram_gb"),
                "status": rec.get("completion_status"),
            }
        )
    st.dataframe(pd.DataFrame(rows), hide_index=True, width="stretch")


def page_scoring() -> None:
    st.title("Independent scoring")
    st.markdown(
        "Score without looking at the other person's numbers. "
        "The other sheet is hidden until both of you finish all 54 images."
    )
    evaluator = st.radio(
        "I am",
        ["hourmeng", "bosba"],
        format_func=lambda k: EVALUATORS[k]["name"],
        horizontal=True,
    )
    sheet = load_sheet(evaluator)
    other_key = "bosba" if evaluator == "hourmeng" else "hourmeng"
    other = load_sheet(other_key)
    revealed = both_complete()
    c1, c2, c3 = st.columns(3)
    c1.metric("Your completed scores", f"{completed_count(sheet)} / 54")
    c2.metric("Other sheet complete", "Yes" if sheet_complete(other) else "Hidden until 54/54")
    c3.metric("Can compare", "Yes" if revealed else "Not yet")

    st.subheader("Rubric")
    for key, label in CRITERIA:
        st.markdown(
            f"**{label}** — 2: {RUBRIC[key][2]} · 1: {RUBRIC[key][1]} · 0: {RUBRIC[key][0]}"
        )

    dataset = sync_from_prompts_and_disk()
    prompts = load_prompts()
    keys = all_image_ids()
    current = st.selectbox("Image", keys, key="score_image")
    pid, code = split_image_id(current)
    prompt = prompt_by_id(prompts, pid)
    rec = dataset["images"][current]
    left, right = st.columns([1, 1])
    with left:
        path = image_path(pid, code)
        if path.is_file():
            st.image(str(path), caption=current)
        else:
            st.error(f"Missing image file: `{rec['folder_location']}`. Score can still be entered after the PNG is filed.")
        st.write("**Checklist**")
        for req in prompt.get("visible_requirements") or []:
            st.write(f"- {req}")
        st.caption(
            f"{rec.get('model_name')} · seed {rec.get('seed')} · "
            f"{rec.get('steps')} steps · CFG {rec.get('cfg')} · "
            f"VRAM {rec.get('peak_vram_gb')} GB · {rec.get('generation_duration_seconds')} s"
        )
    with right:
        entry = sheet["scores"].get(current) or {}
        scores = {}
        for key, label in CRITERIA:
            current_val = entry.get(key)
            scores[key] = st.selectbox(
                label,
                [None, 0, 1, 2],
                index=[None, 0, 1, 2].index(current_val) if current_val in (0, 1, 2) else 0,
                format_func=lambda v: "—" if v is None else str(v),
                key=f"{evaluator}_{current}_{key}",
            )
        comment = st.text_area("Evidence-based comment", value=entry.get("comment") or "", height=100)
        if st.button("Save my score", type="primary"):
            upsert_score(
                evaluator,
                current,
                {**scores, "comment": comment.strip()},
            )
            st.success(f"Saved {current} for {EVALUATORS[evaluator]['name']}")
            st.rerun()

    st.divider()
    st.subheader("Export PDF")
    st.caption("Works on Linux and Windows 11. Other-person scores appear only after both sheets are complete.")
    if st.button("Build scoring PDF"):
        with st.spinner("Building PDF…"):
            st.session_state["scoring_pdf"] = build_scoring_pdf()
    if st.session_state.get("scoring_pdf"):
        st.download_button(
            "Download KiTH_independent_scores.pdf",
            data=st.session_state["scoring_pdf"],
            file_name="KiTH_independent_scores.pdf",
            mime="application/pdf",
        )

    st.divider()
    st.subheader("Compare and agree")
    if not revealed:
        st.info("Finish all 54 independent scores on both sheets before comparison.")
        return

    rows = comparison_rows()
    flagged = [r for r in rows if r["flags"]]
    st.write(f"Criteria that differ by more than one point: **{len(flagged)}** image(s).")
    if st.button("Copy identical independent scores into agreed"):
        copied = 0
        for row in rows:
            left_e = row["hourmeng"]
            right_e = row["bosba"]
            if all(left_e.get(k) == right_e.get(k) and left_e.get(k) is not None for k, _ in CRITERIA):
                upsert_agreed(
                    row["image_id"],
                    {
                        **{k: left_e[k] for k, _ in CRITERIA},
                        "comment": "Identical independent scores.",
                    },
                )
                copied += 1
        st.success(f"Wrote agreed scores for {copied} matching images.")
        st.rerun()

    table = []
    for row in rows:
        table.append(
            {
                "image_id": row["image_id"],
                "HM total": row["hourmeng"].get("total"),
                "Bosba total": row["bosba"].get("total"),
                "flags": ", ".join(row["flags"]) or "",
                "agreed total": (row["agreed"] or {}).get("total"),
            }
        )
    st.dataframe(pd.DataFrame(table), hide_index=True, width="stretch")

    agree_key = st.selectbox("Set agreed score for", keys, key="agree_image")
    hm_e = load_sheet("hourmeng")["scores"][agree_key]
    bb_e = load_sheet("bosba")["scores"][agree_key]
    flags = differences_over_one(hm_e, bb_e)
    if flags:
        st.error("Discuss: " + ", ".join(flags))
    st.write(f"HourMeng comment: {hm_e.get('comment') or '—'}")
    st.write(f"Bosba comment: {bb_e.get('comment') or '—'}")
    agreed_entry = load_agreed().get("scores", {}).get(agree_key) or {}
    agreed_vals = {}
    cols = st.columns(4)
    for i, (key, label) in enumerate(CRITERIA):
        default = agreed_entry.get(key)
        if default is None and hm_e.get(key) == bb_e.get(key):
            default = hm_e.get(key)
        with cols[i]:
            agreed_vals[key] = st.selectbox(
                f"Agreed {label}",
                [None, 0, 1, 2],
                index=[None, 0, 1, 2].index(default) if default in (0, 1, 2) else 0,
                format_func=lambda v: "—" if v is None else str(v),
                key=f"agreed_{agree_key}_{key}",
            )
    agreed_comment = st.text_area("Agreed comment", value=agreed_entry.get("comment") or "", key="agreed_comment")
    if st.button("Save agreed score"):
        upsert_agreed(agree_key, {**agreed_vals, "comment": agreed_comment.strip()})
        st.success(f"Saved agreed score for {agree_key} (originals kept).")
        st.rerun()


def page_gallery() -> None:
    st.title("Comparison gallery")
    st.caption("Same prompt, three models, local files only. Warm-ups and native-size demos are excluded from scores.")
    if st.button("Rescan PNG folders"):
        sync_from_prompts_and_disk()
        st.rerun()

    dataset = sync_from_prompts_and_disk()
    prompts = load_prompts()
    if "gallery_prompt" not in st.session_state:
        st.session_state.gallery_prompt = "P01"

    nav1, nav2, nav3 = st.columns([1, 2, 1])
    idx = PROMPT_IDS.index(st.session_state.gallery_prompt)
    with nav1:
        if st.button("Previous prompt", disabled=idx == 0):
            st.session_state.gallery_prompt = PROMPT_IDS[idx - 1]
            st.rerun()
    with nav2:
        selected = st.selectbox(
            "Prompt",
            PROMPT_IDS,
            index=PROMPT_IDS.index(st.session_state.gallery_prompt),
            format_func=lambda p: f"{p} — {prompt_by_id(prompts, p)['category']}",
        )
        if selected != st.session_state.gallery_prompt:
            st.session_state.gallery_prompt = selected
            st.rerun()
    with nav3:
        if st.button("Next prompt", disabled=idx == len(PROMPT_IDS) - 1):
            st.session_state.gallery_prompt = PROMPT_IDS[idx + 1]
            st.rerun()

    pid = st.session_state.gallery_prompt
    prompt = prompt_by_id(prompts, pid)
    st.markdown(f"**Prompt.** {prompt.get('prompt')}")
    st.markdown("**Visible requirements:** " + " · ".join(prompt.get("visible_requirements") or []))
    st.caption(f"Seed {prompt.get('seed')} · negative prompt empty · 512 x 512")

    agreed = load_agreed().get("scores") or {}
    cols = st.columns(3)
    for col, code in zip(cols, MODEL_CODES):
        with col:
            key = image_id(pid, code)
            rec = dataset["images"].get(key)
            st.subheader(MODELS[code]["name"])
            if rec is None:
                st.error(f"Missing data record for {key}.")
                continue
            path = image_path(pid, code)
            if path.is_file():
                st.image(str(path), width="stretch")
            else:
                st.error(f"Missing image: `{rec.get('folder_location')}`. File this PNG from ComfyUI using the official name.")
            agreed_entry = agreed.get(key) or {}
            agreed_total = agreed_entry.get("total")
            st.markdown(
                f"""
- **Model:** {rec.get('model_name')}
- **Checkpoint:** {rec.get('checkpoint_filename') or '(not recorded)'}
- **Workflow:** {rec.get('workflow_version')}
- **Seed:** {rec.get('seed')}
- **Effort:** {rec.get('steps')} steps, CFG {rec.get('cfg')}
- **Sampler / scheduler:** {rec.get('sampler') or '—'} / {rec.get('scheduler') or '—'}
- **Time:** {rec.get('generation_duration_seconds') if rec.get('generation_duration_seconds') is not None else '—'} s
- **Peak VRAM:** {rec.get('peak_vram_gb') if rec.get('peak_vram_gb') is not None else '—'} GB
- **RAM:** {rec.get('observed_system_ram_gb') if rec.get('observed_system_ram_gb') is not None else '—'} GB
- **Status:** {rec.get('completion_status')}
- **Agreed score:** {agreed_total if agreed_total is not None else '—'} / 8
                """
            )
            with st.expander(f"Record measurements for {key}"):
                _measurement_form(dataset, rec)

    st.subheader("Filename audit")
    audit = audit_filenames(dataset)
    st.write(f"Found {audit['found']} / {audit['expected']} expected core PNGs.")
    if audit["missing"]:
        st.error("Missing: " + ", ".join(audit["missing"]))
    if audit["unexpected_files"]:
        st.warning("Unexpected files: " + ", ".join(audit["unexpected_files"]))
    st.write("Warm-ups (excluded):", audit["warmup"])
    st.write("Optional native-size (excluded):", audit["optional_native"])

    st.subheader("Excluded folders")
    wcols = st.columns(3)
    for col, code in zip(wcols, MODEL_CODES):
        with col:
            wp = warmup_path(code)
            npth = native_path(code)
            st.caption(MODELS[code]["name"])
            if wp.is_file():
                st.image(str(wp), caption=f"Warm-up {code} (not scored)")
            else:
                st.write(f"No warm-up yet (`{wp.name}`)")
            if npth.is_file():
                st.image(str(npth), caption=f"Native-size demo {code} (not scored)")


def _measurement_form(dataset: dict, rec: dict) -> None:
    key = rec["image_id"]
    checkpoint = st.text_input("Checkpoint filename", value=rec.get("checkpoint_filename") or "", key=f"ck_{key}")
    sampler = st.text_input("Sampler", value=rec.get("sampler") or "", key=f"sa_{key}")
    scheduler = st.text_input("Scheduler", value=rec.get("scheduler") or "", key=f"sc_{key}")
    start = st.text_input("Start time", value=rec.get("start_time") or "", key=f"st_{key}")
    duration = st.number_input(
        "Generation duration (seconds)",
        min_value=0.0,
        value=float(rec.get("generation_duration_seconds") or 0.0),
        key=f"du_{key}",
    )
    vram = st.number_input(
        "Peak VRAM (GB)",
        min_value=0.0,
        value=float(rec.get("peak_vram_gb") or 0.0),
        key=f"vr_{key}",
    )
    ram = st.number_input(
        "Observed system RAM (GB)",
        min_value=0.0,
        value=float(rec.get("observed_system_ram_gb") or 0.0),
        key=f"ra_{key}",
    )
    status = st.selectbox(
        "Completion status",
        ["pending", "completed", "failed", "oom"],
        index=["pending", "completed", "failed", "oom"].index(rec.get("completion_status") or "pending")
        if (rec.get("completion_status") or "pending") in ["pending", "completed", "failed", "oom"]
        else 0,
        key=f"cs_{key}",
    )
    error = st.text_input("Technical error", value=rec.get("technical_error") or "", key=f"er_{key}")
    verification = st.selectbox(
        "Verification",
        ["unverified", "verified", "filename_mismatch"],
        index=["unverified", "verified", "filename_mismatch"].index(rec.get("verification_status") or "unverified")
        if (rec.get("verification_status") or "unverified") in ["unverified", "verified", "filename_mismatch"]
        else 0,
        key=f"vf_{key}",
    )
    if st.button(f"Save measurements {key}", key=f"save_m_{key}"):
        update_row(
            dataset,
            key,
            {
                "checkpoint_filename": checkpoint.strip(),
                "sampler": sampler.strip(),
                "scheduler": scheduler.strip(),
                "start_time": start.strip(),
                "generation_duration_seconds": duration if duration else None,
                "peak_vram_gb": vram if vram else None,
                "observed_system_ram_gb": ram if ram else None,
                "completion_status": status,
                "technical_error": error.strip(),
                "verification_status": verification,
            },
        )
        st.success(f"Saved measurements for {key}")
        st.rerun()


def page_charts() -> None:
    st.title("Required calculations and charts")
    st.markdown(
        "Average quality = total agreed points / 18. "
        "Prompt adherence = average adherence score. "
        "Average time = total seconds / 18. "
        "Completion rate = completed / 18 × 100. "
        "Peak VRAM = highest observed value for that model."
    )
    series = chart_series()
    metrics = model_metrics()
    table = []
    for code in MODEL_CODES:
        m = metrics[code]
        table.append(
            {
                "Model": m["name"],
                "Avg quality / 8": m["average_quality"],
                "Avg prompt adherence / 2": m["average_prompt_adherence"],
                "Avg time (s)": m["average_generation_time"],
                "Completion %": m["completion_rate"],
                "Peak VRAM (GB)": m["peak_vram_gb"],
                "Agreed scores filled": f"{m['agreed_scored_count']} / 18",
            }
        )
    st.dataframe(pd.DataFrame(table), hide_index=True, width="stretch")

    st.subheader("1. Average total quality score by model")
    st.bar_chart(pd.DataFrame({"model": series["labels"], "score": series["average_quality"]}), x="model", y="score")
    st.subheader("2. Average prompt adherence score by model")
    st.bar_chart(pd.DataFrame({"model": series["labels"], "score": series["average_prompt_adherence"]}), x="model", y="score")
    st.subheader("3. Average generation time in seconds by model")
    st.bar_chart(pd.DataFrame({"model": series["labels"], "seconds": series["average_generation_time"]}), x="model", y="seconds")
    st.subheader("4. Peak VRAM usage by model")
    st.bar_chart(pd.DataFrame({"model": series["labels"], "GB": series["peak_vram_gb"]}), x="model", y="GB")
    st.caption("Bars show 0 when the agreed scores or measurements are not filled yet.")


def page_progress() -> None:
    st.title("HourMeng and Bosba progress tracker")
    st.warning("This tracker is stored in `.progress/` and is gitignored. It is not a team deliverable.")
    data = load_progress()
    summary = progress_counts(data)
    c1, c2, c3 = st.columns(3)
    c1.metric("HourMeng", f"{summary['hourmeng']['done']} / {summary['hourmeng']['total']}")
    c2.metric("Bosba", f"{summary['bosba']['done']} / {summary['bosba']['total']}")
    c3.metric("Team deliverables", f"{summary['team']['done']} / {summary['team']['total']}")

    person = st.radio("Checklist", ["hourmeng", "bosba", "team"], format_func=lambda k: {
        "hourmeng": "Eang Hourmeng (Student 2)",
        "bosba": "Soem Sovanbosba (Student 1)",
        "team": "Team deliverables",
    }[k], horizontal=True)

    changed = False
    if person == "team":
        st.subheader("Team deliverables")
        for item in data["team_deliverables"]:
            checked = st.checkbox(item["task"], value=bool(item.get("done")), key=f"td_{item['id']}")
            if checked != bool(item.get("done")):
                item["done"] = checked
                changed = True
    else:
        label = data[person]["name"]
        st.subheader(label)
        for day in [str(i) for i in range(1, 7)]:
            st.markdown(f"**Day {day}**")
            for item in data[person]["days"][day]:
                checked = st.checkbox(item["task"], value=bool(item.get("done")), key=f"{person}_{item['id']}")
                if checked != bool(item.get("done")):
                    item["done"] = checked
                    changed = True
    if changed:
        save_progress(data)
        st.rerun()


PAGES = {
    "Home": page_home,
    "Computer info": page_computer,
    "Prompts and run sheet": page_prompts,
    "Generate": page_generate,
    "Scoring": page_scoring,
    "Gallery": page_gallery,
    "Charts": page_charts,
    "Progress": page_progress,
}


def main() -> None:
    _inject_css()
    st.sidebar.title("KiTH toolkit")
    st.sidebar.caption("Local only. No upload.")
    choice = st.sidebar.radio("Section", list(PAGES.keys()))
    workflow_notes = []
    for code in MODEL_CODES:
        path = WORKFLOWS / MODELS[code]["workflow_file"]
        workflow_notes.append(f"{code}: {'ready' if path.exists() else 'missing'}")
    st.sidebar.markdown("Workflows: " + " · ".join(workflow_notes))
    PAGES[choice]()


main()
