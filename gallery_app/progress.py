"""Gitignored HourMeng / Bosba completion tracker."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from gallery_app.io_util import load_json, save_json
from gallery_app.paths import PROGRESS_STATUS


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def _item(item_id: str, task: str) -> dict[str, Any]:
    return {"id": item_id, "task": task, "done": False}


def default_status() -> dict[str, Any]:
    return {
        "schema_version": 1,
        "updated_at": now_iso(),
        "hourmeng": {
            "name": "Eang Hourmeng",
            "days": {
                "1": [
                    _item("h1_specs", "Record computer specification before installing software"),
                    _item("h1_comfy", "Install ComfyUI Desktop for Windows and confirm GPU acceleration"),
                    _item("h1_sd15", "Download and run Stable Diffusion 1.5"),
                    _item("h1_wf", "Save SD 1.5 workflow JSON, setup log, and success screenshots"),
                ],
                "2": [
                    _item("h2_sdxl", "Install SDXL Base 1.0 and SDXL Turbo"),
                    _item("h2_workflows", "Create and test one workflow per model with locked settings"),
                    _item("h2_vram", "Test DynamicVRAM or low VRAM mode"),
                    _item("h2_export", "Export three locked workflow JSON files"),
                    _item("h2_warmup", "Generate one warm-up image per model and exclude from measurements"),
                    _item("h2_after", "Run collect_computer_info.py --stage after-install"),
                ],
                "3": [
                    _item("h3_gen", "Generate P01-P09 once with all three models (27 PNGs)"),
                    _item("h3_meta", "Record time, VRAM, settings, errors for each of the 27"),
                    _item("h3_one", "Confirm one model and one image at a time"),
                ],
                "4": [
                    _item("h4_gen", "Generate P10-P18 on all three models (remaining 27)"),
                    _item("h4_audit", "Audit all 54 image IDs for missing, duplicate, or wrong names"),
                    _item("h4_score", "Independently score every image"),
                ],
                "5": [
                    _item("h5_gallery", "Confirm local comparison gallery works with metadata"),
                    _item("h5_readme", "Write setup and usage notes / check README"),
                    _item("h5_findings", "Record technical findings (VRAM, failures, speed)"),
                ],
                "6": [
                    _item("h6_pack", "Package workflows, gallery, and reproducible setup"),
                    _item("h6_slides", "Support final report and assigned slides"),
                    _item("h6_demo", "Demonstrate local generation and 8 GB VRAM limits"),
                ],
            },
        },
        "bosba": {
            "name": "Soem Sovanbosba",
            "days": {
                "1": [
                    _item("b1_pages", "Study official pages for SD 1.5, SDXL Base, SDXL Turbo"),
                    _item("b1_prompt", "Learn parts of a clear image prompt"),
                    _item("b1_folders", "Confirm folder plan, filename guide, daily log, evaluation workbook"),
                    _item("b1_summary", "Record each model's purpose, license, and official source"),
                ],
                "2": [
                    _item("b2_write", "Create three prompts in each of the six categories"),
                    _item("b2_check", "Write 2-4 visible requirements for every prompt"),
                    _item("b2_sheet", "Prepare the scoring sheet"),
                    _item("b2_pilot", "Pilot three prompts with HourMeng, revise, freeze all 18"),
                ],
                "3": [
                    _item("b3_reg", "Register and independently score P01-P09 (27 images)"),
                    _item("b3_check", "Check prompts, settings, seeds, and filenames"),
                    _item("b3_ev", "Record evidence for failures, artifacts, low usefulness"),
                ],
                "4": [
                    _item("b4_score", "Score P10-P18 and finish all independent scores before comparison"),
                    _item("b4_resolve", "Resolve differences greater than one point with HourMeng"),
                    _item("b4_examples", "Select three strong and three weak examples"),
                ],
                "5": [
                    _item("b5_calcs", "Calculate quality, adherence, time, completion, peak VRAM"),
                    _item("b5_charts", "Create four comparison charts"),
                    _item("b5_draft", "Draft results and discussion sections"),
                ],
                "6": [
                    _item("b6_report", "Finalize report tables, examples, limitations, appendices"),
                    _item("b6_slides", "Build 8-10 slides with HourMeng"),
                    _item("b6_talk", "Present research design, visual results, ranking, responsible use"),
                ],
            },
        },
        "team_deliverables": [
            _item("d_hw", "Hardware and software specification sheet (Computer_info.json)"),
            _item("d_models", "Three locally deployed image generation models"),
            _item("d_wf", "Three locked ComfyUI workflow JSON files"),
            _item("d_prompts", "Eighteen prompt benchmark and visible requirement checklists"),
            _item("d_png", "Fifty four original PNG images with metadata"),
            _item("d_scores", "Evaluation workbook with original and agreed scores"),
            _item("d_charts", "Four model comparison charts"),
            _item("d_gallery", "Working local comparison gallery with source files"),
            _item("d_readme", "README installation, generation and gallery usage guide"),
            _item("d_report", "Six to eight page research report with appendices"),
            _item("d_slides", "Eight to ten presentation slides and final demonstration"),
        ],
    }


def load_progress() -> dict[str, Any]:
    data = load_json(PROGRESS_STATUS, None)
    if not data:
        data = default_status()
        save_progress(data)
    return data


def save_progress(data: dict[str, Any]) -> None:
    data["updated_at"] = now_iso()
    save_json(PROGRESS_STATUS, data)


def set_item(person: str, day: str, item_id: str, done: bool) -> dict[str, Any]:
    data = load_progress()
    for item in data[person]["days"][str(day)]:
        if item["id"] == item_id:
            item["done"] = bool(done)
            break
    save_progress(data)
    return data


def set_deliverable(item_id: str, done: bool) -> dict[str, Any]:
    data = load_progress()
    for item in data["team_deliverables"]:
        if item["id"] == item_id:
            item["done"] = bool(done)
            break
    save_progress(data)
    return data


def counts(data: dict[str, Any]) -> dict[str, Any]:
    def tally(items: list[dict[str, Any]]) -> tuple[int, int]:
        return sum(1 for i in items if i.get("done")), len(items)

    result: dict[str, Any] = {}
    for person in ("hourmeng", "bosba"):
        done = total = 0
        for day_items in data[person]["days"].values():
            d, t = tally(day_items)
            done += d
            total += t
        result[person] = {"done": done, "total": total}
    d, t = tally(data["team_deliverables"])
    result["team"] = {"done": d, "total": t}
    return result
