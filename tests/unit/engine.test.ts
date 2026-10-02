import { describe, expect, it } from 'vitest';
import { newSim, CODE } from './sim';
import * as engine from '../../src/logic/engine';
import { SCORING } from '../../src/config/scoring';
import { GAME, TIMERS } from '../../src/config/game';
import type { Pid } from '../../src/logic/types';

type Sim = ReturnType<typeof newSim>;

function answerTruths(sim: Sim) {
  for (const pid of sim.pids) {
    const prompts = sim.room.pub!.prompts![pid];
    for (const promptId of prompts.slice(0, GAME.truthsPerPlayer)) {
      sim.apply(sim.act.truthUpdates(sim.room, CODE, pid, promptId, `truth of ${pid} for ${promptId}`));
    }
  }
}

function writeLies(sim: Sim) {
  const q = sim.room.state.q;
  const subject = engine.currentSubject(sim.room)!;
  for (const pid of sim.pids) {
    if (pid === subject) continue;
    const text = `lie by ${pid}`;
    expect(sim.act.checkLie(sim.room, CODE, q, text)).toBe('ok');
    sim.apply(sim.act.lieUpdates(CODE, pid, q, text));
  }
}

/** Everyone votes for the truth, except `fooled` who vote for `liar`'s lie. */
function vote(sim: Sim, liar?: Pid, fooled: Pid[] = []) {
  const q = sim.room.state.q;
  const subject = engine.currentSubject(sim.room)!;
  const owners = sim.room.secret!.owners![q];
  const truthId = Object.keys(owners).find((id) => owners[id] === 'TRUTH')!;
  const liarId = liar ? Object.keys(owners).find((id) => owners[id] === liar)! : undefined;
  for (const pid of sim.pids) {
    if (pid === subject) continue;
    const pick = fooled.includes(pid) && liarId ? liarId : truthId;
    sim.apply(sim.act.voteUpdates(CODE, pid, q, pick));
  }
}

function playQuestion(sim: Sim, liar?: Pid, fooled: Pid[] = []) {
  expect(sim.phase()).toBe('r-lie');
  writeLies(sim);
  sim.tick(); // everyone done -> pick
  expect(sim.phase()).toBe('r-pick');
  vote(sim, liar, fooled);
  sim.tick(); // everyone voted -> reveal
  expect(sim.phase()).toBe('r-reveal');
  const steps = engine.revealStepCount(sim.room.pub!.reveal![sim.room.state.q]);
  for (let i = 0; i < steps; i++) sim.advance();
}

describe('engine: full game', () => {
  it('plays a 6-player full game from lobby to awards (every answer gets played)', () => {
    const sim = newSim(['Ann', 'Bob', 'Cas', 'Dee', 'Eva', 'Fay']);
    sim.advance(); // lobby -> truths
    expect(sim.phase()).toBe('truths');
    for (const pid of sim.pids) expect(sim.room.pub!.prompts![pid]).toHaveLength(GAME.truthsPerPlayer + GAME.sparePromptsPerPlayer);
    const allDealt = Object.values(sim.room.pub!.prompts!).flat();
    expect(new Set(allDealt).size).toBe(allDealt.length); // nobody shares a prompt

    answerTruths(sim);
    sim.tick(); // everyone done -> round 1
    expect(sim.phase()).toBe('r-lie');

    const questions = sim.room.pub!.questions!;
    expect(questions).toHaveLength(12); // 6 players x 2 answers
    expect(questions.filter((q) => q.round === 1)).toHaveLength(6);
    // Everyone is featured at least once; no one twice in the same round.
    expect(new Set(questions.map((q) => q.subject)).size).toBe(6);
    for (const r of [1, 2]) {
      const subjects = questions.filter((q) => q.round === r).map((q) => q.subject);
      expect(new Set(subjects).size).toBe(subjects.length);
    }
    // Played prompts are remembered for next month.
    expect(sim.db.history['work-team'].general[questions[0].promptId]).toBe(sim.now);

    for (let i = 0; i < 6; i++) playQuestion(sim);
    expect(sim.phase()).toBe('r-end');
    sim.advance();
    expect(sim.phase()).toBe('r-lie');
    expect(engine.currentRound(sim.room)).toBe(2);
    for (let i = 0; i < 6; i++) playQuestion(sim);
    expect(sim.phase()).toBe('r-end');
    sim.advance();
    expect(sim.phase()).toBe('f-write');

    for (const pid of sim.pids) sim.apply(sim.act.finalUpdates(CODE, pid, `true ${pid}`, `lie ${pid}`));
    sim.tick();
    expect(sim.phase()).toBe('f-pick');
    expect(sim.room.pub!.final).toHaveLength(6);
    for (let i = 0; i < 6; i++) {
      expect(sim.phase()).toBe('f-pick');
      const fq = sim.room.pub!.final![i];
      const truthIndex = sim.room.secret!.finalTruth![i];
      for (const pid of sim.pids) if (pid !== fq.subject) sim.apply(sim.act.finalVoteUpdates(CODE, pid, i, truthIndex));
      sim.tick();
      expect(sim.phase()).toBe('f-reveal');
      sim.advance();
      sim.advance();
    }
    expect(sim.phase()).toBe('end');
    expect(sim.room.pub!.awards!.find((a) => a.id === 'detector')).toBeTruthy();
    expect(sim.db.roomIndex[CODE]).toBe(sim.room.meta.expiresAt);
  });
});

