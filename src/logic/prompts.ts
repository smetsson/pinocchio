import type { Pid, Prompt, PromptPack } from './types';
import { shuffle, type Rng } from './random';

/** When each prompt was last played: promptId -> timestamp (ms). */
export type PromptHistory = Record<string, number>;

/**
 * Order a pack's prompts so the team sees fresh ones first:
 * never-played prompts (random order), then the least recently played.
 */
export function freshestFirst(pack: PromptPack, history: PromptHistory = {}, rng?: Rng): Prompt[] {
  const shuffled = shuffle(pack.prompts, rng);
  const fresh = shuffled.filter((p) => !history[p.id]);
  const played = shuffled
    .filter((p) => history[p.id])
    .sort((a, b) => history[a.id] - history[b.id]);
  return [...fresh, ...played];
}

export function countFresh(pack: PromptPack, history: PromptHistory = {}): number {
  return pack.prompts.filter((p) => !history[p.id]).length;
}

/**
 * Deal prompts to players. Every player gets `perPlayer` prompts; nobody in the
 * room shares a prompt (as long as the pack is big enough). Players already
 * dealt keep theirs.
 */
export function dealPrompts(
  pids: Pid[],
  pack: PromptPack,
  perPlayer: number,
  history: PromptHistory = {},
  existing: Record<Pid, string[]> = {},
  rng?: Rng,
): Record<Pid, string[]> {
  const used = new Set(Object.values(existing).flat());
  const queue = freshestFirst(pack, history, rng)
    .map((p) => p.id)
    .filter((id) => !used.has(id));
  const out: Record<Pid, string[]> = {};
  for (const pid of pids) {
    if (existing[pid]?.length) continue;
    const mine: string[] = [];
    while (mine.length < perPlayer) {
      let next = queue.shift();
      if (!next) {
        // Pack exhausted: reuse, but never twice for the same player.
        next = shuffle(pack.prompts, rng).map((p) => p.id).find((id) => !mine.includes(id));
        if (!next) break;
      }
      mine.push(next);
    }
    out[pid] = mine;
  }
  return out;
}

/** Turn a group name like "Work team!" into a safe database key: "work-team". */
export function groupKey(name: string): string {
  const key = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return key || 'default';
}

export function historyPath(group: string, pack: string): string {
  return `history/${groupKey(group)}/${pack}`;
}

export function fillName(template: string, name: string): string {
  return template.replace(/\{name\}/g, name);
}
