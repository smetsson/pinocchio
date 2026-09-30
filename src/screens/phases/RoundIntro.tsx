import { t } from '../../i18n';
import { SCORING } from '../../config/scoring';
import { currentRound } from '../../logic/engine';
import { Timer } from '../../ui/components';
import { useGame } from '../../ui/game';

/** "Round 2 · Double points!": a few seconds so everyone on the call knows where we are. */
export function RoundIntro() {
  const { room } = useGame();
  const round = currentRound(room);
  const info = t.round.intro[round];
  const points = t.round.points(SCORING.multiplier[round] ?? 1);
  return (
    <div class="round-intro" key={round}>
      <div class="round-intro-icon">{info.icon}</div>
      <h1 class="round-intro-title">{t.round.title(round)}</h1>
      {points && <div class="round-intro-points">{points}</div>}
      <p class="round-intro-sub">{info.subtitle}</p>
      <div class="round-intro-timer">
        <Timer bare />
      </div>
    </div>
  );
}
