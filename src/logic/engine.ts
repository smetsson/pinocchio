/**
 * The game engine. Pure functions: (room snapshot, time) -> database updates.
 * Only the host's phone runs these; everyone else just renders the state.
 */
import { GAME, TIMERS } from '../config/game';
import { SCORING } from '../config/scoring';
import { answerHash, normalize } from './normalize';
import { dealPrompts, historyPath, type PromptHistory } from './prompts';
import { randomId, shuffle, type Rng } from './random';
import type {
  Award,
  FinalQuestion,
  FinalReveal,
  GameState,
  Option,
  Pid,
  Player,
  PromptPack,
  Question,
  Reveal,
  RevealStep,
  Room,
  Stats,
  Updates,
} from './types';

export interface Ctx {
  code: string;
  now: number;
  pack: PromptPack;
  history?: PromptHistory;
  rng?: Rng;
  /** Test mode: multiply all timers (e.g. 0.2 = five times faster). */
  timeScale?: number;
}

const EMPTY_STATS: Stats = { fooled: 0, found: 0, likes: 0, asked: 0, missed: 0 };

// ---------- Helpers everyone (host and players) uses ----------

export function roomPath(code: string, sub = ''): string {
  return sub ? `rooms/${code}/${sub}` : `rooms/${code}`;
}

/** Players still in the game, in join order. */
export function activePids(room: Room): Pid[] {
  return Object.entries(room.players ?? {})
    .filter(([, p]) => !p.kicked)
    .sort((a, b) => a[1].joinedAt - b[1].joinedAt)
    .map(([pid]) => pid);
}

export function isAway(room: Room, pid: Pid, now: number): boolean {
  const p = room.presence?.[pid];
  if (p === true) return false;
  if (typeof p !== 'number') return true;
  return now - p > GAME.awayAfterSeconds * 1000;
}

/** Who the current question / final pick is about. */
export function currentSubject(room: Room): Pid | undefined {
  const { phase, q } = room.state;
  if (phase.startsWith('r-') && phase !== 'r-end') return room.pub?.questions?.[q]?.subject;
  if (phase.startsWith('f-') && phase !== 'f-write') return room.pub?.final?.[q]?.subject;
  return undefined;
}

export function currentRound(room: Room): 1 | 2 | 3 {
  const { phase, q, step } = room.state;
  if (phase === 'intro') return (step as 1 | 2 | 3) || 1;
  if (phase.startsWith('f-') || phase === 'end') return 3;
  return room.pub?.questions?.[q]?.round ?? 1;
}

/** The public "done" flag key for the current phase, e.g. "lie-3". */
export function statusKey(state: GameState): string | undefined {
  switch (state.phase) {
    case 'truths':
      return 'truths';
    case 'r-lie':
      return `lie-${state.q}`;
    case 'r-pick':
      return `vote-${state.q}`;
    case 'f-write':
      return 'final';
    case 'f-pick':
      return `fvote-${state.q}`;
    default:
      return undefined;
  }
}

/** Players who are expected to submit something in the current phase. */
export function expectedPids(room: Room): Pid[] {
  const active = activePids(room);
  const subject = currentSubject(room);
  switch (room.state.phase) {
    case 'truths':
    case 'f-write':
      return active;
    case 'r-lie':
    case 'r-pick':
    case 'f-pick':
      return active.filter((pid) => pid !== subject);
    default:
      return [];
  }
}

export function hasSubmitted(room: Room, pid: Pid): boolean {
  const key = statusKey(room.state);
  return !!key && !!room.status?.[pid]?.[key];
}

/** Players we're still waiting for (including those who look away). */
export function waitingFor(room: Room): Pid[] {
  return expectedPids(room).filter((pid) => !hasSubmitted(room, pid));
}

/** True when everyone who is connected has submitted. */
export function everyoneDone(room: Room, now: number): boolean {
  const expected = expectedPids(room).filter((pid) => !isAway(room, pid, now) || hasSubmitted(room, pid));
  return expected.length > 0 && expected.every((pid) => hasSubmitted(room, pid));
}