describe('engine: scoring', () => {
  function toFirstPick(sim: Sim) {
    sim.advance();
    answerTruths(sim);
    sim.tick();
    writeLies(sim);
    sim.tick();
  }

  it('scores truth pickers, fooled players and likes', () => {
    const sim = newSim(['Ann', 'Bob', 'Cas', 'Dee']);
    toFirstPick(sim);
    const q = sim.room.state.q;
    const subject = engine.currentSubject(sim.room)!;
    const [liar, ...others] = sim.pids.filter((p) => p !== subject);
    vote(sim, liar, [others[0]]);
    // others[1] likes the liar's lie.
    const owners = sim.room.secret!.owners![q];
    const liarOpt = Object.keys(owners).find((id) => owners[id] === liar)!;
    sim.apply(sim.act.likeUpdates(CODE, others[1], q, liarOpt));
    sim.tick();
    const scores = sim.room.pub!.scores!;
    const m = SCORING.multiplier[1];
    expect(scores[liar]).toBe((SCORING.pickedTruth + SCORING.perPlayerFooled + SCORING.perLike) * m);
    expect(scores[others[0]]).toBe(0);
    expect(scores[others[1]]).toBe(SCORING.pickedTruth * m);
    expect(scores[subject]).toBe(0);
    const reveal = sim.room.pub!.reveal![q];
    expect(reveal.steps.at(-1)!.kind).toBe('truth');
    expect(reveal.steps[0].author).toBe(liar);
  });

  it('lets the subject 👍 a lie (but liking their own truth counts for nothing)', () => {
    const sim = newSim(['Ann', 'Bob', 'Cas']);
    toFirstPick(sim);
    const q = sim.room.state.q;
    const subject = engine.currentSubject(sim.room)!;
    const liar = sim.pids.find((p) => p !== subject)!;
    const owners = sim.room.secret!.owners![q];
    const liarOpt = Object.keys(owners).find((id) => owners[id] === liar)!;
    sim.apply(sim.act.likeUpdates(CODE, subject, q, liarOpt));
    vote(sim);
    sim.tick();
    const m = SCORING.multiplier[1];
    expect(sim.room.pub!.scores![liar]).toBe((SCORING.pickedTruth + SCORING.perLike) * m);
    expect(sim.room.pub!.stats![liar].likes).toBe(1);

    const sim2 = newSim(['Ann', 'Bob', 'Cas']);
    toFirstPick(sim2);
    const q2 = sim2.room.state.q;
    const subject2 = engine.currentSubject(sim2.room)!;
    const owners2 = sim2.room.secret!.owners![q2];
    const truthOpt = Object.keys(owners2).find((id) => owners2[id] === 'TRUTH')!;
    sim2.apply(sim2.act.likeUpdates(CODE, subject2, q2, truthOpt));
    vote(sim2);
    sim2.tick();
    const truthStep = sim2.room.pub!.reveal![q2].steps.find((s) => s.kind === 'truth')!;
    expect(truthStep.likes).toBe(0);
  });

  it('ignores a vote for your own lie', () => {
    const sim = newSim(['Ann', 'Bob', 'Cas']);
    toFirstPick(sim);
    const q = sim.room.state.q;
    const subject = engine.currentSubject(sim.room)!;
    const cheater = sim.pids.find((p) => p !== subject)!;
    const mine = sim.room.toPlayer![cheater].mine![q];
    sim.apply(sim.act.voteUpdates(CODE, cheater, q, mine));
    sim.advance();
    expect(sim.room.pub!.scores![cheater]).toBe(0);
  });

  it('doubles points in round 2', () => {
    expect(SCORING.multiplier[2]).toBe(2 * SCORING.multiplier[1]);
  });
});

