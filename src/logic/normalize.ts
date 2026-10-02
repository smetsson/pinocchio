/**
 * Normalize an answer so "The Beatles!", "  the  beatles " and "Beatles" compare equal.
 * Lowercase, strip accents, punctuation and emoji, collapse spaces, drop a leading article.
 */
export function normalize(text: string): string {
  let s = text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  s = s.replace(/^(a|an|the|my|de|het|een)\s+/, '');
  return s;
}

/** Fast non-cryptographic 53-bit hash (cyrb53), as base36. */
export function hash53(str: string, seed = 0): string {
  let h1 = 0xdeadbeef ^ seed;
  let h2 = 0x41c6ce57 ^ seed;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Hash used for duplicate detection. Salted per room + question so the same
 * answer gives a different hash in every question.
 */
export function answerHash(text: string, roomCode: string, q: number): string {
  return hash53(normalize(text), 0) + hash53(`${roomCode}:${q}`, 7).slice(0, 4);
}

/**
 * Tidy an answer before it's saved, so typing habits don't give anyone away: trim, single
 * spaces, no trailing full stop or exclamation mark. For "label" questions ("My favourite
 * animal: ____") or questions that already contain the article ("I'd be a ____"), a leading
 * a/an/the is dropped too, so "a hippo" and "hippo" end up the same.
 * (Capitalisation is evened out on screen: see displayAnswer.)
 */
export function cleanAnswer(text: string, template?: string): string {
  let s = text.replace(/\s+/g, ' ').trim().replace(/[.!,;:]+$/, '').trim();
  const beforeBlank = template?.split('____')[0].trimEnd() ?? '';
  if (/(:|\b(a|an|the))$/i.test(beforeBlank)) s = s.replace(/^(a|an|the)\s+/i, '');
  return s;
}

const SMALL_WORDS = new Set(['a', 'an', 'the', 'and', 'or', 'but', 'nor', 'of', 'with', 'in', 'on', 'at', 'to', 'for', 'by', 'from', 'as', 'per', 'vs', 'via', 'into', 'up']);

/**
 * How answers are shown: Title Case, so nobody's capitalisation habits give them away.
 * "taylor swift" / "TAYLOR SWIFT" -> "Taylor Swift", "fries with mayonnaise" -> "Fries with Mayonnaise".
 * Words with deliberate capitals inside them are kept as typed: iPhone, McDonald's, BMX, K3.
 */
export function displayAnswer(text: string): string {
  const letters = text.replace(/[^\p{L}]/gu, '');
  // Typed entirely in capitals: treat as lowercase first.
  const base = letters.length > 1 && letters === letters.toUpperCase() && letters !== letters.toLowerCase() ? text.toLowerCase() : text;
  let first = true;
  return base.replace(/\S+/g, (word) => {
    const i = word.search(/\p{L}/u);
    if (i < 0) return word; // numbers, emoji, punctuation
    const isFirst = first;
    first = false;
    if (/\p{Lu}/u.test(word.slice(i + 1))) return word; // iPhone, McDonald's, BMX
    if (!isFirst && SMALL_WORDS.has(word.toLowerCase())) return word.toLowerCase();
    return word.slice(0, i) + word[i].toUpperCase() + word.slice(i + 1);
  });
}

/** Answer length limits (characters). */
export const MAX_ANSWER = 80;

export function isValidAnswer(text: string): boolean {
  const n = normalize(text);
  return n.length >= 1 && text.trim().length <= MAX_ANSWER;
}
