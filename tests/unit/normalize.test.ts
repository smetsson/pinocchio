import { describe, expect, it } from 'vitest';
import { answerHash, normalize } from '../../src/logic/normalize';

describe('normalize', () => {
  it('ignores case, spacing, punctuation and accents', () => {
    expect(normalize('  The   Beatles!! ')).toBe('beatles');
    expect(normalize('beatles')).toBe('beatles');
    expect(normalize('Café-Crème')).toBe('cafe creme');
    expect(normalize('Rock & Roll')).toBe('rock and roll');
  });
  it('drops a leading article', () => {
    expect(normalize('A dolphin trainer')).toBe('dolphin trainer');
    expect(normalize('an owl')).toBe('owl');
    expect(normalize('the')).toBe('the');
  });
  it('keeps emoji-only answers comparable by hash', () => {
    expect(answerHash('Pilot', 'ABCD', 1)).toBe(answerHash('pilot.', 'ABCD', 1));
    expect(answerHash('Pilot', 'ABCD', 1)).not.toBe(answerHash('Pilot', 'ABCD', 2));
    expect(answerHash('Pilot', 'ABCD', 1)).not.toBe(answerHash('Pilots', 'ABCD', 1));
  });
});
