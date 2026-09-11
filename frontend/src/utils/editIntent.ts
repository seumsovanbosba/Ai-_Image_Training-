const EDIT_ACTION_VERBS = /\b(remove|delete|erase|take off|get rid of|clear|strip)\b/i;
const EDIT_MODIFY_VERBS = /\b(change|replace|fix)\b/i;
const ALL_EDIT_VERBS = /\b(remove|delete|erase|take off|get rid of|clear|strip|change|replace|fix)\b/i;
const TEXT_NOUNS = /\b(text|word|words|letter|letters|banner|banners|sign|logo|watermark|caption|writing|typography)\b/i;
const OBJECT_NOUNS = /\b(glasses|sunglasses|spectacles|eyeglasses|eyewear|frames|shades|hat|hats|cap|caps|beanie|beanies|fedora|headwear|helmet|beard|mustache|moustache|goatee|facial hair|jewelry|jewellery|watch|necklace|earring|earrings|bracelet|piercing|accessory|accessories|object|objects|item|items|clutter)\b/i;

export interface ObjectRemovalPreset {
  target: string;
  label: string;
  replacementPrompt: string;
  negativePrompt: string;
  guidance: string;
}

export const OBJECT_REMOVAL_PRESETS: Record<string, ObjectRemovalPreset> = {
  glasses: {
    target: 'glasses',
    label: 'Glasses Removal',
    replacementPrompt: 'natural clear eyes, detailed realistic eyes, natural eyelids, smooth bare skin, clean nose bridge, realistic facial details',
    negativePrompt: 'glasses, sunglasses, spectacles, eyeglasses, eyewear, frames, shades, tinted lenses, rims',
    guidance: 'Mask both lenses, frames, and nose bridge with a small margin. Do not mask the entire face. Replacement prompt paints realistic bare eyes and skin.',
  },
  hat: {
    target: 'hat',
    label: 'Hat / Headwear Removal',
    replacementPrompt: 'natural hair, detailed realistic hairstyle, natural hair strands, clean head shape, realistic hair texture',
    negativePrompt: 'hat, cap, beanie, fedora, headwear, helmet, beret, bonnet, head covering',
    guidance: 'Mask the hat and the hair boundary. Facial features and identity remain 100% untouched.',
  },
  facial_hair: {
    target: 'facial_hair',
    label: 'Beard / Facial Hair Removal',
    replacementPrompt: 'clean-shaven skin, smooth bare face, natural skin texture, clean jawline and chin',
    negativePrompt: 'beard, mustache, moustache, goatee, facial hair, stubble',
    guidance: 'Mask the chin and jaw area. Model will synthesize smooth, clean-shaven skin.',
  },
  jewelry: {
    target: 'jewelry',
    label: 'Accessory / Jewelry Removal',
    replacementPrompt: 'smooth bare skin, natural skin texture, clean skin, realistic skin pores',
    negativePrompt: 'jewelry, jewellery, watch, necklace, earrings, bracelet, piercing, accessory',
    guidance: 'Tightly mask the accessory. Leaves surrounding skin natural and intact.',
  },
  general_object: {
    target: 'general_object',
    label: 'Clean Background / Object',
    replacementPrompt: 'seamless matching background, natural environment, clean surface, realistic texture, coherent surrounding area',
    negativePrompt: 'unwanted object, unwanted item, clutter, artifacts, distortion',
    guidance: 'Tightly mask the unwanted item. The inpaint model fills in coherent background texture.',
  },
};

export function looksLikeEdit(prompt: string): boolean {
  const p = (prompt || '').trim();
  if (!p) return false;

  const tokens = p.split(/\s+/);
  if (tokens.length === 2 && ['delete', 'remove', 'erase'].includes(tokens[0].toLowerCase()) && ['pair', 'photo', 'image'].includes(tokens[1].toLowerCase())) {
    return false;
  }

  // Direct removal/absence instruction starting with without or no:
  // e.g. "without glasses", "no hat", "without sunglasses"
  if (/^(without|no)\s+(the\s+|this\s+|all\s+)?(glasses|sunglasses|spectacles|eyeglasses|eyewear|frames|shades|hat|hats|cap|caps|beanie|fedora|headwear|helmet|beard|mustache|facial hair|jewelry|jewellery|watch|necklace|earrings|accessory|accessories|object|objects|item|clutter|text|words|letters|banner|watermark)\b/i.test(p)) {
    return true;
  }

  if (!ALL_EDIT_VERBS.test(p)) return false;

  const lower = p.toLowerCase();
  const hasFrom = lower.includes(' from ');
  const hasText = TEXT_NOUNS.test(p);
  const hasAction = EDIT_ACTION_VERBS.test(p);
  const hasObject = OBJECT_NOUNS.test(p);
  const hasThe = /\bthe\b/i.test(p);

  if (hasAction && hasObject) return true;

  return hasFrom || hasText || (hasThe && tokens.length >= 4);
}

export function isTextRemoval(prompt: string): boolean {
  return looksLikeEdit(prompt) && TEXT_NOUNS.test(prompt);
}

export function isObjectRemoval(prompt: string): boolean {
  const p = (prompt || '').trim();
  if (!looksLikeEdit(p)) return false;
  const hasAction = EDIT_ACTION_VERBS.test(p) || /^(without|no)\s+/i.test(p);
  return hasAction && OBJECT_NOUNS.test(p);
}

export function getObjectRemovalPreset(prompt: string): ObjectRemovalPreset | null {
  const p = (prompt || '').toLowerCase();
  if (!isObjectRemoval(p)) return null;

  if (/\b(glasses|sunglasses|spectacles|eyeglasses|eyewear|frames|shades)\b/i.test(p)) {
    return OBJECT_REMOVAL_PRESETS.glasses;
  }
  if (/\b(hat|hats|cap|caps|beanie|beanies|fedora|headwear|helmet|beret)\b/i.test(p)) {
    return OBJECT_REMOVAL_PRESETS.hat;
  }
  if (/\b(beard|mustache|moustache|goatee|facial hair|stubble)\b/i.test(p)) {
    return OBJECT_REMOVAL_PRESETS.facial_hair;
  }
  if (/\b(jewelry|jewellery|watch|necklace|earring|bracelet|piercing)\b/i.test(p)) {
    return OBJECT_REMOVAL_PRESETS.jewelry;
  }
  if (/\b(object|item|accessory|accessories|clutter)\b/i.test(p)) {
    return OBJECT_REMOVAL_PRESETS.general_object;
  }
  return null;
}
