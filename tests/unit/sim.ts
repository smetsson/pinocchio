/** A tiny in-memory game simulator for tests. */
import { applyUpdates } from '../../src/logic/apply';
import * as engine from '../../src/logic/engine';
import * as actions from '../../src/logic/actions';
import { seeded } from '../../src/logic/random';
import { getPack } from '../../src/data/packs';
import type { Room, Updates } from '../../src/logic/types';

export const CODE = 'TEST';

export function newSim(names: string[], opts: { mode?: 'live' | 'precall'; length?: 'short' | 'standard'; seed?: number } = {}) {
  const db: Record<string, any> = {};
  let now = 1_700_000_000_000;
  const rng = seeded(opts.seed ?? 42);
  const pack = getPack('general');
  const pids = names.map((_, i) => `p${i}`);
  const room: Room = {
    meta: { hostUid: 'u0', hostPid: 'p0', createdAt: now, expiresAt: now + 1e9, pack: 'general', length: opts.length ?? 'standard', mode: opts.mode ?? 'live', group: 'Work Team' },
    state: { v: 0, phase: 'lobby', q: 0, deadline: 0, step: 0 },
    players: Object.fromEntries(names.map((name, i) => [pids[i], { uid: `u${i}`, name, avatar: '🦊', joinedAt: now + i }])),
    presence: Object.fromEntries(pids.map((p) => [p, true])),
  };
  db.rooms = { [CODE]: room };
  const sim = {
    db,
    pids,
    pack,
    rng,
    get room(): Room {
      return db.rooms[CODE];
    },
    get now() {
      return now;
    },
    ctx(): engine.Ctx {
      return { code: CODE, now, pack, history: db.history?.['work-team']?.general ?? {}, rng };
    },
    apply(u: Updates | null) {
      if (u) applyUpdates(db, u);
    },
    advance() {
      sim.apply(engine.advance(sim.room, sim.ctx()));
    },
    tick() {
      const u = engine.tick(sim.room, sim.ctx());
      sim.apply(u);
      return u;
    },
    wait(seconds: number) {
      now += seconds * 1000;
    },
    act: actions,
    phase() {
      return sim.room.state.phase;
    },
  };
  return sim;
}
