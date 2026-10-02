import { describe, expect, it } from 'vitest';
import { answerHash, cleanAnswer, displayAnswer, normalize } from '../../src/logic/normalize';

describe('displayAnswer (Title Case)', () => {
  it('shows everyone the same way, however they typed it', () => {
    for (const typed of ['taylor swift', 'Taylor Swift', 'TAYLOR SWIFT', 'Taylor swift']) expect(displayAnswer(typed)).toBe('Taylor Swift');
    expect(displayAnswer('hippo')).toBe('Hippo');
    expect(displayAnswer('fries with mayonnaise')).toBe('Fries with Mayonnaise');
    expect(displayAnswer('the lord of the rings')).toBe('The Lord of the Rings');
  });
  it('keeps deliberate capitals, numbers, punctuation and emoji', () => {
    expect(displayAnswer('my iPhone')).toBe('My iPhone');
    expect(displayAnswer("dinner at McDonald's")).toBe("Dinner at McDonald's");
    expect(displayAnswer('pink BMX')).toBe('Pink BMX');
    expect(displayAnswer('12 pancakes')).toBe('12 Pancakes');
    expect(displayAnswer('a hair dryer (the hotel had one)')).toBe('A Hair Dryer (The Hotel Had One)');
    expect(displayAnswer('café crème 🍰')).toBe('Café Crème 🍰');
  });
});

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
