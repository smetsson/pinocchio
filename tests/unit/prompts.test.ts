import { describe, expect, it } from 'vitest';
import { countFresh, dealPrompts, freshestFirst, groupKey } from '../../src/logic/prompts';
import { seeded } from '../../src/logic/random';
import { PACKS, getPack } from '../../src/data/packs';
import { GAME } from '../../src/config/game';

describe('prompt packs', () => {
  it('are valid', () => {
    expect(PACKS.length).toBeGreaterThanOrEqual(5);
    for (const pack of PACKS) {
      const ids = pack.prompts.map((p) => p.id);
      expect(new Set(ids).size, `duplicate ids in ${pack.id}`).toBe(ids.length);
      for (const p of pack.prompts) {
        expect(p.them, p.id).toContain('{name}');
        expect(p.me, p.id).toContain('____');
        expect(p.them, p.id).toContain('____');
        expect(p.lies.length, p.id).toBeGreaterThanOrEqual(3);
      }
      // Standard pack size: 50 questions. That's enough to deal every player in a full room
      // their own questions, so no question can come up twice in one game.
      expect(pack.prompts.length, `${pack.id} has fewer than 50 questions`).toBeGreaterThanOrEqual(50);
      const dealtInFullRoom = GAME.maxPlayers * (GAME.truthsPerPlayer + GAME.sparePromptsPerPlayer);
      expect(pack.prompts.length, `${pack.id} is too small for a full room`).toBeGreaterThanOrEqual(dealtInFullRoom);
    }
    expect(getPack('general').prompts.length).toBeGreaterThanOrEqual(100);
    expect(getPack('what-if').prompts.length).toBeGreaterThanOrEqual(50);
  });
});

describe('groups', () => {
  it('turns group names into safe keys', () => {
    expect(groupKey('Work Team!')).toBe('work-team');
    expect(groupKey('  Vrienden & Co ')).toBe('vrienden-co');
    expect(groupKey('Café.$#[]/')).toBe('cafe');
    expect(groupKey('!!!')).toBe('default');
  });
});

describe('prompt history', () => {
  const pack = getPack('general');
  it('puts never-played prompts first, then the least recently played', () => {
    const history = { [pack.prompts[0].id]: 200, [pack.prompts[1].id]: 100 };
    const order = freshestFirst(pack, history, seeded(1)).map((p) => p.id);
    expect(order.slice(-2)).toEqual([pack.prompts[1].id, pack.prompts[0].id]);
    expect(countFresh(pack, history)).toBe(pack.prompts.length - 2);
  });
  it('never deals a played prompt while fresh ones remain', () => {
    const history = Object.fromEntries(pack.prompts.slice(0, 30).map((p, i) => [p.id, i + 1]));
    const dealt = dealPrompts(['a', 'b', 'c', 'd', 'e', 'f'], pack, 5, history, {}, seeded(3));
    const all = Object.values(dealt).flat();
    expect(new Set(all).size).toBe(30);
    for (const id of all) expect(history[id]).toBeUndefined();
  });
  it('keeps prompts already dealt and never repeats within a player', () => {
    const tiny = { ...pack, prompts: pack.prompts.slice(0, 4) };
    const dealt = dealPrompts(['a', 'b'], tiny, 3, {}, { a: ['x'] }, seeded(5));
    expect(dealt.a).toBeUndefined();
    expect(new Set(dealt.b).size).toBe(3);
  });
});
