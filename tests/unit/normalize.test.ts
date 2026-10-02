import { describe, expect, it } from 'vitest';
import { answerHash, cleanAnswer, normalize } from '../../src/logic/normalize';

describe('cleanAnswer', () => {
  it('tidies spacing and trailing punctuation', () => {
    expect(cleanAnswer('  Rock   Werchter 2003!! ')).toBe('Rock Werchter 2003');
    expect(cleanAnswer('a hippo.')).toBe('a hippo');
  });
  it('drops a leading article for label questions and questions that contain the article', () => {
    expect(cleanAnswer('A hippo', 'My favourite animal: ____')).toBe('hippo');
    expect(cleanAnswer('an owl', "If I were an animal, I'd be a ____")).toBe('owl');
    expect(cleanAnswer('The Lion King', 'A movie that made me cry is ____')).toBe('The Lion King');
  });
});

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
