/**
 * 🎯 SCORING — tweak the numbers here, then redeploy.
 */
export const SCORING = {
  /** You picked the truth. */
  pickedTruth: 1000,
  /** Per player who picked your lie. */
  perPlayerFooled: 500,
  /** Per 👍 like on your lie. */
  perLike: 100,
  /** Points for the player the question is about, per player who found their truth. 0 = like Fibbage. */
  subjectPerTruthFound: 0,
  /** Multiplier per round. */
  multiplier: {
    1: 1, // Round 1
    2: 2, // Round 2
    3: 2, // Final round: Truth or Lie
  } as Record<number, number>,
};
