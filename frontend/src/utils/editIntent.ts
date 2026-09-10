const EDIT_VERBS = /\b(remove|delete|erase|change|replace|fix|without)\b/i;
const TEXT_NOUNS = /\b(text|word|words|letter|letters|banner|banners|sign|logo|watermark|caption|writing|typography)\b/i;

export function looksLikeEdit(prompt: string): boolean {
  const p = (prompt || '').trim();
  if (!p || !EDIT_VERBS.test(p)) return false;
  const lower = p.toLowerCase();
  const hasFrom = lower.includes(' from ');
  const hasText = TEXT_NOUNS.test(p);
  const hasThe = /\bthe\b/i.test(p);
  return hasFrom || hasText || (hasThe && p.split(/\s+/).length >= 4);
}

export function isTextRemoval(prompt: string): boolean {
  return looksLikeEdit(prompt) && TEXT_NOUNS.test(prompt);
}
