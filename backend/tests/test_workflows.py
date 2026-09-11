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


def test_object_removal_glasses_prompt_rewrite():
    pipeline = PromptPipeline()
    for prompt in ["remove glasses", "remove the glasses", "erase glasses"]:
        res = pipeline.process(prompt)
        assert res["is_edit"] is True
        assert res["detected_target"] == "glasses"
        # Golden rule: Replacement description in positive, NOT "remove glasses"
        pos = res["positive_prompt"].lower()
        assert "natural clear eyes" in pos
        assert "clean nose bridge" in pos
        assert "remove glasses" not in pos
        assert "remove the glasses" not in pos
        # Glasses must be in negative prompt
        neg = res["negative_prompt"].lower()
        assert "glasses" in neg
        assert "sunglasses" in neg
        assert "frames" in neg
        # Auto-expand must be disabled for edits
        assert "ambient cinematic lighting" not in pos


def test_object_removal_hat_prompt_rewrite():
    pipeline = PromptPipeline()
    res = pipeline.process("remove the hat")
    assert res["is_edit"] is True
    assert res["detected_target"] == "hat"
    pos = res["positive_prompt"].lower()
    assert "natural hair" in pos
    assert "realistic hair texture" in pos
    assert "remove the hat" not in pos
    neg = res["negative_prompt"].lower()
    assert "hat" in neg
    assert "cap" in neg


def test_object_removal_accessory_prompt_rewrite():
    pipeline = PromptPipeline()
    res = pipeline.process("remove this accessory")
    assert res["is_edit"] is True
    assert res["detected_target"] == "accessory"
    neg = res["negative_prompt"].lower()
    assert "accessory" in neg


def test_object_removal_general_object_prompt_rewrite():
    pipeline = PromptPipeline()
    res = pipeline.process("delete the object")
    assert res["is_edit"] is True
    assert res["detected_target"] == "general_object"
    pos = res["positive_prompt"].lower()
    assert "seamless matching background" in pos
    neg = res["negative_prompt"].lower()
    assert "unwanted object" in neg


def test_compile_inpaint_dag_structure_and_lora():
    # 1. Inpaint without LoRA
    compiled_no_lora = WorkflowCompiler.compile_inpaint(
        prompt="natural clear eyes, bare skin",
        base_image_name="base.png",
        mask_image_name="mask.png",
        negative_prompt="glasses, frames",
        denoise=0.85,
        grow_mask_by=6,
        seed=42,
    )
    dag1 = compiled_no_lora["workflow"]
    assert dag1["10"]["class_type"] == "LoadImage"
    assert dag1["11"]["class_type"] == "LoadImage"
    assert dag1["12"]["class_type"] == "VAEEncodeForInpaint"
    assert dag1["12"]["inputs"]["grow_mask_by"] == 6
    assert dag1["12"]["inputs"]["pixels"] == ["10", 0]
    assert dag1["12"]["inputs"]["mask"] == ["11", 1]
    assert dag1["5"]["class_type"] == "KSampler"
    assert dag1["5"]["inputs"]["denoise"] == 0.85
    assert dag1["5"]["inputs"]["latent_image"] == ["12", 0]
    assert dag1["6"]["class_type"] == "VAEDecode"
    assert dag1["7"]["class_type"] == "SaveImage"
    assert "9" not in dag1  # No LoraLoader

    # 2. Inpaint with optional LoRA
    compiled_with_lora = WorkflowCompiler.compile_inpaint(
        prompt="natural clear eyes, bare skin",
        base_image_name="base.png",
        mask_image_name="mask.png",
        denoise=0.85,
        grow_mask_by=8,
        seed=42,
        lora_name="character_lora.safetensors",
        lora_strength=0.75,
    )
    dag2 = compiled_with_lora["workflow"]
    assert dag2["9"]["class_type"] == "LoraLoader"
    assert dag2["9"]["inputs"]["lora_name"] == "character_lora.safetensors"
    assert dag2["9"]["inputs"]["strength_model"] == 0.75
    assert dag2["5"]["inputs"]["model"] == ["9", 0]
    assert dag2["12"]["inputs"]["grow_mask_by"] == 8


def test_descriptive_prompt_with_without_not_rewritten():
    pipeline = PromptPipeline()
    # Prepositional descriptions with "without" should NOT be hijacked or rewritten as inpaint replacements
    for prompt in ["portrait of a man without glasses", "a wizard without beard", "a girl without jewelry"]:
        res = pipeline.process(prompt)
        assert res["is_edit"] is False
        assert res["detected_target"] is None
        assert prompt in res["positive_prompt"]
        # Must not have been overwritten with localized replacement prompt
        assert "natural clear eyes" not in res["positive_prompt"]
        assert "clean-shaven skin" not in res["positive_prompt"]


def test_object_removal_take_off_and_without_prefix():
    pipeline = PromptPipeline()
    res1 = pipeline.process("take off the glasses")
    assert res1["is_edit"] is True
    assert res1["detected_target"] == "glasses"
    assert "natural clear eyes" in res1["positive_prompt"].lower()

    res2 = pipeline.process("without glasses")
    assert res2["is_edit"] is True
    assert res2["detected_target"] == "glasses"
    assert "natural clear eyes" in res2["positive_prompt"].lower()

    res3 = pipeline.process("get rid of the hat")
    assert res3["is_edit"] is True
    assert res3["detected_target"] == "hat"
    assert "natural hair" in res3["positive_prompt"].lower()


def test_prepare_lora_dataset_script():
    import tempfile
    import subprocess
    from PIL import Image

    with tempfile.TemporaryDirectory() as tmpdir:
        src_dir = Path(tmpdir) / "input"
        out_dir = Path(tmpdir) / "output"
        src_dir.mkdir()

        img = Image.new("RGB", (256, 256), color="green")
        img.save(src_dir / "sample.png")

        script_path = Path(__file__).resolve().parent.parent.parent / "scripts" / "prepare_lora_dataset.py"
        res = subprocess.run([
            sys.executable,
            str(script_path),
            "--input", str(src_dir),
            "--output", str(out_dir),
            "--trigger", "ohwx testchar",
            "--repeats", "5",
        ], capture_output=True, text=True)

        assert res.returncode == 0, f"Script failed with stderr: {res.stderr}"
        assert "[DONE] 1 images in" in res.stdout
        assert "ohwx testchar" in res.stdout

