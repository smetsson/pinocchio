import type { GameLength } from '../config/game';

/** Player seat id (random, stable per room). Not the Firebase auth uid. */
export type Pid = string;

export type Phase =
  | 'lobby' // live mode: waiting for players
  | 'truths' // players answer personal prompts
  | 'r-lie' // round 1/2: write a lie about the subject
  | 'r-pick' // round 1/2: pick the truth, like a lie
  | 'r-reveal' // round 1/2: step through the options
  | 'r-end' // scoreboard between rounds
  | 'f-write' // final: write one truth + one lie about yourself
  | 'f-pick' // final: guess which one is true (per subject)
  | 'f-reveal' // final: reveal (per subject)
  | 'end'; // podium + awards

export interface Meta {
  /** Auth user of whoever is hosting right now (the creator, or a stand-in while they're away). */
  hostUid: string;
  /** Seat that is hosting right now. */
  hostPid: Pid;
  /** Seat of the player who created the room; they always get hosting back when they return. */
  ownerPid?: Pid;
  createdAt: number;
  expiresAt: number;
  pack: string;
  length: GameLength;
  mode: 'live' | 'precall';
  /** Which group of people is playing (e.g. "work-team"). Question history is kept per group. */
  group: string;
}

export interface Player {
  uid: string;
  name: string;
  avatar: string;
  joinedAt: number;
  kicked?: boolean;
}

export interface GameState {
  /** Version counter; the rules only accept v+1 (protects against double-advancing). */
  v: number;
  phase: Phase;
  /** Question index (rounds) or subject index (final). */
  q: number;
  /** Server time (ms) when the phase ends, or 0 when host-paced. */
  deadline: number;
  /** Reveal step. */
  step: number;
}

export interface Question {
  round: 1 | 2;
  subject: Pid;
  promptId: string;
  truthHash: string;
}

export interface Option {
  id: string;
  text: string;
}

export type OptionKind = 'truth' | 'lie' | 'house';

export interface RevealStep {
  optId: string;
  text: string;
  kind: OptionKind;
  author?: Pid;
  pickers: Pid[];
  likes: number;
}

export interface Reveal {
  steps: RevealStep[];
  /** Lies nobody picked (shown together with the truth). */
  unpicked: RevealStep[];
  /** Points earned this question. */
  deltas: Record<Pid, number>;
}

export interface FinalQuestion {
  subject: Pid;
  options: [string, string];
}

export interface FinalReveal {
  truthIndex: 0 | 1;
  right: Pid[];
  fooled: Pid[];
  deltas: Record<Pid, number>;
}

export interface Stats {
  fooled: number; // players fooled by my lies
  found: number; // truths I found
  likes: number; // likes received
  asked: number; // times someone guessed about me
  missed: number; // times someone missed my truth
}

export interface Award {
  id: 'liar' | 'detector' | 'favorite' | 'mystery';
  pids: Pid[];
  value: number;
}

export interface PlayerPrivate {
  truths?: Record<string, string>;
  lies?: Record<string, { text: string; hash: string }>;
  votes?: Record<string, string>;
  likes?: Record<string, string>;
  final?: { truth: string; lie: string };
  fvotes?: Record<string, 0 | 1>;
}

export interface Secret {
  /** optionId -> pid | 'TRUTH' | 'HOUSE', per question */
  owners?: Record<string, Record<string, string>>;
  /** Final round: index of the true statement per subject index. */
  finalTruth?: Record<string, 0 | 1>;
}

export interface Pub {
  /** Prompt ids offered to each player: first N to answer, the rest are spares. */
  prompts?: Record<Pid, string[]>;
  questions?: Question[];
  options?: Record<string, Option[]>;
  reveal?: Record<string, Reveal>;
  scores?: Record<Pid, number>;
  stats?: Record<Pid, Stats>;
  final?: FinalQuestion[];
  finalReveal?: Record<string, FinalReveal>;
  awards?: Award[];
  /** Room code of the rematch; everyone's phone follows it. */
  next?: string;
}

/** Everything under /rooms/{code}. The host can read all of it; players only parts. */
export interface Room {
  meta: Meta;
  players?: Record<Pid, Player>;
  /** true = online, number = went offline at (server ms). */
  presence?: Record<Pid, true | number>;
  state: GameState;
  pub?: Pub;
  /** Public "done" flags, e.g. status[pid]['lie-3'] = true */
  status?: Record<Pid, Record<string, true>>;
  priv?: Record<Pid, PlayerPrivate>;
  /** Host -> player private info: which option is mine, per question. */
  toPlayer?: Record<Pid, { mine?: Record<string, string> }>;
  secret?: Secret;
  lieHashes?: Record<string, Record<string, Pid>>;
}

export interface Prompt {
  id: string;
  /** First person, used in the truth phase: "The weirdest job I ever had was ____" */
  me: string;
  /** Third person with {name}: "The weirdest job {name} ever had was ____" */
  them: string;
  /** Plausible answers for "Lie for me" (and house lies). */
  lies: string[];
}

export interface PromptPack {
  id: string;
  name: string;
  emoji?: string;
  description?: string;
  prompts: Prompt[];
}

/** A flat map of absolute DB paths to values (a Firebase multi-path update). */
export type Updates = Record<string, unknown>;
