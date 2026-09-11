"""Build or patch a ComfyUI API-format text-to-image graph."""

from __future__ import annotations

from typing import Any

from gallery_app.constants import MODELS, NEGATIVE_PROMPT
from gallery_app.io_util import load_json
from gallery_app.paths import WORKFLOWS

SAMPLER = "euler"
SCHEDULER = "normal"


def is_placeholder(data: Any) -> bool:
    return isinstance(data, dict) and bool(data.get("_placeholder"))


def is_api_graph(data: Any) -> bool:
    if not isinstance(data, dict) or not data:
        return False
    if is_placeholder(data) or "nodes" in data or "last_node_id" in data:
        return False
    return any(isinstance(v, dict) and "class_type" in v for v in data.values())


def builtin_txt2img(
    *,
    checkpoint: str,
    prompt: str,
    seed: int,
    steps: int,
    cfg: float,
    width: int,
    height: int,
    filename_prefix: str,
    sampler: str = SAMPLER,
    scheduler: str = SCHEDULER,
    negative: str = NEGATIVE_PROMPT,
) -> dict[str, Any]:
    return {
        "4": {
            "class_type": "CheckpointLoaderSimple",
            "inputs": {"ckpt_name": checkpoint},
        },
        "5": {
            "class_type": "EmptyLatentImage",
            "inputs": {"width": int(width), "height": int(height), "batch_size": 1},
        },
        "6": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": prompt, "clip": ["4", 1]},
        },
        "7": {
            "class_type": "CLIPTextEncode",
            "inputs": {"text": negative, "clip": ["4", 1]},
        },
        "3": {
            "class_type": "KSampler",
            "inputs": {
                "seed": int(seed),
                "steps": int(steps),
                "cfg": float(cfg),
                "sampler_name": sampler,
                "scheduler": scheduler,
                "denoise": 1.0,
                "model": ["4", 0],
                "positive": ["6", 0],
                "negative": ["7", 0],
                "latent_image": ["5", 0],
            },
        },
        "8": {
            "class_type": "VAEDecode",
            "inputs": {"samples": ["3", 0], "vae": ["4", 2]},
        },
        "9": {
            "class_type": "SaveImage",
            "inputs": {"filename_prefix": filename_prefix, "images": ["8", 0]},
        },
    }


def _set_input(node: dict[str, Any], key: str, value: Any) -> None:
    node.setdefault("inputs", {})[key] = value


def patch_api_graph(
    graph: dict[str, Any],
    *,
    checkpoint: str,
    prompt: str,
    seed: int,
    steps: int,
    cfg: float,
    width: int,
    height: int,
    filename_prefix: str,
    sampler: str = SAMPLER,
    scheduler: str = SCHEDULER,
    negative: str = NEGATIVE_PROMPT,
) -> dict[str, Any]:
    """Overwrite locked benchmark fields on a user-exported API workflow."""
    out: dict[str, Any] = {}
    for node_id, node in graph.items():
        if not isinstance(node, dict):
            out[node_id] = node
            continue
        clone = {"class_type": node.get("class_type"), "inputs": dict(node.get("inputs") or {})}
        if "_meta" in node:
            clone["_meta"] = node["_meta"]
        ctype = clone.get("class_type")
        if ctype == "CheckpointLoaderSimple":
            _set_input(clone, "ckpt_name", checkpoint)
        elif ctype == "EmptyLatentImage":
            _set_input(clone, "width", int(width))
            _set_input(clone, "height", int(height))
            _set_input(clone, "batch_size", 1)
        elif ctype == "KSampler":
            _set_input(clone, "seed", int(seed))
            _set_input(clone, "steps", int(steps))
            _set_input(clone, "cfg", float(cfg))
            _set_input(clone, "sampler_name", sampler)
            _set_input(clone, "scheduler", scheduler)
            _set_input(clone, "denoise", 1.0)
        elif ctype == "SaveImage":
            _set_input(clone, "filename_prefix", filename_prefix)
        elif ctype in ("CLIPTextEncode", "CLIPTextEncodeSDXL"):
            title = str((node.get("_meta") or {}).get("title") or "").lower()
            current = str(clone["inputs"].get("text") or clone["inputs"].get("text_g") or "")
            text = negative if ("negative" in title or current.strip() == "") else prompt
            if "text" in clone["inputs"] or ctype == "CLIPTextEncode":
                _set_input(clone, "text", text)
            if "text_g" in clone["inputs"]:
                _set_input(clone, "text_g", text)
            if "text_l" in clone["inputs"]:
                _set_input(clone, "text_l", text)

        out[node_id] = clone

    # If two CLIP nodes exist, the empty one is negative; if both had text, first=pos second=neg
    clip_ids = [
        i
        for i, n in out.items()
        if isinstance(n, dict) and n.get("class_type") in ("CLIPTextEncode", "CLIPTextEncodeSDXL")
    ]
    if len(clip_ids) >= 2:
        for key, text in ((clip_ids[0], prompt), (clip_ids[1], negative)):
            node = out[key]
            if "text" in node["inputs"] or node.get("class_type") == "CLIPTextEncode":
                _set_input(node, "text", text)
            if "text_g" in node["inputs"]:
                _set_input(node, "text_g", text)
            if "text_l" in node["inputs"]:
                _set_input(node, "text_l", text)
    elif len(clip_ids) == 1:
        _set_input(out[clip_ids[0]], "text", prompt)


    return out


def load_model_workflow_file(model_code: str) -> dict[str, Any] | None:
    path = WORKFLOWS / MODELS[model_code]["workflow_file"]
    if not path.exists():
        return None
    return load_json(path, None)


def resolve_graph(
    model_code: str,
    *,
    checkpoint: str,
    prompt: str,
    seed: int,
    filename_prefix: str,
) -> tuple[dict[str, Any], str]:
    """Return (api_graph, workflow_version_label)."""
    model = MODELS[model_code]
    kwargs = dict(
        checkpoint=checkpoint,
        prompt=prompt,
        seed=int(seed),
        steps=int(model["steps"]),
        cfg=float(model["cfg"]),
        width=int(model["width"]),
        height=int(model["height"]),
        filename_prefix=filename_prefix,
        sampler=SAMPLER,
        scheduler=SCHEDULER,
        negative=NEGATIVE_PROMPT,
    )
    data = load_model_workflow_file(model_code)
    if data and is_api_graph(data):
        return patch_api_graph(data, **kwargs), MODELS[model_code]["workflow_file"]
    return builtin_txt2img(**kwargs), "builtin_txt2img_v1"
