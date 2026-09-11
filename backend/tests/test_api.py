import pytest
import base64
from io import BytesIO
from PIL import Image
from fastapi.testclient import TestClient
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app
from app.database import init_db, engine
from sqlmodel import Session, select
from app.models.generation import Board

@pytest.fixture(scope="session", autouse=True)
def setup_database():
    init_db()
    with Session(engine) as s:
        existing = s.exec(select(Board).where(Board.name == "Test Favorites")).all()
        for b in existing:
            s.delete(b)
        s.commit()
    yield
    with Session(engine) as s:
        existing = s.exec(select(Board).where(Board.name == "Test Favorites")).all()
        for b in existing:
            s.delete(b)
        s.commit()

client = TestClient(app)

def test_health():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json()["offline_mode"] is True

def test_get_styles():
    resp = client.get("/api/styles")
    assert resp.status_code == 200
    styles = resp.json()
    assert len(styles) > 0
    names = [s["name"] for s in styles]
    assert "Photographic" in names
    assert "Fooocus V2" in names

def test_get_resolutions():
    resp = client.get("/api/resolutions")
    assert resp.status_code == 200
    res = resp.json()
    assert len(res) >= 10
    assert any(r["width"] == 1024 and r["height"] == 1024 for r in res)

def test_get_models():
    resp = client.get("/api/models")
    assert resp.status_code == 200
    models = resp.json()
    assert len(models) > 0

def test_boards_crud():
    # Create board
    resp = client.post("/api/boards", json={"name": "Test Favorites", "description": "My favorite test renders"})
    assert resp.status_code == 200
    b_data = resp.json()
    assert b_data["name"] == "Test Favorites"
    board_id = b_data["id"]

    # List boards
    list_resp = client.get("/api/boards")
    assert list_resp.status_code == 200
    boards = list_resp.json()
    assert any(b["id"] == board_id for b in boards)

