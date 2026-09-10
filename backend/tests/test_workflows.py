import pytest
from fastapi.testclient import TestClient
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.main import app
from app.database import init_db
from app.services.prompt_pipeline import PromptPipeline
from app.services.workflow_compiler import WorkflowCompiler
from app.services.model_manager import model_manager

@pytest.fixture(scope="module", autouse=True)
def setup_database():
    init_db()

client = TestClient(app)


def test_no_conflict_markers_in_compiler():
    src = Path(__file__).resolve().parent.parent / "app" / "services" / "workflow_compiler.py"
    text = src.read_text(encoding="utf-8")
    assert "<<<<<<<" not in text
    assert ">>>>>>>" not in text


def test_edit_rewrite_banner_text():
    pipeline = PromptPipeline()
    res = pipeline.process("remove the words from the banners")
    assert res["is_edit"] is True
    assert res["is_text_edit"] is True
    assert "blank banners" in res["positive_prompt"].lower()
    assert "no text" in res["positive_prompt"].lower()
    neg = res["negative_prompt"].lower()
    assert "letters" in neg
    assert "typography" in neg
    assert "ambient cinematic lighting" not in res["positive_prompt"]


def test_delete_pair_is_not_an_edit():
    pipeline = PromptPipeline()
    assert pipeline.is_edit_instruction("delete pair") is False
    res = pipeline.process("delete pair")
    assert res["positive_prompt"] == "delete pair"
    assert res["is_edit"] is False


def test_compile_img2img_uses_source_image():
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


def test_compile_upscale_uses_esrgan_not_bicubic():
    compiled = WorkflowCompiler.compile_upscale(
        base_image_name="source.png",
        upscale_model_name="RealESRGAN_x4plus.pth",
        target_width=2048,
        target_height=2048,
        denoise=0.0,
        seed=1,
    )
    dag = compiled["workflow"]
    class_types = [node["class_type"] for node in dag.values()]
    assert "UpscaleModelLoader" in class_types
    assert "ImageUpscaleWithModel" in class_types
    assert "ImageScale" in class_types
    assert "ImageScaleBy" not in class_types
    assert "KSampler" not in class_types
    assert dag["7"]["inputs"]["images"] == ["22", 0]
    assert dag["22"]["inputs"]["width"] == 2048
    assert dag["22"]["inputs"]["height"] == 2048


def test_compile_upscale_optional_refine():
    compiled = WorkflowCompiler.compile_upscale(
        base_image_name="source.png",
        upscale_model_name="RealESRGAN_x4plus.pth",
        target_width=2048,
        target_height=2048,
        denoise=0.15,
        seed=1,
    )
    dag = compiled["workflow"]
    class_types = [node["class_type"] for node in dag.values()]
    assert "KSampler" in class_types
    assert dag["5"]["inputs"]["denoise"] == 0.15


def test_compile_txt2img_with_lora():
    compiled = WorkflowCompiler.compile_txt2img(
        prompt="ohwx person walking a dog",
        seed=3,
        lora_name="my_character.safetensors",
        lora_strength=0.8,
    )
    dag = compiled["workflow"]
    assert dag["9"]["class_type"] == "LoraLoader"
    assert dag["9"]["inputs"]["lora_name"] == "my_character.safetensors"
    assert dag["9"]["inputs"]["strength_model"] == 0.8
    assert dag["5"]["inputs"]["model"] == ["9", 0]
    assert dag["2"]["inputs"]["clip"] == ["9", 1]


def test_compile_txt2img_without_lora():
    compiled = WorkflowCompiler.compile_txt2img(prompt="a cat", seed=3)
    dag = compiled["workflow"]
    class_types = [node["class_type"] for node in dag.values()]
    assert "LoraLoader" not in class_types
    assert dag["5"]["inputs"]["model"] == ["1", 0]


def test_list_loras_endpoint():
    resp = client.get("/api/loras")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


def test_upscale_without_model_returns_400():
    if model_manager.find_upscale_model():
        pytest.skip("An upscale model is already installed")
    resp = client.post("/api/upscale", json={"image": "data:image/png;base64,aaaa", "scale_factor": 2})
    assert resp.status_code == 400
    assert "upscale model" in resp.json()["detail"].lower()
