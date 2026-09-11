"""Load and save the frozen 18-prompt benchmark."""

from __future__ import annotations

from typing import Any

from gallery_app.constants import (
    CATEGORIES,
    CORE_HEIGHT,
    CORE_WIDTH,
    NEGATIVE_PROMPT,
    PILOT_PROMPT_IDS,
    PROMPT_IDS,
    category_for_prompt,
)
from gallery_app.io_util import load_json, save_json
from gallery_app.paths import PROMPTS


def default_prompts() -> dict[str, Any]:
    prompts = []
    for i, prompt_id in enumerate(PROMPT_IDS):
        category = category_for_prompt(prompt_id)
        goal = CATEGORIES[i // 3][1]
        prompts.append(
            {
                "id": prompt_id,
                "category": category,
                "prompt": f"TODO: write one English sentence (max 45 words) that tests: {goal}.",
                "word_count": 0,
                "visible_requirements": [
                    "TODO: visible requirement 1",
                    "TODO: visible requirement 2",
                ],
                "seed": 1500 + i + 1,
                "notes": "",
            }
        )
    return {
        "frozen": False,
        "negative_prompt": NEGATIVE_PROMPT,
        "resolution": {"width": CORE_WIDTH, "height": CORE_HEIGHT},
        "pilot": {
            "prompt_ids": PILOT_PROMPT_IDS,
            "status": "not_started",
            "notes": "Pilot P01, P07 and P16 with HourMeng. Revise ambiguity, then freeze all 18 before collection.",
        },
        "prompts": prompts,
    }


def word_count(text: str) -> int:
    return len([w for w in text.split() if w and not w.startswith("TODO:")])


def load_prompts() -> dict[str, Any]:
    data = load_json(PROMPTS, None)
    if not data:
        data = default_prompts()
        save_prompts(data)
    return data


def save_prompts(data: dict[str, Any]) -> None:
    for item in data.get("prompts", []):
        item["word_count"] = len(item.get("prompt", "").split())
    save_json(PROMPTS, data)


def prompt_by_id(data: dict[str, Any], prompt_id: str) -> dict[str, Any]:
    for item in data.get("prompts", []):
        if item["id"] == prompt_id:
            return item
    raise KeyError(prompt_id)


def prompt_issues(item: dict[str, Any]) -> list[str]:
    issues = []
    text = (item.get("prompt") or "").strip()
    if not text or text.startswith("TODO:"):
        issues.append("Prompt text is still a TODO placeholder.")
    words = text.split()
    if len(words) > 45:
        issues.append(f"Prompt has {len(words)} words (limit 45).")
    reqs = [r for r in item.get("visible_requirements") or [] if r and not str(r).startswith("TODO:")]
    if not (2 <= len(reqs) <= 4):
        issues.append("Need 2 to 4 finished visible requirements.")
    if not item.get("seed"):
        issues.append("Missing fixed seed.")
    return issues