def test_generate_txt2img():
    payload = {
        "prompt": "cyberpunk samurai warrior on neon street",
        "negative_prompt": "low quality",
        "styles": ["Photographic", "Cyberpunk / Sci-Fi"],
        "auto_expand": True,
        "expansion_level": "medium",
        "width": 1024,
        "height": 1024,
        "steps": 20,
        "cfg_scale": 7.0,
        "seed": 42
    }
    resp = client.post("/api/generate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "task_id" in data
    assert data["seed"] == 42
    assert "positive_prompt" in data["processed_prompt"]
    assert "cinematic photo" in data["processed_prompt"]["positive_prompt"].lower()

def test_inpaint_endpoint():
    # Create a small dummy 64x64 base image and mask
    img = Image.new("RGB", (64, 64), color="white")
    mask = Image.new("L", (64, 64), color="black")
    
    buf_img = BytesIO()
    img.save(buf_img, format="PNG")
    b64_img = "data:image/png;base64," + base64.b64encode(buf_img.getvalue()).decode("utf-8")

    buf_mask = BytesIO()
    mask.save(buf_mask, format="PNG")
    b64_mask = "data:image/png;base64," + base64.b64encode(buf_mask.getvalue()).decode("utf-8")

    payload = {
        "prompt": "vintage golden watch on wooden table",
        "base_image": b64_img,
        "mask_image": b64_mask,
        "denoise": 0.8,
        "steps": 15,
        "seed": 12345
    }
    resp = client.post("/api/inpaint", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "task_id" in data
    assert data["seed"] == 12345


def _png_data_url(color="white", size=(64, 64)):
    img = Image.new("RGB", size, color=color)
    buf = BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode("utf-8")


def test_img2img_endpoint():
    payload = {
        "prompt": "keep the person, cat and dog walking down the street",
        "image": _png_data_url(),
        "fidelity": 0.65,
        "steps": 15,
        "seed": 99,
        "auto_expand": False,
    }
    resp = client.post("/api/img2img", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "task_id" in data
    assert data["seed"] == 99


def test_list_images():
    resp = client.get("/api/images")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_start_engine_endpoint():
    resp = client.post("/api/system/start-engine")
    assert resp.status_code == 200
    data = resp.json()
    assert "status" in data
    assert data["status"] in ("already_running", "starting")


def test_system_status_engine_starting():
    resp = client.get("/api/system/status")
    assert resp.status_code == 200
    data = resp.json()
    assert "engine_starting" in data
    assert isinstance(data["engine_starting"], bool)
    assert "comfyui_online" in data


def test_batch_delete_images():
    # Test batch delete with empty or non-existent ids
    resp = client.post("/api/images/delete-batch", json={"image_ids": [999999, 999998]})
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "ok"
    assert data["deleted_ids"] == []


def test_clamp_mask_comfyui_alpha_format():
    from app.routers.generate import clamp_mask_to_dimensions
    import numpy as np

    # Test B&W mask: left half white (inpaint), right half black (keep)
    bw_mask = Image.new("L", (64, 64), color=0)
    for y in range(64):
        for x in range(32):
            bw_mask.putpixel((x, y), 255)

    buf = BytesIO()
    bw_mask.save(buf, format="PNG")
    clamped_bytes = clamp_mask_to_dimensions(buf.getvalue(), 64, 64)

    with Image.open(BytesIO(clamped_bytes)) as out_img:
        assert out_img.mode == "RGBA"
        arr = np.array(out_img)
        # Left half (white inpaint) must have Alpha == 0 for ComfyUI (1.0 - 0/255 = 1.0)
        assert np.all(arr[:, :32, 3] == 0)
        assert np.all(arr[:, :32, :3] == 255)
        # Right half (black keep) must have Alpha == 255 (1.0 - 255/255 = 0.0)
        assert np.all(arr[:, 32:, 3] == 255)
        assert np.all(arr[:, 32:, :3] == 0)


def test_clamp_mask_premultiplied_alpha_format():
    from app.routers.generate import clamp_mask_to_dimensions
    import numpy as np

    # Test browser premultiplied mask: left half alpha 0 (RGB 0), right half alpha 255 (RGB 0)
    premult_mask = Image.new("RGBA", (64, 64), color=(0, 0, 0, 255))
    for y in range(64):
        for x in range(32):
            premult_mask.putpixel((x, y), (0, 0, 0, 0))

    buf = BytesIO()
    premult_mask.save(buf, format="PNG")
    clamped_bytes = clamp_mask_to_dimensions(buf.getvalue(), 64, 64)

    with Image.open(BytesIO(clamped_bytes)) as out_img:
        assert out_img.mode == "RGBA"
        arr = np.array(out_img)
        # Left half (alpha 0 inpaint area) must have Alpha == 0 for ComfyUI (1.0 - 0/255 = 1.0)
        assert np.all(arr[:, :32, 3] == 0)
        assert np.all(arr[:, :32, :3] == 255)
        # Right half (alpha 255 keep area) must have Alpha == 255 (1.0 - 255/255 = 0.0)
        assert np.all(arr[:, 32:, 3] == 255)
        assert np.all(arr[:, 32:, :3] == 0)



def test_inpaint_with_resolved_server_path():
    from app.config import settings
    # Write a temporary image to outputs dir to test server path resolution
    test_img = Image.new("RGB", (64, 64), color="blue")
    test_fn = "test_inpaint_server_file.png"
    test_path = settings.OUTPUTS_DIR / test_fn
    test_img.save(test_path, format="PNG")

    mask = Image.new("L", (64, 64), color="black")
    buf_mask = BytesIO()
    mask.save(buf_mask, format="PNG")
    b64_mask = "data:image/png;base64," + base64.b64encode(buf_mask.getvalue()).decode("utf-8")

    try:
        payload = {
            "prompt": "test server file inpaint",
            "base_image": f"/outputs/{test_fn}",
            "mask_image": b64_mask,
            "steps": 10,
        }
        resp = client.post("/api/inpaint", json=payload)
        assert resp.status_code == 200
        assert "task_id" in resp.json()
    finally:
        if test_path.exists():
            test_path.unlink()



