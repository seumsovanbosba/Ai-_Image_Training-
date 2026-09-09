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


def test_compile_img2img_uses_source_image():
    from app.services.workflow_compiler import WorkflowCompiler
    compiled = WorkflowCompiler.compile_img2img(
        prompt="a cat walking beside a person",
        base_image_name="source.png",
        denoise=0.25,
        seed=7,
        target_width=2048,
        target_height=2048,
    )
    dag = compiled["workflow"]
    class_types = [node["class_type"] for node in dag.values()]
    assert "LoadImage" in class_types
    assert "VAEEncode" in class_types
    assert "ImageScale" in class_types
    assert "EmptyLatentImage" not in class_types
    assert dag["5"]["inputs"]["denoise"] == 0.25
    assert dag["5"]["inputs"]["latent_image"] == ["14", 0]
    assert dag["13"]["inputs"]["width"] == 2048
    assert dag["13"]["inputs"]["height"] == 2048


def test_img2img_endpoint():
    payload = {
        "prompt": "keep the person, cat and dog walking down the street",
        "base_image": _png_data_url(),
        "denoise": 0.45,
        "steps": 15,
        "seed": 99,
        "auto_expand": False,
    }
    resp = client.post("/api/img2img", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "task_id" in data
    assert data["seed"] == 99


def test_upscale_endpoint():
    payload = {
        "prompt": "person, cat and dog walking down a sunlit street",
        "base_image": _png_data_url(size=(128, 128)),
        "denoise": 0.25,
        "scale": 2,
        "steps": 15,
        "seed": 42,
        "auto_expand": False,
    }
    resp = client.post("/api/upscale", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert "task_id" in data
    assert data["seed"] == 42
    assert data["width"] == 256
    assert data["height"] == 256
    assert data["denoise"] <= 0.45


def test_list_images():
    resp = client.get("/api/images")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
