import json
import re
from pathlib import Path
from typing import List, Tuple, Dict, Any
from app.config import settings

EDIT_ACTION_VERBS = r"remove|delete|erase|take off|get rid of|clear|strip"
EDIT_MODIFY_VERBS = r"change|replace|fix"
ALL_EDIT_VERBS = rf"{EDIT_ACTION_VERBS}|{EDIT_MODIFY_VERBS}"
TEXT_NOUNS = r"text|word|words|letter|letters|banner|banners|sign|logo|watermark|caption|writing|typography"
TEXT_NEGATIVES = [
    "text", "letters", "words", "watermark", "caption", "logo",
    "typography", "writing", "signage text",
]

# Targeted replacements for localized object removal in inpainting/edits:
# Instead of prompting "remove X" (which activates cross-attention for X),
# describe what should REPLACE the area and place X in negative prompts.
OBJECT_TARGETS: Dict[str, Dict[str, Any]] = {
    "glasses": {
        "pattern": r"\b(glasses|sunglasses|spectacles|eyeglasses|eyewear|frames|eyeglass|reading glasses|shades)\b",
        "replacement": "natural clear eyes, detailed realistic eyes, natural eyelids, smooth bare skin, clean nose bridge, realistic facial details",
        "negatives": ["glasses", "sunglasses", "spectacles", "eyeglasses", "eyewear", "frames", "shades", "tinted lenses", "rims"],
    },
    "hat": {
        "pattern": r"\b(hat|hats|cap|caps|beanie|beanies|fedora|headwear|helmet|helmets|beret|bonnet|baseball cap)\b",
        "replacement": "natural hair, detailed realistic hairstyle, natural hair strands, clean head shape, realistic hair texture",
        "negatives": ["hat", "cap", "beanie", "fedora", "headwear", "helmet", "beret", "bonnet", "head covering"],
    },
    "facial_hair": {
        "pattern": r"\b(beard|beards|mustache|mustaches|moustache|moustaches|goatee|facial hair|stubble|whiskers)\b",
        "replacement": "clean-shaven skin, smooth bare face, natural skin texture, clean jawline and chin",
        "negatives": ["beard", "mustache", "moustache", "goatee", "facial hair", "stubble"],
    },
    "jewelry": {
        "pattern": r"\b(jewelry|jewellery|watch|wrist watch|necklace|necklaces|earring|earrings|bracelet|bracelets|piercing|piercings|ring|rings)\b",
        "replacement": "smooth bare skin, natural skin texture, clean skin",
        "negatives": ["jewelry", "jewellery", "watch", "necklace", "earrings", "bracelet", "piercing", "accessory"],
    },
    "accessory": {
        "pattern": r"\b(accessory|accessories|tie|necktie|bowtie|scarf|scarves|gloves)\b",
        "replacement": "natural clothing, clean plain fabric, smooth natural texture",
        "negatives": ["accessory", "accessories", "unwanted accessory", "clutter"],
    },
    "general_object": {
        "pattern": r"\b(object|objects|item|items|unwanted object|background object|clutter|person in background)\b",
        "replacement": "seamless matching background, natural environment, clean surface, realistic texture, coherent surrounding area",
        "negatives": ["unwanted object", "unwanted item", "clutter", "artifacts", "distortion"],
    },
}


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

    @staticmethod
    def is_edit_instruction(prompt: str) -> bool:
        '''
        True for "remove the words from the banners", "remove glasses", "remove the hat", "remove this accessory", "without glasses".
        False for short captions like "delete pair" or descriptive text like "portrait of a man without glasses".
        '''
        p = (prompt or "").strip().lower()
        if not p:
            return False

        tokens = p.split()
        if len(tokens) == 2 and tokens[0] in ["delete", "remove", "erase"] and tokens[1] in ["pair", "photo", "image"]:
            return False

        # Direct removal/absence instruction starting with without or no:
        # e.g. "without glasses", "no hat", "without sunglasses"
        if re.match(r"^(without|no)\s+(the\s+|this\s+|all\s+)?(glasses|sunglasses|spectacles|eyeglasses|eyewear|frames|shades|hat|hats|cap|caps|beanie|fedora|headwear|helmet|beard|mustache|facial hair|jewelry|jewellery|watch|necklace|earrings|accessory|accessories|object|objects|item|clutter|text|words|letters|banner|watermark)\b", p):
            return True

        if not re.search(rf"\b({ALL_EDIT_VERBS})\b", p):
            return False

        has_text = bool(re.search(rf"\b({TEXT_NOUNS})\b", p))
        has_from = " from " in f" {p} "
        has_the = bool(re.search(r"\bthe\b", p))

        has_action = bool(re.search(rf"\b({EDIT_ACTION_VERBS})\b", p))
        has_object = any(bool(re.search(cfg["pattern"], p)) for cfg in OBJECT_TARGETS.values())

        if has_action and has_object:
            return True

        return has_from or has_text or (has_the and len(tokens) >= 4)

    @staticmethod
    def is_object_removal(prompt: str) -> bool:
        p = (prompt or "").strip().lower()
        if not PromptPipeline.is_edit_instruction(p):
            return False
        has_action = bool(re.search(rf"\b({EDIT_ACTION_VERBS})\b", p)) or bool(re.match(r"^(without|no)\s+", p))
        has_object = any(bool(re.search(cfg["pattern"], p)) for cfg in OBJECT_TARGETS.values())
        return has_action and has_object

    @staticmethod
    def is_text_removal(prompt: str) -> bool:
        p = (prompt or "").strip().lower()
        return PromptPipeline.is_edit_instruction(p) and bool(
            re.search(rf"\b({TEXT_NOUNS})\b", p)
        )

    def interpret_edit(self, prompt: str) -> Dict[str, Any]:
        original = (prompt or "").strip()
        p_lower = original.lower()
        is_edit = self.is_edit_instruction(original)
        is_text = self.is_text_removal(original)
        rewritten = original
        extra_negatives: List[str] = []
        detected_target: Optional[str] = None

        if is_edit:
            # 1. Check for specific object removal targets (e.g. glasses, hat, accessories)
            if self.is_object_removal(original):
                for target_name, cfg in OBJECT_TARGETS.items():
                    if re.search(cfg["pattern"], p_lower):
                        detected_target = target_name
                        rewritten = cfg["replacement"]
                        extra_negatives = list(cfg["negatives"])
                        break

            # 2. If not a specific object removal, check text or generic scene edit
            if not detected_target:
                if is_text:
                    rewritten = (
                        f"the same scene and composition, {original}, "
                        "blank banners with no text, no letters, no typography, "
                        "keep lighting, camera angle, and all other details"
                    )
                    extra_negatives = list(TEXT_NEGATIVES)
                else:
                    rewritten = (
                        f"the same scene and composition, {original}, "
                        "keep lighting, camera angle, and all other details"
                    )

        return {
            "is_edit": is_edit,
            "is_text_edit": is_text,
            "detected_target": detected_target,
            "original_prompt": original,
            "rewritten_prompt": rewritten,
            "extra_negatives": extra_negatives,
        }

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

    def process(
        self,
        prompt: str,
        negative_prompt: str = "",
        styles: List[str] = None,
        auto_expand: bool = False,
        expansion_level: str = "medium",
        interpret_edits: bool = True,
    ) -> Dict[str, Any]:
        '''
        Full Fooocus pipeline processing:
        User Prompt -> [Edit rewrite] -> [Auto-Expansion] -> [Style Injection]
        '''
        styles = styles or []
        edit = self.interpret_edit(prompt) if interpret_edits else {
            "is_edit": False,
            "is_text_edit": False,
            "original_prompt": prompt.strip(),
            "rewritten_prompt": prompt.strip(),
            "extra_negatives": [],
        }

        working_prompt = edit["rewritten_prompt"] if edit["is_edit"] else prompt.strip()

        # Edits must not be drowned in cinematic expansion.
        if edit["is_edit"]:
            auto_expand = False

        if auto_expand:
            expanded_user_prompt = self.expand_prompt(working_prompt, level=expansion_level)
        else:
            expanded_user_prompt = working_prompt

        final_positive, style_negatives = self.apply_styles(expanded_user_prompt, styles)
        style_negatives = list(style_negatives) + list(edit["extra_negatives"])
        final_negative = self.build_negative_prompt(negative_prompt, style_negatives)

        return {
            "original_prompt": prompt,
            "expanded_prompt": expanded_user_prompt,
            "positive_prompt": final_positive,
            "negative_prompt": final_negative,
            "styles_applied": styles,
            "is_edit": edit["is_edit"],
            "is_text_edit": edit["is_text_edit"],
            "detected_target": edit.get("detected_target"),
        }
