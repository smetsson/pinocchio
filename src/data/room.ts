/**
 * Talking to Firebase: create/join rooms, subscribe to the game, write updates.
 */
import {
  child,
  get,
  onDisconnect,
  onValue,
  ref,
  serverTimestamp,
  set,
  update,
  type Unsubscribe,
} from 'firebase/database';
import { GAME } from '../config/game';
import { roomPath } from '../logic/engine';
import { randomId, roomCode } from '../logic/random';
import type { PromptHistory } from '../logic/prompts';
import type { Meta, Player, Room, Updates } from '../logic/types';
import type { Fb } from './firebase';

export interface CreateOptions {
  name: string;
  avatar: string;
  pack: string;
  length: Meta['length'];
  mode: Meta['mode'];
}

export async function createRoom(fb: Fb, opts: CreateOptions): Promise<{ code: string; pid: string; hostKey: string }> {
  void sweepExpired(fb);
  const now = await serverNow(fb);
  const pid = randomId(10);
  const hostKey = randomId(24);
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = roomCode();
    const expiresAt = now + GAME.keepUnfinishedDays * 24 * 3600 * 1000;
    const room: Room = {
      meta: { hostUid: fb.uid, hostPid: pid, createdAt: now, expiresAt, pack: opts.pack, length: opts.length, mode: opts.mode },
      state: { v: 0, phase: 'lobby', q: 0, deadline: 0, step: 0 },
      players: { [pid]: { uid: fb.uid, name: opts.name, avatar: opts.avatar, joinedAt: now } },
    };
    try {
      await update(ref(fb.db), {
        [roomPath(code)]: room,
        [`hostKeys/${code}/${hostKey}`]: true,
        [`roomIndex/${code}`]: expiresAt,
      });
      return { code, pid, hostKey };
    } catch {
      // Code already in use: try another one.
    }
  }
  throw new Error('Could not create a room');
}

export type JoinResult = { ok: true; pid: string } | { ok: false; reason: 'not-found' | 'started' | 'full' | 'name-taken' };

