import { t } from '../../i18n';
import { SCORING } from '../../config/scoring';
import { currentRound } from '../../logic/engine';
import { useGame } from '../../ui/game';
import { Scoreboard } from './Scoreboard';

export function RoundEnd() {
  const { room } = useGame();
  const round = currentRound(room);
  const hasRound2 = !!room.pub?.questions?.[room.state.q + 1];
  return (
    <>
      <div class="center col">
        <div class="big-emoji">🏆</div>
        <h1>{t.scores.title}</h1>
        <p class="muted">{t.scores.afterRound(round)}</p>
      </div>
      <Scoreboard animate />
      <div class="card center pop-in" style={{ animationDelay: '1s' }}>
        <b>{hasRound2 ? `⚡ ${t.scores.nextRound2}${(SCORING.multiplier[2] ?? 1) > 1 ? `: ${t.round.points(SCORING.multiplier[2]).toLowerCase()}` : ''}` : `🎭 ${t.scores.nextFinal}`}</b>
      </div>
    </>
  );
}
