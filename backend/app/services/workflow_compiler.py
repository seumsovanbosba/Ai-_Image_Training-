from typing import Dict, Any, Optional, List, Tuple
import random


def _snap8(value: int) -> int:
    return max(8, int(round(value / 8) * 8))


def _lora_nodes(
    lora_name: Optional[str],
    lora_strength: float = 0.8,
) -> Tuple[List[Any], List[Any], Dict[str, Any]]:
    '''Return (model_ref, clip_ref, extra_nodes). Checkpoint is always node "1".'''
    if not lora_name:
        return ["1", 0], ["1", 1], {}
    strength = min(max(float(lora_strength), 0.0), 1.5)
    return (
        ["9", 0],
        ["9", 1],
        {
            "9": {
                "inputs": {
                    "model": ["1", 0],
                    "clip": ["1", 1],
                    "lora_name": lora_name,
                    "strength_model": strength,
                    "strength_clip": strength,
                },
                "class_type": "LoraLoader",
            }
        },
    )


class WorkflowCompiler:
    '''
    Compiles high-level user parameters into standard ComfyUI API DAG JSON workflows.
    Compatible with headless ComfyUI execution via /prompt API.
    '''

    @staticmethod
    def compile_txt2img(
        prompt: str,
        negative_prompt: str = "",
        model_name: str = "v1-5-pruned-emaonly.safetensors",
        width: int = 1024,
        height: int = 1024,
        steps: int = 30,
        cfg: float = 7.0,
        sampler_name: str = "dpmpp_2m",
        scheduler: str = "karras",
        seed: Optional[int] = None,
        batch_size: int = 1,
        filename_prefix: str = "Antigravity_T2I",
        lora_name: Optional[str] = None,
        lora_strength: float = 0.8,
    ) -> Dict[str, Any]:
        actual_seed = seed if (seed is not None and seed >= 0) else random.randint(1, 2**32 - 1)
        model_ref, clip_ref, lora_dag = _lora_nodes(lora_name, lora_strength)

        dag: Dict[str, Any] = {
            "1": {
                "inputs": {"ckpt_name": model_name},
                "class_type": "CheckpointLoaderSimple"
            },
            **lora_dag,
            "2": {
                "inputs": {"text": prompt, "clip": clip_ref},
                "class_type": "CLIPTextEncode"
            },
            "3": {
                "inputs": {"text": negative_prompt, "clip": clip_ref},
                "class_type": "CLIPTextEncode"
            },
            "4": {
                "inputs": {"width": width, "height": height, "batch_size": batch_size},
                "class_type": "EmptyLatentImage"
            },
            "5": {
                "inputs": {
                    "seed": actual_seed,
                    "steps": steps,
                    "cfg": cfg,
                    "sampler_name": sampler_name,
                    "scheduler": scheduler,
                    "denoise": 1.0,
                    "model": model_ref,
                    "positive": ["2", 0],
                    "negative": ["3", 0],
                    "latent_image": ["4", 0]
                },
                "class_type": "KSampler"
            },
            "6": {
                "inputs": {"samples": ["5", 0], "vae": ["1", 2]},
                "class_type": "VAEDecode"
            },
            "7": {
                "inputs": {"filename_prefix": filename_prefix, "images": ["6", 0]},
                "class_type": "SaveImage"
            }
        }
        return {"workflow": dag, "seed": actual_seed}

    @staticmethod
    def compile_inpaint(
        prompt: str,
        base_image_name: str,
        mask_image_name: str,
        negative_prompt: str = "",
        model_name: str = "v1-5-pruned-emaonly.safetensors",
        steps: int = 30,
        cfg: float = 7.0,
        sampler_name: str = "dpmpp_2m",
        scheduler: str = "karras",
        denoise: float = 0.85,
        seed: Optional[int] = None,
        grow_mask_by: int = 6,
        filename_prefix: str = "Antigravity_Inpaint",
        lora_name: Optional[str] = None,
        lora_strength: float = 0.8,
    ) -> Dict[str, Any]:
        actual_seed = seed if (seed is not None and seed >= 0) else random.randint(1, 2**32 - 1)
        model_ref, clip_ref, lora_dag = _lora_nodes(lora_name, lora_strength)

        dag: Dict[str, Any] = {
            "1": {
                "inputs": {"ckpt_name": model_name},
                "class_type": "CheckpointLoaderSimple"
            },
            **lora_dag,
            "2": {
                "inputs": {"text": prompt, "clip": clip_ref},
                "class_type": "CLIPTextEncode"
            },
            "3": {
                "inputs": {"text": negative_prompt, "clip": clip_ref},
                "class_type": "CLIPTextEncode"
            },
            "10": {
                "inputs": {"image": base_image_name, "upload": "image"},
                "class_type": "LoadImage"
            },
            "11": {
                "inputs": {"image": mask_image_name, "upload": "image"},
                "class_type": "LoadImage"
            },
            "12": {
                "inputs": {
                    "pixels": ["10", 0],
                    "vae": ["1", 2],
                    "mask": ["11", 1],
                    "grow_mask_by": grow_mask_by
                },
                "class_type": "VAEEncodeForInpaint"
            },
            "5": {
                "inputs": {
                    "seed": actual_seed,
                    "steps": steps,
                    "cfg": cfg,
                    "sampler_name": sampler_name,
                    "scheduler": scheduler,
                    "denoise": denoise,
                    "model": model_ref,
                    "positive": ["2", 0],
                    "negative": ["3", 0],
                    "latent_image": ["12", 0]
                },
                "class_type": "KSampler"
            },
            "6": {
                "inputs": {"samples": ["5", 0], "vae": ["1", 2]},
                "class_type": "VAEDecode"
            },
            "7": {
                "inputs": {"filename_prefix": filename_prefix, "images": ["6", 0]},
                "class_type": "SaveImage"
            }
        }
        return {"workflow": dag, "seed": actual_seed}

    @staticmethod
    def compile_img2img(
        prompt: str,
        base_image_name: str,
        negative_prompt: str = "",
        model_name: str = "v1-5-pruned-emaonly.safetensors",
        steps: int = 30,
        cfg: float = 7.0,
        sampler_name: str = "dpmpp_2m",
        scheduler: str = "karras",
        denoise: float = 0.65,
        seed: Optional[int] = None,
        target_width: Optional[int] = None,
        target_height: Optional[int] = None,
        filename_prefix: str = "Antigravity_I2I",
        lora_name: Optional[str] = None,
        lora_strength: float = 0.8,
    ) -> Dict[str, Any]:
        '''
        Image-conditioned sampling: load an existing image, optionally scale it,
        encode to latent space, then denoise only part-way so composition is kept.
        denoise=1.0 would ignore the source image (txt2img). Keep it well below 1.
        '''
        actual_seed = seed if (seed is not None and seed >= 0) else random.randint(1, 2**32 - 1)
        denoise = min(max(float(denoise), 0.05), 0.95)
        model_ref, clip_ref, lora_dag = _lora_nodes(lora_name, lora_strength)

        pixel_source = ["10", 0]
        dag: Dict[str, Any] = {
            "1": {
                "inputs": {"ckpt_name": model_name},
                "class_type": "CheckpointLoaderSimple"
            },
            **lora_dag,
            "2": {
                "inputs": {"text": prompt, "clip": clip_ref},
                "class_type": "CLIPTextEncode"
            },
            "3": {
                "inputs": {"text": negative_prompt, "clip": clip_ref},
                "class_type": "CLIPTextEncode"
            },
            "10": {
                "inputs": {"image": base_image_name, "upload": "image"},
                "class_type": "LoadImage"
            },
        }

        if target_width and target_height:
            dag["13"] = {
                "inputs": {
                    "upscale_method": "lanczos",
                    "width": _snap8(target_width),
                    "height": _snap8(target_height),
                    "crop": "disabled",
                    "image": ["10", 0]
                },
                "class_type": "ImageScale"
            }
            pixel_source = ["13", 0]

        dag["14"] = {
            "inputs": {"pixels": pixel_source, "vae": ["1", 2]},
            "class_type": "VAEEncode"
        }
        dag["5"] = {
            "inputs": {
                "seed": actual_seed,
                "steps": steps,
                "cfg": cfg,
                "sampler_name": sampler_name,
                "scheduler": scheduler,
                "denoise": denoise,
                "model": model_ref,
                "positive": ["2", 0],
                "negative": ["3", 0],
                "latent_image": ["14", 0]
            },
            "class_type": "KSampler"
        }
        dag["6"] = {
            "inputs": {"samples": ["5", 0], "vae": ["1", 2]},
            "class_type": "VAEDecode"
        }
        dag["7"] = {
            "inputs": {"filename_prefix": filename_prefix, "images": ["6", 0]},
            "class_type": "SaveImage"
        }
        return {"workflow": dag, "seed": actual_seed}

    @staticmethod
    def compile_upscale(
        base_image_name: str,
        upscale_model_name: str,
        target_width: int,
        target_height: int,
        prompt: str = "",
        negative_prompt: str = "",
        model_name: str = "sd_xl_base_1.0.safetensors",
        steps: int = 12,
        cfg: float = 7.0,
        sampler_name: str = "dpmpp_2m",
        scheduler: str = "karras",
        denoise: float = 0.0,
        seed: Optional[int] = None,
        filename_prefix: str = "Antigravity_Upscale",
        lora_name: Optional[str] = None,
        lora_strength: float = 0.8,
    ) -> Dict[str, Any]:
        '''
        Real model upscale (ESRGAN / UltraSharp), then scale to the requested
        pixel size. SDXL refine is off by default (denoise=0) so the upscaler
        is the visible quality change, not a near-copy latent pass.
        '''
        actual_seed = seed if (seed is not None and seed >= 0) else random.randint(1, 2**32 - 1)
        out_w = _snap8(target_width)
        out_h = _snap8(target_height)

        dag: Dict[str, Any] = {
            "10": {
                "inputs": {"image": base_image_name, "upload": "image"},
                "class_type": "LoadImage"
            },
            "20": {
                "inputs": {"model_name": upscale_model_name},
                "class_type": "UpscaleModelLoader"
            },
            "21": {
                "inputs": {
                    "upscale_model": ["20", 0],
                    "image": ["10", 0]
                },
                "class_type": "ImageUpscaleWithModel"
            },
            "22": {
                "inputs": {
                    "upscale_method": "lanczos",
                    "width": out_w,
                    "height": out_h,
                    "crop": "disabled",
                    "image": ["21", 0]
                },
                "class_type": "ImageScale"
            },
        }

        if float(denoise) > 0.01:
            model_ref, clip_ref, lora_dag = _lora_nodes(lora_name, lora_strength)
            dag["1"] = {
                "inputs": {"ckpt_name": model_name},
                "class_type": "CheckpointLoaderSimple"
            }
            dag.update(lora_dag)
            dag["2"] = {
                "inputs": {"text": prompt, "clip": clip_ref},
                "class_type": "CLIPTextEncode"
            }
            dag["3"] = {
                "inputs": {"text": negative_prompt, "clip": clip_ref},
                "class_type": "CLIPTextEncode"
            }
            dag["12"] = {
                "inputs": {"pixels": ["22", 0], "vae": ["1", 2]},
                "class_type": "VAEEncode"
            }
            dag["5"] = {
                "inputs": {
                    "seed": actual_seed,
                    "steps": steps,
                    "cfg": cfg,
                    "sampler_name": sampler_name,
                    "scheduler": scheduler,
                    "denoise": min(max(float(denoise), 0.05), 0.45),
                    "model": model_ref,
                    "positive": ["2", 0],
                    "negative": ["3", 0],
                    "latent_image": ["12", 0]
                },
                "class_type": "KSampler"
            }
            dag["6"] = {
                "inputs": {"samples": ["5", 0], "vae": ["1", 2]},
                "class_type": "VAEDecode"
            }
            save_from = ["6", 0]
        else:
            save_from = ["22", 0]

        dag["7"] = {
            "inputs": {"filename_prefix": filename_prefix, "images": save_from},
            "class_type": "SaveImage"
        }
        return {"workflow": dag, "seed": actual_seed}