describe('engine: lies', () => {
  it('rejects the truth and duplicate lies after normalizing', () => {
    const sim = newSim(['Ann', 'Bob', 'Cas']);
    sim.advance();
    answerTruths(sim);
    sim.tick();
    const q = sim.room.state.q;
    const question = sim.room.pub!.questions![q];
    const truth = sim.room.priv![question.subject].truths![question.promptId];
    expect(sim.act.checkLie(sim.room, CODE, q, truth.toUpperCase() + '!!')).toBe('truth');
    const [a, b] = sim.pids.filter((p) => p !== question.subject);
    sim.apply(sim.act.lieUpdates(CODE, a, q, 'A Dolphin Trainer'));
    expect(sim.act.checkLie(sim.room, CODE, q, 'dolphin   trainer.')).toBe('taken');
    expect(sim.act.checkLie(sim.room, CODE, q, '   ')).toBe('empty');
    expect(sim.act.checkLie(sim.room, CODE, q, 'x'.repeat(200))).toBe('too-long');
    expect(sim.act.checkLie(sim.room, CODE, q, 'zookeeper')).toBe('ok');
    void b;
  });

  it('adds house lies when too few players lied', () => {
    const sim = newSim(['Ann', 'Bob', 'Cas']);
    sim.advance();
    answerTruths(sim);
    sim.tick();
    sim.wait(TIMERS.lie + 1);
    sim.tick(); // time's up, nobody lied
    expect(sim.phase()).toBe('r-pick');
    const owners = Object.values(sim.room.secret!.owners![sim.room.state.q]);
    expect(owners.filter((o) => o === 'TRUTH')).toHaveLength(1);
    expect(owners.filter((o) => o === 'HOUSE')).toHaveLength(GAME.minOptions - 1);
  });
});

describe('engine: timers and waiting', () => {
  it('auto-advances on the deadline and supports extend', () => {
    const sim = newSim(['Ann', 'Bob', 'Cas']);
    sim.advance();
    const deadline = sim.room.state.deadline;
    sim.apply(engine.extend(sim.room, sim.ctx()));
    expect(sim.room.state.deadline).toBe(deadline + TIMERS.extend * 1000);
    sim.wait(TIMERS.truths);
    expect(sim.tick()).toBeNull();
    sim.wait(TIMERS.extend + 1);
    sim.tick();
    // No truths answered at all -> skip straight to the final round.
    expect(sim.phase()).toBe('f-write');
  });

  it("doesn't wait for disconnected or kicked players", () => {
    const sim = newSim(['Ann', 'Bob', 'Cas', 'Dee']);
    sim.advance();
    answerTruths(sim);
    sim.tick();
    const subject = engine.currentSubject(sim.room)!;
    const [a, b, c] = sim.pids.filter((p) => p !== subject);
    sim.apply(sim.act.lieUpdates(CODE, a, sim.room.state.q, 'one'));
    sim.apply({ [`rooms/${CODE}/presence/${b}`]: sim.now });
    sim.apply(engine.kick(sim.ctx(), c));
    expect(engine.waitingFor(sim.room)).toEqual([b]);
    expect(sim.tick()).toBeNull(); // b only just dropped
    sim.wait(GAME.awayAfterSeconds + 1);
    sim.tick();
    expect(sim.phase()).toBe('r-pick');
  });

  it('pre-call mode waits for the host to start and deals prompts to late joiners', () => {
    const sim = newSim(['Ann', 'Bob', 'Cas'], { mode: 'precall' });
    sim.advance();
    expect(sim.room.state.deadline).toBe(0);
    answerTruths(sim);
    sim.wait(3 * 24 * 3600);
    expect(sim.tick()).toBeNull();
    sim.apply({ [`rooms/${CODE}/players/late`]: { uid: 'x', name: 'Late', avatar: '🐢', joinedAt: sim.now } });
    sim.tick();
    expect(sim.room.pub!.prompts!.late).toHaveLength(GAME.truthsPerPlayer + GAME.sparePromptsPerPlayer);
    sim.advance();
    expect(sim.phase()).toBe('r-lie');
  });

  it('bumps the state version on every transition', () => {
    const sim = newSim(['Ann', 'Bob', 'Cas']);
    sim.advance();
    expect(sim.room.state.v).toBe(1);
    sim.apply(engine.extend(sim.room, sim.ctx()));
    expect(sim.room.state.v).toBe(2);
  });
});