export async function joinRoom(fb: Fb, code: string, name: string, avatar: string): Promise<JoinResult> {
  let players: Record<string, Player> = {};
  let phase: string;
  try {
    const [meta, state, ps] = await Promise.all([
      get(ref(fb.db, roomPath(code, 'meta'))),
      get(ref(fb.db, roomPath(code, 'state/phase'))),
      get(ref(fb.db, roomPath(code, 'players'))),
    ]);
    if (!meta.exists()) return { ok: false, reason: 'not-found' };
    phase = state.val();
    players = ps.val() ?? {};
  } catch {
    return { ok: false, reason: 'not-found' };
  }
  // Already have a seat with this device? Reuse it.
  const existing = Object.entries(players).find(([, p]) => p.uid === fb.uid && !p.kicked);
  if (existing) return { ok: true, pid: existing[0] };
  if (phase !== 'lobby' && phase !== 'truths') return { ok: false, reason: 'started' };
  const active = Object.values(players).filter((p) => !p.kicked);
  if (active.length >= GAME.maxPlayers) return { ok: false, reason: 'full' };
  if (active.some((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase())) return { ok: false, reason: 'name-taken' };
  const pid = randomId(10);
  await set(ref(fb.db, roomPath(code, `players/${pid}`)), { uid: fb.uid, name, avatar, joinedAt: await serverNow(fb) });
  return { ok: true, pid };
}

export async function roomExists(fb: Fb, code: string): Promise<boolean> {
  try {
    return (await get(ref(fb.db, roomPath(code, 'meta/createdAt')))).exists();
  } catch {
    return false;
  }
}

/** Host recovery: become host on this device with the secret key, and move the host's seat here. */
export async function claimHost(fb: Fb, code: string, key: string): Promise<string> {
  await set(ref(fb.db, `claims/${code}/${fb.uid}`), key);
  await set(ref(fb.db, roomPath(code, 'meta/hostUid')), fb.uid);
  const hostPid = (await get(ref(fb.db, roomPath(code, 'meta/hostPid')))).val() as string;
  await set(ref(fb.db, roomPath(code, `players/${hostPid}/uid`)), fb.uid);
  await set(ref(fb.db, `claims/${code}/${fb.uid}`), null);
  return hostPid;
}

export function write(fb: Fb, updates: Updates): Promise<void> {
  return update(ref(fb.db), updates);
}

/** Server clock offset, so every phone shows the same countdown. */
export function watchServerOffset(fb: Fb, cb: (offset: number) => void): Unsubscribe {
  return onValue(ref(fb.db, '.info/serverTimeOffset'), (s) => cb(s.val() ?? 0));
}

let offsetCache = 0;
export async function serverNow(fb: Fb): Promise<number> {
  try {
    offsetCache = (await get(ref(fb.db, '.info/serverTimeOffset'))).val() ?? offsetCache;
  } catch {
    /* use cached */
  }
  return Date.now() + offsetCache;
}

/** Mark this player online; Firebase marks them offline (with a timestamp) when the connection drops. */
export function trackPresence(fb: Fb, code: string, pid: string): Unsubscribe {
  const presenceRef = ref(fb.db, roomPath(code, `presence/${pid}`));
  return onValue(ref(fb.db, '.info/connected'), async (snap) => {
    if (snap.val() !== true) return;
    try {
      await onDisconnect(presenceRef).set(serverTimestamp());
      await set(presenceRef, true);
    } catch {
      /* kicked or room gone */
    }
  });
}

/**
 * Subscribe to everything this player may see. The host gets the whole room (one listener);
 * players listen to the public parts plus their own private branch.
 */
export function subscribeRoom(
  fb: Fb,
  code: string,
  pid: string | undefined,
  isHost: boolean,
  cb: (room: Room | null) => void,
  onError?: (e: Error, path: string) => void,
): Unsubscribe {
  if (isHost) {
    return onValue(ref(fb.db, roomPath(code)), (s) => cb(s.val()), (e) => onError?.(e, ''));
  }
  const parts: Record<string, unknown> = {};
  const loaded = new Set<string>();
  const paths = ['meta', 'players', 'presence', 'state', 'pub', 'status', 'lieHashes'];
  if (pid) paths.push(`priv/${pid}`, `toPlayer/${pid}`);
  const emit = () => {
    if (loaded.size < paths.length) return;
    if (!parts.meta) return cb(null);
    const room: any = {};
    for (const [path, value] of Object.entries(parts)) {
      if (value === null || value === undefined) continue;
      const keys = path.split('/');
      let obj = room;
      for (const k of keys.slice(0, -1)) obj = obj[k] ??= {};
      obj[keys.at(-1)!] = value;
    }
    cb(room as Room);
  };
  const unsubs = paths.map((path) =>
    onValue(
      child(ref(fb.db, roomPath(code)), path),
      (s) => {
        parts[path] = s.val();
        loaded.add(path);
        emit();
      },
      (e) => {
        loaded.add(path);
        parts[path] = null;
        onError?.(e, path);
        emit();
      },
    ),
  );
  return () => unsubs.forEach((u) => u());
}

export async function loadHistory(fb: Fb, pack: string): Promise<PromptHistory> {
  try {
    return (await get(ref(fb.db, `history/${pack}`))).val() ?? {};
  } catch {
    return {};
  }
}

export function resetHistory(fb: Fb, pack: string): Promise<void> {
  return set(ref(fb.db, `history/${pack}`), null);
}

export function watchHistory(fb: Fb, pack: string, cb: (h: PromptHistory) => void): Unsubscribe {
  return onValue(ref(fb.db, `history/${pack}`), (s) => cb(s.val() ?? {}), () => cb({}));
}

export async function deleteRoom(fb: Fb, code: string): Promise<void> {
  await update(ref(fb.db), {
    [roomPath(code)]: null,
    [`roomIndex/${code}`]: null,
    [`hostKeys/${code}`]: null,
    [`claims/${code}`]: null,
  });
}

/** Delete rooms that have expired (answers are personal). Runs whenever a room is created. */
export async function sweepExpired(fb: Fb): Promise<number> {
  try {
    const index = (await get(ref(fb.db, 'roomIndex'))).val() as Record<string, number> | null;
    const now = await serverNow(fb);
    const expired = Object.entries(index ?? {}).filter(([, t]) => t < now);
    await Promise.all(expired.map(([code]) => deleteRoom(fb, code).catch(() => undefined)));
    return expired.length;
  } catch {
    return 0;
  }
}
