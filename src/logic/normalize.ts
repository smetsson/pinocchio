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

/** Answer length limits (characters). */
export const MAX_ANSWER = 80;

export function isValidAnswer(text: string): boolean {
  const n = normalize(text);
  return n.length >= 1 && text.trim().length <= MAX_ANSWER;
}