// ---------- Host-side transitions ----------

function nextState(room: Room, patch: Partial<GameState>): GameState {
  return { ...room.state, deadline: 0, step: 0, ...patch, v: (room.state.v ?? 0) + 1 };
}

function withState(ctx: Ctx, room: Room, patch: Partial<GameState>, u: Updates = {}): Updates {
  u[roomPath(ctx.code, 'state')] = nextState(room, patch);
  return u;
}

function deadlineIn(ctx: Ctx, seconds: number): number {
  return ctx.now + Math.round(seconds * 1000 * (ctx.timeScale ?? 1));
}

function promptsPerPlayer(): number {
  return GAME.truthsPerPlayer + GAME.sparePromptsPerPlayer;
}

/** Deal prompts to players that don't have any yet (late joiners during the truth phase). */
export function dealMissingPrompts(room: Room, ctx: Ctx): Updates {
  const existing = room.pub?.prompts ?? {};
  const missing = activePids(room).filter((pid) => !existing[pid]?.length);
  if (!missing.length) return {};
  const dealt = dealPrompts(missing, ctx.pack, promptsPerPlayer(), ctx.history, existing, ctx.rng);
  const u: Updates = {};
  for (const [pid, ids] of Object.entries(dealt)) u[roomPath(ctx.code, `pub/prompts/${pid}`)] = ids;
  return u;
}

/** Open the truth phase. Pre-call mode has no deadline: the host starts the game manually. */
export function openTruths(room: Room, ctx: Ctx): Updates {
  const u = dealMissingPrompts(room, ctx);
  const deadline = room.meta.mode === 'live' ? deadlineIn(ctx, TIMERS.truths) : 0;
  return withState(ctx, room, { phase: 'truths', q: 0, deadline }, u);
}

/** Answered truths per player, in the order the prompts were dealt. */
export function answeredTruths(room: Room, pid: Pid): string[] {
  const dealt = room.pub?.prompts?.[pid] ?? [];
  const truths = room.priv?.[pid]?.truths ?? {};
  return dealt.filter((id) => (truths[id] ?? '').trim().length > 0);
}

/**
 * Choose which truths are played in round 1 and 2. Every player is featured
 * before anyone is featured twice; a round never features the same player twice.
 */
export function planQuestions(room: Room, ctx: Ctx): Question[] {
  const active = activePids(room);
  const perRound = Math.min(GAME.questionsPerRound[room.meta.length], active.length);
  const remaining = new Map<Pid, string[]>(
    shuffle(active, ctx.rng).map((pid) => [pid, answeredTruths(room, pid)]),
  );
  const featured = new Map<Pid, number>();
  const questions: Question[] = [];
  for (const round of [1, 2] as const) {
    const inRound = new Set<Pid>();
    for (let i = 0; i < perRound; i++) {
      const candidates = [...remaining.entries()]
        .filter(([pid, ids]) => ids.length > 0 && !inRound.has(pid))
        .sort((a, b) => (featured.get(a[0]) ?? 0) - (featured.get(b[0]) ?? 0));
      if (!candidates.length) break;
      const [pid, ids] = candidates[0];
      const promptId = ids.shift()!;
      inRound.add(pid);
      featured.set(pid, (featured.get(pid) ?? 0) + 1);
      const index = questions.length;
      const truth = room.priv![pid].truths![promptId];
      questions.push({ round, subject: pid, promptId, truthHash: answerHash(truth, ctx.code, index) });
    }
  }
  // If round 1 got everything and round 2 nothing (tiny games), split evenly.
  if (questions.length > 1 && questions.every((q) => q.round === 1)) {
    const half = Math.ceil(questions.length / 2);
    questions.forEach((q, i) => (q.round = i < half ? 1 : 2));
  }
  return questions;
}

/** A few seconds of "Round 2 · double points!" so everyone on the call knows where we are. */
function startIntro(room: Room, ctx: Ctx, round: 1 | 2 | 3, q: number, u: Updates = {}): Updates {
  return withState(ctx, room, { phase: 'intro', q, step: round, deadline: deadlineIn(ctx, TIMERS.intro) }, u);
}

