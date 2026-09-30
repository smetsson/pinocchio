import { describe, expect, it } from 'vitest';
import { newSim, CODE } from './sim';
import * as engine from '../../src/logic/engine';
import { GAME } from '../../src/config/game';

describe('latecomers', () => {
  it('can join mid-round, lie and vote, and are never the subject of rounds 1–2', () => {
    const sim = newSim(['Ann', 'Bob', 'Cas']);
    sim.advance();
    for (const pid of sim.pids)
      for (const id of sim.room.pub!.prompts![pid].slice(0, GAME.truthsPerPlayer))
        sim.apply(sim.act.truthUpdates(sim.room, CODE, pid, id, `t ${pid} ${id}`));
    sim.tick();
    expect(sim.phase()).toBe('r-lie');

    sim.apply({ [`rooms/${CODE}/players/late`]: { uid: 'x', name: 'Late', avatar: '🐢', joinedAt: sim.now }, [`rooms/${CODE}/presence/late`]: true });
    expect(engine.expectedPids(sim.room)).toContain('late');
    expect(sim.room.pub!.questions!.some((q) => q.subject === 'late')).toBe(false);

    const q = sim.room.state.q;
    const subject = engine.currentSubject(sim.room)!;
    for (const pid of [...sim.pids, 'late']) if (pid !== subject) sim.apply(sim.act.lieUpdates(CODE, pid, q, `lie ${pid}`));
    sim.tick();
    expect(sim.phase()).toBe('r-pick');
    const owners = sim.room.secret!.owners![q];
    expect(Object.values(owners)).toContain('late');
    // Everyone except "late" falls for late's lie.
    const lateOpt = Object.keys(owners).find((id) => owners[id] === 'late')!;
    const truthOpt = Object.keys(owners).find((id) => owners[id] === 'TRUTH')!;
    for (const pid of [...sim.pids, 'late']) if (pid !== subject) sim.apply(sim.act.voteUpdates(CODE, pid, q, pid === 'late' ? truthOpt : lateOpt));
    sim.tick();
    expect(sim.room.pub!.scores!.late).toBeGreaterThan(0);
  });
});

describe('host failover', () => {
  it('picks the first connected player once the host has been away long enough', () => {
    const sim = newSim(['Host', 'Ann', 'Bob']);
    sim.advance(); // truths (live)
    sim.apply({ [`rooms/${CODE}/presence/p0`]: sim.now, [`rooms/${CODE}/presence/p1`]: sim.now });
    expect(engine.backupHost(sim.room, sim.now + 5_000)).toBeUndefined();
    // Ann is away too, so Bob stands in.
    expect(engine.backupHost(sim.room, sim.now + (GAME.hostFailoverSeconds + 1) * 1000)).toBe('p2');
    sim.apply({ [`rooms/${CODE}/presence/p1`]: true });
    expect(engine.backupHost(sim.room, sim.now + (GAME.hostFailoverSeconds + 1) * 1000)).toBe('p1');
  });

  it('never fails over in the lobby or days ahead in pre-call mode', () => {
    const lobby = newSim(['Host', 'Ann', 'Bob']);
    lobby.apply({ [`rooms/${CODE}/presence/p0`]: lobby.now });
    expect(engine.backupHost(lobby.room, lobby.now + 3600_000)).toBeUndefined();
    const pre = newSim(['Host', 'Ann', 'Bob'], { mode: 'precall' });
    pre.advance();
    pre.apply({ [`rooms/${CODE}/presence/p0`]: pre.now });
    expect(engine.backupHost(pre.room, pre.now + 3600_000)).toBeUndefined();
  });
});

describe('rematch', () => {
  it('copies the players and settings into a fresh live-mode lobby', () => {
    const sim = newSim(['Host', 'Ann', 'Bob'], { mode: 'precall', length: 'short' });
    sim.apply(engine.kick(sim.ctx(), 'p2'));
    const next = engine.rematchRoom(sim.room, sim.now, 'u0');
    expect(Object.keys(next.players!)).toEqual(['p0', 'p1']);
    expect(next.meta).toMatchObject({ mode: 'live', length: 'short', group: 'Work Team', ownerPid: 'p0', hostUid: 'u0' });
    expect(next.state.phase).toBe('lobby');
  });
});
