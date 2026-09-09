import pytest
from datetime import datetime, timezone
from fastapi.testclient import TestClient
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app
from app.database import init_db
from app.models.schemas import GenerateRequest, InpaintRequest, Img2ImgRequest, ImageAssetRead, BoardRead
from app.services.prompt_pipeline import PromptPipeline

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    init_db()

client = TestClient(app)

def test_auto_expand_defaults_to_false():
    """Verify that auto_expand is False by default across all schemas and pipeline."""
    gen_req = GenerateRequest(prompt="delete pair")
    assert gen_req.auto_expand is False

    inp_req = InpaintRequest(prompt="delete pair", base_image="dummy", mask_image="dummy")
    assert inp_req.auto_expand is False

    img_req = Img2ImgRequest(prompt="delete pair", image="dummy")
    assert img_req.auto_expand is False

    pipeline = PromptPipeline()
    res = pipeline.process(prompt="delete pair")
    assert res["positive_prompt"] == "delete pair"
    assert res["expanded_prompt"] == "delete pair"
    assert "ambient cinematic lighting" not in res["positive_prompt"]
    assert "centered dynamic framing" not in res["positive_prompt"]
    assert "hyper-detailed textures" not in res["positive_prompt"]

def test_generate_endpoint_with_delete_pair():
    """Verify that POST /api/generate keeps user prompt intact when auto_expand=False."""
    payload = {
        "prompt": "delete pair",
        "styles": [],
        "steps": 10,
        "seed": 999
    }
    resp = client.post("/api/generate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    processed = data["processed_prompt"]
    assert processed["positive_prompt"] == "delete pair"
    assert processed["expanded_prompt"] == "delete pair"
    assert processed["original_prompt"] == "delete pair"

def test_generate_endpoint_with_explicit_auto_expand():
    """Verify that user can still opt-in to auto_expand when explicitly enabled."""
    payload = {
        "prompt": "delete pair",
        "auto_expand": True,
        "expansion_level": "medium",
        "styles": [],
        "steps": 10,
        "seed": 999
    }
    resp = client.post("/api/generate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    processed = data["processed_prompt"]
    assert "ambient cinematic lighting" in processed["positive_prompt"]

def test_created_at_timezone_serialization():
    """Verify that naive datetimes from DB serialize with UTC timezone info."""
    naive_dt = datetime.fromisoformat("2026-09-09 06:40:36.498253")
    read = ImageAssetRead(
        id=1,
        filename="test.png",
        filepath="/outputs/test.png",
        url="/outputs/test.png",
        prompt="delete pair",
        negative_prompt="",
        styles_applied=[],
        model_name="sd_xl_base_1.0.safetensors",
        sampler="dpmpp_2m",
        scheduler="karras",
        steps=30,
        cfg_scale=7.0,
        seed=42,
        width=1024,
        height=1024,
        created_at=naive_dt
    )
    dump = read.model_dump(mode="json")
    assert dump["created_at"].endswith("+00:00") or dump["created_at"].endswith("Z")
    assert "2026-09-09T06:40:36.498253" in dump["created_at"]

def test_api_images_timezone_format():
    """Verify that /api/images returns ISO timestamps with UTC timezone."""
    resp = client.get("/api/images")
    assert resp.status_code == 200
    images = resp.json()
    assert len(images) > 0
    for img in images[:5]:
        created_at = img["created_at"]
        assert created_at.endswith("+00:00") or created_at.endswith("Z"), f"Timestamp {created_at} lacks timezone"

def test_api_boards_timezone_format():
    """Verify that /api/boards returns ISO timestamps with UTC timezone."""
    resp = client.get("/api/boards")
    assert resp.status_code == 200
    boards = resp.json()
    for b in boards:
        created_at = b["created_at"]
        assert created_at.endswith("+00:00") or created_at.endswith("Z"), f"Timestamp {created_at} lacks timezone"

def test_api_images_asset_flags():
    """Verify that is_upscale and is_img2img are correctly passed to ImageAssetRead."""
    resp = client.get("/api/images")
    assert resp.status_code == 200
    images = resp.json()
    # Find image with [Upscaled in prompt
    upscaled = [img for img in images if "[Upscaled" in img["prompt"]]
    if upscaled:
        assert upscaled[0]["is_upscale"] is True

def test_database_prompts_are_clean():
    """Verify that no prompt in database has leaked Fooocus auto-expansion strings."""
    resp = client.get("/api/images")
    assert resp.status_code == 200
    images = resp.json()
    for img in images:
        p = img["prompt"].lower()
        assert "ambient cinematic lighting" not in p, f"Polluted prompt in image #{img['id']}: {img['prompt']}"
        assert "hyper-detailed textures" not in p, f"Polluted prompt in image #{img['id']}: {img['prompt']}"

def test_inpaint_and_img2img_defaults():
    """Verify that InpaintRequest and Img2ImgRequest default auto_expand to False and process cleanly."""
    pipeline = PromptPipeline()
    inp_req = InpaintRequest(prompt="delete pair", base_image="dummy", mask_image="dummy")
    assert inp_req.auto_expand is False
    assert inp_req.expansion_level == "medium"
    res_inp = pipeline.process(inp_req.prompt, auto_expand=inp_req.auto_expand, expansion_level=inp_req.expansion_level)
    assert res_inp["positive_prompt"] == "delete pair"

    img_req = Img2ImgRequest(prompt="delete pair", image="dummy")
    assert img_req.auto_expand is False
    assert img_req.expansion_level == "medium"
    res_img = pipeline.process(img_req.prompt, auto_expand=img_req.auto_expand, expansion_level=img_req.expansion_level)
    assert res_img["positive_prompt"] == "delete pair"