function startQuestion(room: Room, ctx: Ctx, q: number, u: Updates = {}): Updates {
  const question = room.pub!.questions![q];
  u[`${historyPath(room.meta.group ?? 'default', room.meta.pack)}/${question.promptId}`] = ctx.now;
  return withState(ctx, room, { phase: 'r-lie', q, deadline: deadlineIn(ctx, TIMERS.lie) }, u);
}

/** Truth phase over: plan the questions and start round 1. */
export function startRounds(room: Room, ctx: Ctx): Updates {
  const questions = planQuestions(room, ctx);
  const u: Updates = { [roomPath(ctx.code, 'pub/questions')]: questions };
  if (!questions.length) return startIntro(room, ctx, 3, 0, u);
  return startIntro(room, ctx, 1, 0, u);
}

/** Lie phase over: shuffle the truth, the lies and (if needed) house lies into options. */
export function startPick(room: Room, ctx: Ctx): Updates {
  const q = room.state.q;
  const question = room.pub!.questions![q];
  const truth = room.priv?.[question.subject]?.truths?.[question.promptId] ?? '';
  const seen = new Set<string>([normalize(truth)]);
  const entries: { text: string; owner: string }[] = [{ text: truth.trim(), owner: 'TRUTH' }];

  for (const pid of activePids(room)) {
    if (pid === question.subject) continue;
    const lie = room.priv?.[pid]?.lies?.[q];
    if (!lie) continue;
    const n = normalize(lie.text);
    if (!n || seen.has(n)) continue;
    seen.add(n);
    entries.push({ text: lie.text.trim(), owner: pid });
  }

  const prompt = ctx.pack.prompts.find((p) => p.id === question.promptId);
  for (const house of shuffle(prompt?.lies ?? [], ctx.rng)) {
    if (entries.length >= GAME.minOptions) break;
    const n = normalize(house);
    if (seen.has(n)) continue;
    seen.add(n);
    entries.push({ text: house, owner: 'HOUSE' });
  }

  const options: Option[] = [];
  const owners: Record<string, string> = {};
  const u: Updates = {};
  for (const e of shuffle(entries, ctx.rng)) {
    const id = randomId(6, ctx.rng);
    options.push({ id, text: e.text });
    owners[id] = e.owner;
    if (e.owner !== 'TRUTH' && e.owner !== 'HOUSE') {
      u[roomPath(ctx.code, `toPlayer/${e.owner}/mine/${q}`)] = id;
    }
  }
  u[roomPath(ctx.code, `pub/options/${q}`)] = options;
  u[roomPath(ctx.code, `secret/owners/${q}`)] = owners;
  return withState(ctx, room, { phase: 'r-pick', q, deadline: deadlineIn(ctx, TIMERS.pick) }, u);
}

function addStats(stats: Record<Pid, Stats>, pid: Pid, patch: Partial<Stats>) {
  const s = (stats[pid] ??= { ...EMPTY_STATS });
  for (const [k, v] of Object.entries(patch) as [keyof Stats, number][]) s[k] += v;
}

