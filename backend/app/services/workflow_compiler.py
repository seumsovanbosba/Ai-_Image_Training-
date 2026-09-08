from typing import Dict, Any, Optional
import random

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
        filename_prefix: str = "Antigravity_T2I"
    ) -> Dict[str, Any]:
        actual_seed = seed if (seed is not None and seed >= 0) else random.randint(1, 2**32 - 1)
        
        dag = {
            "1": {
                "inputs": {
                    "ckpt_name": model_name
                },
                "class_type": "CheckpointLoaderSimple"
            },
            "2": {
                "inputs": {
                    "text": prompt,
                    "clip": ["1", 1]
                },
                "class_type": "CLIPTextEncode"
            },
            "3": {
                "inputs": {
                    "text": negative_prompt,
                    "clip": ["1", 1]
                },
                "class_type": "CLIPTextEncode"
            },
            "4": {
                "inputs": {
                    "width": width,
                    "height": height,
                    "batch_size": batch_size
                },
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
                    "model": ["1", 0],
                    "positive": ["2", 0],
                    "negative": ["3", 0],
                    "latent_image": ["4", 0]
                },
                "class_type": "KSampler"
            },
            "6": {
                "inputs": {
                    "samples": ["5", 0],
                    "vae": ["1", 2]
                },
                "class_type": "VAEDecode"
            },
            "7": {
                "inputs": {
                    "filename_prefix": filename_prefix,
                    "images": ["6", 0]
                },
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
        filename_prefix: str = "Antigravity_Inpaint"
    ) -> Dict[str, Any]:
        actual_seed = seed if (seed is not None and seed >= 0) else random.randint(1, 2**32 - 1)

        dag = {
            "1": {
                "inputs": {
                    "ckpt_name": model_name
                },
                "class_type": "CheckpointLoaderSimple"
            },
            "2": {
                "inputs": {
                    "text": prompt,
                    "clip": ["1", 1]
                },
                "class_type": "CLIPTextEncode"
            },
            "3": {
                "inputs": {
                    "text": negative_prompt,
                    "clip": ["1", 1]
                },
                "class_type": "CLIPTextEncode"
            },
            "10": {
                "inputs": {
                    "image": base_image_name,
                    "upload": "image"
                },
                "class_type": "LoadImage"
            },
            "11": {
                "inputs": {
                    "image": mask_image_name,
                    "upload": "image"
                },
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
                    "model": ["1", 0],
                    "positive": ["2", 0],
                    "negative": ["3", 0],
                    "latent_image": ["12", 0]
                },
                "class_type": "KSampler"
            },
            "6": {
                "inputs": {
                    "samples": ["5", 0],
                    "vae": ["1", 2]
                },
                "class_type": "VAEDecode"
            },
            "7": {
                "inputs": {
                    "filename_prefix": filename_prefix,
                    "images": ["6", 0]
                },
                "class_type": "SaveImage"
            }
        }
        return {"workflow": dag, "seed": actual_seed}
