"""Independent HourMeng / Bosba scores and agreed scores."""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from gallery_app.constants import CRITERIA, EVALUATORS, all_image_ids
from gallery_app.io_util import load_json, save_json
from gallery_app.paths import SCORE_AGREED, SCORE_BOSBA, SCORE_HOURMENG

SCORE_FILES = {
    "hourmeng": SCORE_HOURMENG,
    "bosba": SCORE_BOSBA,
}


def now_iso() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")


def empty_score() -> dict[str, Any]:
    return {
        "prompt_adherence": None,
        "composition": None,
        "visual_coherence": None,
        "practical_usefulness": None,
        "comment": "",
        "total": None,
        "updated_at": None,
    }


def default_sheet(evaluator: str) -> dict[str, Any]:
    return {
        "evaluator": evaluator,
        "evaluator_name": EVALUATORS[evaluator]["name"],
        "updated_at": now_iso(),
        "scores": {key: empty_score() for key in all_image_ids()},
    }


def criterion_keys() -> list[str]:
    return [key for key, _ in CRITERIA]


def is_complete_entry(entry: dict[str, Any] | None) -> bool:
    if not entry:
        return False
    return all(entry.get(key) is not None for key in criterion_keys())


def total_of(entry: dict[str, Any]) -> int | None:
    if not is_complete_entry(entry):
        return None
    return int(sum(int(entry[key]) for key in criterion_keys()))


def load_sheet(evaluator: str) -> dict[str, Any]:
    path = SCORE_FILES[evaluator]
    data = load_json(path, None)
    if not data:
        data = default_sheet(evaluator)
        save_json(path, data)
        return data
    scores = data.setdefault("scores", {})
    for key in all_image_ids():
        if key not in scores:
            scores[key] = empty_score()
    return data


def save_sheet(evaluator: str, data: dict[str, Any]) -> None:
    data["updated_at"] = now_iso()
    save_json(SCORE_FILES[evaluator], data)


def upsert_score(evaluator: str, image_key: str, fields: dict[str, Any]) -> dict[str, Any]:
    data = load_sheet(evaluator)
    entry = data["scores"].setdefault(image_key, empty_score())
    entry.update(fields)
    entry["total"] = total_of(entry)
    entry["updated_at"] = now_iso()
    data["scores"][image_key] = entry
    save_sheet(evaluator, data)
    return entry


def completed_count(data: dict[str, Any]) -> int:
    return sum(1 for key in all_image_ids() if is_complete_entry(data.get("scores", {}).get(key)))


def sheet_complete(data: dict[str, Any]) -> bool:
    return completed_count(data) == 54


def both_complete() -> bool:
    return sheet_complete(load_sheet("hourmeng")) and sheet_complete(load_sheet("bosba"))


def load_agreed() -> dict[str, Any]:
    data = load_json(SCORE_AGREED, None)
    if not data:
        data = {"updated_at": None, "scores": {}}
        save_json(SCORE_AGREED, data)
    return data


def save_agreed(data: dict[str, Any]) -> None:
    data["updated_at"] = now_iso()
    save_json(SCORE_AGREED, data)


def differences_over_one(left: dict[str, Any], right: dict[str, Any]) -> list[str]:
    flagged = []
    for key in criterion_keys():
        a = left.get(key)
        b = right.get(key)
        if a is None or b is None:
            continue
        if abs(int(a) - int(b)) > 1:
            flagged.append(key)
    return flagged


def comparison_rows() -> list[dict[str, Any]]:
    hm = load_sheet("hourmeng")["scores"]
    bb = load_sheet("bosba")["scores"]
    agreed = load_agreed().get("scores", {})
    rows = []
    for key in all_image_ids():
        left = hm.get(key) or empty_score()
        right = bb.get(key) or empty_score()
        flags = differences_over_one(left, right) if is_complete_entry(left) and is_complete_entry(right) else []
        agreed_entry = agreed.get(key) or {}
        rows.append(
            {
                "image_id": key,
                "hourmeng": left,
                "bosba": right,
                "flags": flags,
                "agreed": agreed_entry,
                "needs_discussion": bool(flags) and not is_complete_entry(agreed_entry),
            }
        )
    return rows


def upsert_agreed(image_key: str, fields: dict[str, Any]) -> dict[str, Any]:
    hm = load_sheet("hourmeng")["scores"].get(image_key) or empty_score()
    bb = load_sheet("bosba")["scores"].get(image_key) or empty_score()
    data = load_agreed()
    entry = data["scores"].setdefault(image_key, empty_score())
    entry.update(fields)
    entry["total"] = total_of(entry)
    entry["updated_at"] = now_iso()
    entry["hourmeng_original"] = {
        **{k: hm.get(k) for k in criterion_keys()},
        "comment": hm.get("comment", ""),
        "total": hm.get("total"),
    }
    entry["bosba_original"] = {
        **{k: bb.get(k) for k in criterion_keys()},
        "comment": bb.get("comment", ""),
        "total": bb.get("total"),
    }
    entry["differences_over_one"] = differences_over_one(hm, bb)
    data["scores"][image_key] = entry
    save_agreed(data)
    return entry