/** Score one round-1/2 question. Pure; also used by tests. */
export function scoreQuestion(room: Room, q: number): { reveal: Reveal; stats: Record<Pid, Stats> } {
  const question = room.pub!.questions![q];
  const mult = SCORING.multiplier[question.round] ?? 1;
  const options = room.pub?.options?.[q] ?? [];
  const owners = room.secret?.owners?.[q] ?? {};
  const voters = activePids(room).filter((pid) => pid !== question.subject);

  const pickers: Record<string, Pid[]> = {};
  const likes: Record<string, number> = {};
  for (const pid of voters) {
    const vote = room.priv?.[pid]?.votes?.[q];
    // Can't pick your own lie (the rules block it too).
    if (vote && owners[vote] !== undefined && owners[vote] !== pid) (pickers[vote] ??= []).push(pid);
  }
  // Everyone can 👍 a lie, including the player the question is about (but not their own truth).
  for (const pid of activePids(room)) {
    const like = room.priv?.[pid]?.likes?.[q];
    const owner = like ? owners[like] : undefined;
    if (!like || owner === undefined || owner === pid) continue;
    if (pid === question.subject && owner === 'TRUTH') continue;
    likes[like] = (likes[like] ?? 0) + 1;
  }

  const deltas: Record<Pid, number> = {};
  const add = (pid: Pid, pts: number) => (deltas[pid] = (deltas[pid] ?? 0) + pts);
  const stats: Record<Pid, Stats> = {};
  for (const pid of activePids(room)) add(pid, 0);

  const steps: RevealStep[] = options.map((o) => {
    const owner = owners[o.id];
    const kind = owner === 'TRUTH' ? 'truth' : owner === 'HOUSE' ? 'house' : 'lie';
    const step: RevealStep = { optId: o.id, text: o.text, kind, pickers: pickers[o.id] ?? [], likes: likes[o.id] ?? 0 };
    if (kind === 'lie') step.author = owner;
    return step;
  });

  const votedCount = voters.filter((pid) => room.priv?.[pid]?.votes?.[q]).length;
  let truthFinders = 0;
  for (const s of steps) {
    if (s.kind === 'truth') {
      truthFinders = s.pickers.length;
      for (const pid of s.pickers) {
        add(pid, SCORING.pickedTruth * mult);
        addStats(stats, pid, { found: 1 });
      }
    } else if (s.kind === 'lie' && s.author) {
      add(s.author, (SCORING.perPlayerFooled * s.pickers.length + SCORING.perLike * s.likes) * mult);
      addStats(stats, s.author, { fooled: s.pickers.length, likes: s.likes });
    }
  }
  add(question.subject, SCORING.subjectPerTruthFound * truthFinders * mult);
  addStats(stats, question.subject, { asked: votedCount, missed: votedCount - truthFinders });

  // Reveal order: lies that fooled fewest people first, the truth last.
  const truthStep = steps.find((s) => s.kind === 'truth')!;
  const picked = steps
    .filter((s) => s.kind !== 'truth' && s.pickers.length > 0)
    .sort((a, b) => a.pickers.length - b.pickers.length);
  const unpicked = steps.filter((s) => s.kind !== 'truth' && s.pickers.length === 0);
  return { reveal: { steps: [...picked, truthStep], unpicked, deltas }, stats };
}

function applyScores(room: Room, ctx: Ctx, deltas: Record<Pid, number>, stats: Record<Pid, Stats>, u: Updates) {
  for (const [pid, d] of Object.entries(deltas)) {
    u[roomPath(ctx.code, `pub/scores/${pid}`)] = (room.pub?.scores?.[pid] ?? 0) + d;
  }
  for (const [pid, s] of Object.entries(stats)) {
    const prev = room.pub?.stats?.[pid] ?? EMPTY_STATS;
    u[roomPath(ctx.code, `pub/stats/${pid}`)] = {
      fooled: prev.fooled + s.fooled,
      found: prev.found + s.found,
      likes: prev.likes + s.likes,
      asked: prev.asked + s.asked,
      missed: prev.missed + s.missed,
    };
  }
}

export function startReveal(room: Room, ctx: Ctx): Updates {
  const q = room.state.q;
  const { reveal, stats } = scoreQuestion(room, q);
  const u: Updates = { [roomPath(ctx.code, `pub/reveal/${q}`)]: reveal };
  applyScores(room, ctx, reveal.deltas, stats, u);
  return withState(ctx, room, { phase: 'r-reveal', q, step: 0 }, u);
}

/** Number of reveal steps including the final "points" summary. */
export function revealStepCount(reveal: Reveal | undefined): number {
  return (reveal?.steps?.length ?? 1) + 1;
}