describe('engine: round title cards', () => {
  it('shows a timed title card before round 1, round 2 and the final round', () => {
    const sim = newSim(['Ann', 'Bob', 'Cas'], { length: 'short', keepIntros: true });
    sim.advance();
    answerTruths(sim);
    sim.tick();
    expect(sim.phase()).toBe('intro');
    expect(engine.currentRound(sim.room)).toBe(1);
    expect(engine.expectedPids(sim.room)).toEqual([]);
    expect(sim.tick()).toBeNull(); // waits for the card's timer
    sim.wait(TIMERS.intro + 1);
    sim.tick();
    expect(sim.phase()).toBe('r-lie');
    // The host can also skip a card.
    const questions = sim.room.pub!.questions!;
    sim.apply({ [`rooms/${CODE}/state`]: { ...sim.room.state, phase: 'r-end', q: questions.filter((x) => x.round === 1).length - 1, v: sim.room.state.v + 1 } });
    sim.advance();
    expect(sim.phase()).toBe('intro');
    expect(engine.currentRound(sim.room)).toBe(2);
    sim.advance();
    expect(sim.phase()).toBe('r-lie');
    expect(engine.currentRound(sim.room)).toBe(2);
  });
});

describe('engine: scoreboard animation', () => {
  it('knows the scores from before the round that just ended', () => {
    const sim = newSim(['Ann', 'Bob', 'Cas'], { length: 'short' });
    sim.advance();
    answerTruths(sim);
    sim.tick();
    const round1 = sim.room.pub!.questions!.filter((q) => q.round === 1).length;
    for (let i = 0; i < round1; i++) playQuestion(sim);
    expect(sim.phase()).toBe('r-end');
    const before = engine.scoresBefore(sim.room);
    for (const pid of sim.pids) expect(before[pid]).toBe(0); // nothing before round 1
    sim.advance(); // round 2
    for (let i = 0; i < sim.room.pub!.questions!.length - round1; i++) playQuestion(sim);
    expect(sim.phase()).toBe('r-end');
    const afterRound1 = engine.scoresBefore(sim.room);
    const now = sim.room.pub!.scores!;
    // Everyone found the truth in every question: round 2 gave each voter points.
    expect(Object.values(now).reduce((a, b) => a + b)).toBeGreaterThan(Object.values(afterRound1).reduce((a, b) => a + b));
    expect(engine.standings(sim.room, afterRound1)).toHaveLength(3);
  });
});

describe('engine: short game', () => {
  it('still plays 3 questions per round when some players did not answer', () => {
    const sim = newSim(['Ann', 'Bob', 'Cas', 'Dee'], { length: 'short' });
    sim.advance();
    // Only Ann and Bob answered (2 answers each).
    for (const pid of ['p0', 'p1'])
      for (const id of sim.room.pub!.prompts![pid].slice(0, GAME.truthsPerPlayer))
        sim.apply(sim.act.truthUpdates(sim.room, CODE, pid, id, `t ${pid} ${id}`));
    sim.advance();
    const questions = sim.room.pub!.questions!;
    expect(questions.filter((q) => q.round === 1)).toHaveLength(3);
    expect(questions).toHaveLength(4); // all 4 answers that exist
  });

  it('uses 3 questions per round', () => {
    const sim = newSim(['Ann', 'Bob', 'Cas', 'Dee', 'Eva', 'Fay'], { length: 'short' });
    sim.advance();
    answerTruths(sim);
    sim.tick();
    expect(sim.room.pub!.questions).toHaveLength(6);
  });
});
