/**
 * Player actions: build the database updates a player's phone writes.
 * Each write also sets a public "done" flag so everyone can see who we're waiting for.
 */
import { GAME } from '../config/game';
import { roomPath } from './engine';
import { answerHash, isValidAnswer, normalize } from './normalize';
import type { Pid, Room, Updates } from './types';

export type LieCheck = 'ok' | 'empty' | 'too-long' | 'truth' | 'taken';

/** Can this lie be used? Compares against the (hashed) truth and the other lies. */
export function checkLie(room: Room, code: string, q: number, text: string): LieCheck {
  if (!normalize(text)) return 'empty';
  if (!isValidAnswer(text)) return 'too-long';
  const h = answerHash(text, code, q);
  if (room.pub?.questions?.[q]?.truthHash === h) return 'truth';
  if (room.lieHashes?.[q]?.[h]) return 'taken';
  return 'ok';
}

export function lieUpdates(code: string, pid: Pid, q: number, text: string): Updates {
  const hash = answerHash(text, code, q);
  return {
    [roomPath(code, `priv/${pid}/lies/${q}`)]: { text: text.trim(), hash },
    [roomPath(code, `lieHashes/${q}/${hash}`)]: pid,
    [roomPath(code, `status/${pid}/lie-${q}`)]: true,
  };
}

/** Save one truth. Marks the player done once they've answered enough prompts. */
export function truthUpdates(room: Room, code: string, pid: Pid, promptId: string, text: string): Updates {
  const truths = { ...(room.priv?.[pid]?.truths ?? {}), [promptId]: text.trim() };
  const answered = Object.values(truths).filter((t) => t.trim()).length;
  const u: Updates = { [roomPath(code, `priv/${pid}/truths/${promptId}`)]: text.trim() || null };
  u[roomPath(code, `status/${pid}/truths`)] = answered >= GAME.truthsPerPlayer ? true : null;
  return u;
}

export function voteUpdates(code: string, pid: Pid, q: number, optId: string): Updates {
  return {
    [roomPath(code, `priv/${pid}/votes/${q}`)]: optId,
    [roomPath(code, `status/${pid}/vote-${q}`)]: true,
  };
}

export function likeUpdates(code: string, pid: Pid, q: number, optId: string | null): Updates {
  return { [roomPath(code, `priv/${pid}/likes/${q}`)]: optId };
}

export type FinalCheck = 'ok' | 'empty' | 'too-long' | 'same';

export function checkFinal(truth: string, lie: string): FinalCheck {
  if (!normalize(truth) || !normalize(lie)) return 'empty';
  if (!isValidAnswer(truth) || !isValidAnswer(lie)) return 'too-long';
  if (normalize(truth) === normalize(lie)) return 'same';
  return 'ok';
}

export function finalUpdates(code: string, pid: Pid, truth: string, lie: string): Updates {
  return {
    [roomPath(code, `priv/${pid}/final`)]: { truth: truth.trim(), lie: lie.trim() },
    [roomPath(code, `status/${pid}/final`)]: true,
  };
}

export function finalVoteUpdates(code: string, pid: Pid, i: number, choice: 0 | 1): Updates {
  return {
    [roomPath(code, `priv/${pid}/fvotes/${i}`)]: choice,
    [roomPath(code, `status/${pid}/fvote-${i}`)]: true,
  };
}