function afterQuestion(room: Room, ctx: Ctx): Updates {
  const q = room.state.q;
  const questions = room.pub!.questions!;
  const next = questions[q + 1];
  if (next && next.round === questions[q].round) return startQuestion(room, ctx, q + 1);
  return withState(ctx, room, { phase: 'r-end', q });
}

export function startFinal(room: Room, ctx: Ctx): Updates {
  return withState(ctx, room, { phase: 'f-write', q: 0, deadline: deadlineIn(ctx, TIMERS.finalWrite) });
}

export function startFinalPicks(room: Room, ctx: Ctx): Updates {
  const subjects = shuffle(
    activePids(room).filter((pid) => {
      const f = room.priv?.[pid]?.final;
      return f?.truth?.trim() && f?.lie?.trim();
    }),
    ctx.rng,
  );
  if (!subjects.length) return endGame(room, ctx);
  const final: FinalQuestion[] = [];
  const finalTruth: Record<string, 0 | 1> = {};
  subjects.forEach((pid, i) => {
    const f = room.priv![pid].final!;
    const truthFirst = (ctx.rng ?? Math.random)() < 0.5;
    final.push({ subject: pid, options: truthFirst ? [f.truth.trim(), f.lie.trim()] : [f.lie.trim(), f.truth.trim()] });
    finalTruth[i] = truthFirst ? 0 : 1;
  });
  const u: Updates = {
    [roomPath(ctx.code, 'pub/final')]: final,
    [roomPath(ctx.code, 'secret/finalTruth')]: finalTruth,
  };
  return withState(ctx, room, { phase: 'f-pick', q: 0, deadline: deadlineIn(ctx, TIMERS.finalPick) }, u);
}

export function scoreFinal(room: Room, i: number): { reveal: FinalReveal; stats: Record<Pid, Stats> } {
  const fq = room.pub!.final![i];
  const truthIndex = room.secret!.finalTruth![i];
  const mult = SCORING.multiplier[3] ?? 1;
  const right: Pid[] = [];
  const fooled: Pid[] = [];
  const deltas: Record<Pid, number> = {};
  const stats: Record<Pid, Stats> = {};
  for (const pid of activePids(room)) {
    deltas[pid] = 0;
    if (pid === fq.subject) continue;
    const vote = room.priv?.[pid]?.fvotes?.[i];
    if (vote === undefined || vote === null) continue;
    if (vote === truthIndex) {
      right.push(pid);
      deltas[pid] += SCORING.pickedTruth * mult;
      addStats(stats, pid, { found: 1 });
    } else {
      fooled.push(pid);
    }
  }
  deltas[fq.subject] = (deltas[fq.subject] ?? 0) + SCORING.perPlayerFooled * fooled.length * mult;
  addStats(stats, fq.subject, { fooled: fooled.length, asked: right.length + fooled.length, missed: fooled.length });
  return { reveal: { truthIndex, right, fooled, deltas }, stats };
}

export function startFinalReveal(room: Room, ctx: Ctx): Updates {
  const i = room.state.q;
  const { reveal, stats } = scoreFinal(room, i);
  const u: Updates = { [roomPath(ctx.code, `pub/finalReveal/${i}`)]: reveal };
  applyScores(room, ctx, reveal.deltas, stats, u);
  return withState(ctx, room, { phase: 'f-reveal', q: i, step: 0 }, u);
}

export function computeAwards(room: Room): Award[] {
  const stats = room.pub?.stats ?? {};
  const pids = activePids(room);
  const best = (id: Award['id'], value: (s: Stats) => number): Award | null => {
    let top = 0;
    let winners: Pid[] = [];
    for (const pid of pids) {
      const v = value(stats[pid] ?? EMPTY_STATS);
      if (v > top) [top, winners] = [v, [pid]];
      else if (v === top && v > 0) winners.push(pid);
    }
    return top > 0 ? { id, pids: winners, value: top } : null;
  };
  return [
    best('liar', (s) => s.fooled),
    best('detector', (s) => s.found),
    best('favorite', (s) => s.likes),
    best('mystery', (s) => (s.asked >= 2 ? Math.round((100 * s.missed) / s.asked) : 0)),
  ].filter((a): a is Award => a !== null);
}

