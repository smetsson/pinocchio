/**
 * ⏱️ GAME SETTINGS — timers (seconds) and game length.
 */
export const TIMERS = {
  /** Live mode: time to answer the personal prompts. */
  truths: 180,
  /** Writing a lie about a colleague. */
  lie: 75,
  /** Picking the truth (+ liking a lie). */
  pick: 35,
  /** Final round: write one truth and one lie about yourself. */
  finalWrite: 90,
  /** Final round: guess which one is true. */
  finalPick: 20,
  /** Seconds added by the host's "+30s" button. */
  extend: 30,
};

export const GAME = {
  minPlayers: 3,
  maxPlayers: 10,
  /** Prompts each player answers in the truth phase. */
  truthsPerPlayer: 2,
  /** Spare prompts per player for the "🔀 another question" button. */
  sparePromptsPerPlayer: 3,
  /** Questions per round (round 1 and round 2), per game length. Capped at the number of players. */
  questionsPerRound: {
    short: 3, // ~20 min with 6 players
    standard: 4, // ~30 min with 6 players
  },
  /** Make sure every pick has at least this many options (house lies fill the gap). */
  minOptions: 3,
  /**
   * If the host's phone is away this long mid-game, another player's phone takes over hosting
   * (the original host gets it back as soon as they return). Keep in sync with scripts/build-rules.mjs.
   */
  hostFailoverSeconds: 15,
  /** A player whose phone has been disconnected for this long is no longer waited for. */
  awayAfterSeconds: 20,
  /** Room data is deleted this long after the game ends. */
  keepAfterGameHours: 24,
  /** Room data is deleted this long after creation if the game never finishes. */
  keepUnfinishedDays: 14,
};

export type GameLength = keyof typeof GAME.questionsPerRound;
