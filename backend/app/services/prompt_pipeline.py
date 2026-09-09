import json
import re
from pathlib import Path
from typing import List, Tuple, Dict, Any
from app.config import settings
from app.models.schemas import GenerateRequest, InpaintRequest

class PromptPipeline:
    def __init__(self, styles_path: Path = None, resolutions_path: Path = None):
        self.styles_path = styles_path or (settings.DATA_DIR / "styles.json")
        self.resolutions_path = resolutions_path or (settings.DATA_DIR / "resolutions.json")
        self.styles: Dict[str, Dict[str, str]] = {}
        self.resolutions: List[Dict[str, Any]] = []
        self._load_data()

    def _load_data(self):
        if self.styles_path.exists():
            with open(self.styles_path, "r", encoding="utf-8-sig") as f:
                data = json.load(f)
                self.styles = {item["name"]: item for item in data}
        
        if self.resolutions_path.exists():
            with open(self.resolutions_path, "r", encoding="utf-8-sig") as f:
                self.resolutions = json.load(f)

    def get_available_styles(self) -> List[Dict[str, str]]:
        return list(self.styles.values())

    def get_available_resolutions(self) -> List[Dict[str, Any]]:
        return self.resolutions

    def expand_prompt(self, prompt: str, level: str = "medium") -> str:
        '''
        Fooocus-style deterministic prompt expansion.
        Enriches user prompt with lighting, texture, camera, and atmosphere modifiers.
        '''
        if level == "none" or not prompt.strip():
            return prompt.strip()

        cleaned = prompt.strip().rstrip(".,")
        p_lower = cleaned.lower()
        additions = []

        # 1. Subject & Scene Detection
        is_portrait = any(w in p_lower for w in ["portrait", "girl", "woman", "man", "person", "face", "boy", "warrior", "character", "knight", "cyberpunk woman"])
        is_landscape = any(w in p_lower for w in ["landscape", "mountain", "forest", "city", "ocean", "sky", "valley", "temple", "ruins", "street", "desert"])
        is_creature = any(w in p_lower for w in ["dragon", "monster", "animal", "tiger", "cat", "dog", "robot", "mech", "creature"])

        # 2. Lighting & Ambiance additions
        if not any(w in p_lower for w in ["light", "sun", "neon", "shadow", "glow", "dramatic"]):
            if is_portrait:
                additions.append("soft studio key lighting with gentle fill light")
            elif is_landscape:
                additions.append("golden hour natural lighting, volumetric sun rays")
            else:
                additions.append("ambient cinematic lighting with subtle highlights")

        # 3. Framing / Camera Angle
        if not any(w in p_lower for w in ["shot", "angle", "lens", "close-up", "wide", "view"]):
            if is_portrait:
                additions.append("shallow depth of field, 85mm lens, soft bokeh")
            elif is_landscape:
                additions.append("grand wide angle perspective, breathtaking scale")
            else:
                additions.append("centered dynamic framing, sharp focal point")

        # 4. Detail & Rendering Quality
        if level in ["medium", "heavy"]:
            if not any(w in p_lower for w in ["detail", "texture", "8k", "hyper", "sharp"]):
                additions.append("hyper-detailed textures, intricate micro-surface fidelity, ultra-fine details")

        if level == "heavy":
            additions.append("stunning visual composition, professional color grading, immaculate rendering")

        expanded = cleaned
        if additions:
            expanded = f"{cleaned}, {', '.join(additions)}"
        return expanded

    def apply_styles(self, user_prompt: str, selected_styles: List[str]) -> Tuple[str, List[str]]:
        '''
        Injects Fooocus style presets into the prompt and collects negative prompt tokens.
        '''
        if not selected_styles:
            return user_prompt, []

        positive_accum = user_prompt
        negative_tokens = []
        first_style_applied = False

        for style_name in selected_styles:
            style = self.styles.get(style_name)
            if not style:
                continue

            pos_template = style.get("positive_prompt", "{prompt}")
            neg_style = style.get("negative_prompt", "")
            
            if neg_style:
                negative_tokens.append(neg_style)

            if not first_style_applied:
                if "{prompt}" in pos_template:
                    positive_accum = pos_template.replace("{prompt}", positive_accum)
                else:
                    positive_accum = f"{positive_accum}, {pos_template}"
                first_style_applied = True
            else:
                # Secondary styles: strip duplicate {prompt} or append unique keywords
                clean_template = pos_template.replace("{prompt}", "").strip(", ")
                if clean_template:
                    positive_accum = f"{positive_accum}, {clean_template}"

        return positive_accum, negative_tokens

    def build_negative_prompt(self, user_negative: str, style_negatives: List[str]) -> str:
        '''
        Combines user negative prompt with style negatives, standard quality exclusions,
        and deduplicates tokens cleanly.
        '''
        default_base_negative = [
            "low quality", "worst quality", "distorted", "disfigured", 
            "bad anatomy", "blurry", "watermark", "pixelated"
        ]
        
        raw_parts = []
        if user_negative and user_negative.strip():
            raw_parts.append(user_negative.strip())
        
        for sn in style_negatives:
            if sn.strip():
                raw_parts.append(sn.strip())
                
        raw_parts.extend(default_base_negative)

        # Tokenize, clean and deduplicate while maintaining order
        all_tokens = []
        seen = set()
        for part in raw_parts:
            tokens = [t.strip() for t in part.split(",") if t.strip()]
            for t in tokens:
                t_key = t.lower()
                if t_key not in seen:
                    seen.add(t_key)
                    all_tokens.append(t)

        return ", ".join(all_tokens)

    def process(self, prompt: str, negative_prompt: str = "", styles: List[str] = None, 
                auto_expand: bool = False, expansion_level: str = "medium") -> Dict[str, str]:
        '''
        Full Fooocus pipeline processing:
        User Prompt -> [Auto-Expansion] -> [Style Injection] -> Final Positive & Negative Prompts
        '''
        styles = styles or []
        
        # Step 1: Deterministic prompt expansion
        if auto_expand:
            expanded_user_prompt = self.expand_prompt(prompt, level=expansion_level)
        else:
            expanded_user_prompt = prompt.strip()

        # Step 2: Apply styles
        final_positive, style_negatives = self.apply_styles(expanded_user_prompt, styles)

        # Step 3: Compose negative prompt
        final_negative = self.build_negative_prompt(negative_prompt, style_negatives)

        return {
            "original_prompt": prompt,
            "expanded_prompt": expanded_user_prompt,
            "positive_prompt": final_positive,
            "negative_prompt": final_negative,
            "styles_applied": styles
        }