export function endGame(room: Room, ctx: Ctx): Updates {
  const scored: Room = room;
  const expiresAt = ctx.now + GAME.keepAfterGameHours * 3600 * 1000;
  const u: Updates = {
    [roomPath(ctx.code, 'pub/awards')]: computeAwards(scored),
    [roomPath(ctx.code, 'meta/expiresAt')]: expiresAt,
    [`roomIndex/${ctx.code}`]: expiresAt,
  };
  return withState(ctx, room, { phase: 'end', q: 0 }, u);
}

/** The host pressed "Next" / "Skip" (or the timer ran out). */
export function advance(room: Room, ctx: Ctx): Updates | null {
  const { phase, q, step } = room.state;
  switch (phase) {
    case 'lobby':
      return openTruths(room, ctx);
    case 'truths':
      return startRounds(room, ctx);
    case 'intro':
      return room.state.step === 3 ? startFinal(room, ctx) : startQuestion(room, ctx, q);
    case 'r-lie':
      return startPick(room, ctx);
    case 'r-pick':
      return startReveal(room, ctx);
    case 'r-reveal':
      if (step + 1 < revealStepCount(room.pub?.reveal?.[q])) return withState(ctx, room, { phase, q, step: step + 1 });
      return afterQuestion(room, ctx);
    case 'r-end': {
      const next = room.pub?.questions?.[q + 1];
      return next ? startIntro(room, ctx, 2, q + 1) : startIntro(room, ctx, 3, 0);
    }
    case 'f-write':
      return startFinalPicks(room, ctx);
    case 'f-pick':
      return startFinalReveal(room, ctx);
    case 'f-reveal':
      if (step < 1) return withState(ctx, room, { phase, q, step: step + 1 });
      return q + 1 < (room.pub?.final?.length ?? 0)
        ? withState(ctx, room, { phase: 'f-pick', q: q + 1, deadline: deadlineIn(ctx, TIMERS.finalPick) })
        : endGame(room, ctx);
    case 'end':
      return null;
  }
}

/** Called by the host's phone every ~500ms. Returns updates when something should happen. */
export function tick(room: Room, ctx: Ctx): Updates | null {
  const { phase, deadline } = room.state;
  // Pre-call mode: the truth phase opens right away so people can answer days ahead.
  if (phase === 'lobby') return room.meta.mode === 'precall' ? openTruths(room, ctx) : null;
  if (phase === 'truths') {
    const timeUp = deadline > 0 && ctx.now >= deadline;
    if (room.meta.mode === 'live' && (everyoneDone(room, ctx.now) || timeUp)) return advance(room, ctx);
    // Late joiner? Deal them prompts.
    const dealt = dealMissingPrompts(room, ctx);
    return Object.keys(dealt).length ? dealt : null;
  }
  const timed = phase === 'intro' || phase === 'r-lie' || phase === 'r-pick' || phase === 'f-write' || phase === 'f-pick';
  if (!timed) return null;
  if (everyoneDone(room, ctx.now) || (deadline > 0 && ctx.now >= deadline)) return advance(room, ctx);
  return null;
}

export function extend(room: Room, ctx: Ctx): Updates | null {
  if (!room.state.deadline) return null;
  const base = Math.max(room.state.deadline, ctx.now);
  return withState(ctx, room, { ...room.state, deadline: base + TIMERS.extend * 1000 });
}

export function kick(ctx: Ctx, pid: Pid): Updates {
  return { [roomPath(ctx.code, `players/${pid}/kicked`)]: true };
}

// ---------- Host failover ----------

/** The player who created the room (gets hosting back whenever they're around). */
export function ownerPid(room: Room): Pid {
  return room.meta.ownerPid ?? room.meta.hostPid;
}

/** Failover works from the lobby until the podium (but not days ahead in pre-call mode). */
export function failoverAllowed(room: Room): boolean {
  const { phase } = room.state;
  if (phase === 'end') return false;
  if (phase === 'truths' && room.meta.mode === 'precall') return false;
  return true;
}

/**
 * When the host's phone has been away for a while mid-game, the first connected player
 * (in join order) takes over. Returns that player's seat, or undefined if no takeover is needed.
 */
export function backupHost(room: Room, now: number): Pid | undefined {
  if (!failoverAllowed(room)) return undefined;
  const hostPresence = room.presence?.[room.meta.hostPid];
  if (typeof hostPresence !== 'number' || now - hostPresence < GAME.hostFailoverSeconds * 1000) return undefined;
  return activePids(room).find((pid) => pid !== room.meta.hostPid && room.presence?.[pid] === true);
}

/** Take over hosting (stand-in) or take it back (owner). The security rules check who may do this. */
export function becomeHost(code: string, pid: Pid, uid: string): Updates {
  return { [roomPath(code, 'meta/hostUid')]: uid, [roomPath(code, 'meta/hostPid')]: pid };
}

// ---------- Rematch ----------

/** A fresh room with the same players and settings (live mode). The host writes it in one go. */
export function rematchRoom(room: Room, now: number, hostUid: string): Room {
  const expiresAt = now + GAME.keepUnfinishedDays * 24 * 3600 * 1000;
  const players: Record<Pid, Player> = {};
  activePids(room).forEach((pid, i) => {
    const p = room.players![pid];
    players[pid] = { uid: p.uid, name: p.name, avatar: p.avatar, joinedAt: now + i };
  });
  return {
    meta: { ...room.meta, hostUid, ownerPid: room.meta.hostPid, createdAt: now, expiresAt, mode: 'live' },
    state: { v: 0, phase: 'lobby', q: 0, deadline: 0, step: 0 },
    players,
  };
}

/**
 * Scores as they were before the round that just ended (for the scoreboard animation):
 * on a round's scoreboard, minus that round's points; on the podium, minus the final round's.
 */
export function scoresBefore(room: Room): Record<Pid, number> {
  const before: Record<Pid, number> = { ...(room.pub?.scores ?? {}) };
  const subtract = (deltas: Record<Pid, number> | undefined) => {
    for (const [pid, d] of Object.entries(deltas ?? {})) before[pid] = (before[pid] ?? 0) - d;
  };
  const questions = room.pub?.questions ?? [];
  const reveals = room.pub?.reveal ?? {};
  const roundPoints = (round: number) => questions.forEach((x, i) => x.round === round && subtract(reveals[i]?.deltas));
  if (room.state.phase === 'r-end') roundPoints(questions[room.state.q]?.round ?? 1);
  if (room.state.phase === 'end') {
    const finals = Object.values(room.pub?.finalReveal ?? {});
    if (finals.length) finals.forEach((f) => subtract(f.deltas));
    else if (questions.length) roundPoints(questions[questions.length - 1].round);
  }
  return before;
}

/** Standings, best first (ties share a rank). Uses the current scores unless others are given. */
export function standings(room: Room, scores = room.pub?.scores ?? {}): { pid: Pid; score: number; rank: number }[] {
  const rows = activePids(room)
    .map((pid) => ({ pid, score: scores[pid] ?? 0, rank: 0 }))
    .sort((a, b) => b.score - a.score);
  rows.forEach((r, i) => (r.rank = i > 0 && rows[i - 1].score === r.score ? rows[i - 1].rank : i + 1));
  return rows;
}

/** Score to show in the header: hides this question's points until the reveal is over (no spoilers). */
export function displayedScore(room: Room, pid: Pid): number {
  const score = room.pub?.scores?.[pid] ?? 0;
  const { phase, q, step } = room.state;
  if (phase === 'r-reveal') {
    const reveal = room.pub?.reveal?.[q];
    if (reveal && step < (reveal.steps?.length ?? 0)) return score - (reveal.deltas?.[pid] ?? 0);
  }
  if (phase === 'f-reveal' && step < 1) return score - (room.pub?.finalReveal?.[q]?.deltas?.[pid] ?? 0);
  return score;
}
