import { t } from '../../i18n';
import { scoresBefore, standings } from '../../logic/engine';
import type { Pid } from '../../logic/types';
import { Avatar, useCountUp } from '../../ui/components';
import { useGame } from '../../ui/game';

/**
 * Standings. With `animate`, points count up from the previous round and arrows show
 * who moved up or down.
 */
export function Scoreboard({ animate }: { animate?: boolean }) {
  const { room } = useGame();
  const before = animate ? scoresBefore(room) : room.pub?.scores ?? {};
  // After round 1 everyone started at 0, so movement arrows would mean nothing.
  const showMoves = Object.values(before).some((s) => s !== 0);
  const oldRank = Object.fromEntries(standings(room, before).map((r) => [r.pid, r.rank]));
  return (
    <div class="points-list" data-testid="scoreboard">
      {standings(room).map((r, i) => (
        <ScoreRow key={r.pid} pid={r.pid} rank={r.rank} from={before[r.pid] ?? 0} to={r.score} moved={showMoves ? (oldRank[r.pid] ?? r.rank) - r.rank : 0} index={i} />
      ))}
    </div>
  );
}

function ScoreRow({ pid, rank, from, to, moved, index }: { pid: Pid; rank: number; from: number; to: number; moved: number; index: number }) {
  const { room, pid: me } = useGame();
  const delay = 500 + index * 120;
  const value = useCountUp(from, to, delay);
  return (
    <div class={`points-row rank-${rank}`} style={{ animationDelay: `${index * 0.1}s`, borderColor: pid === me ? 'var(--accent)' : undefined }}>
      <span class="rank">{rank === 1 ? '👑' : rank}</span>
      <Avatar player={room.players?.[pid]} size="sm" />
      <span>{room.players?.[pid]?.name}</span>
      {moved !== 0 && (
        <span class={`rank-move ${moved > 0 ? 'up' : 'down'}`} style={{ animationDelay: `${(delay + 1200) / 1000}s` }}>
          {moved > 0 ? `↑${moved}` : `↓${-moved}`}
        </span>
      )}
      <span class="pts">{t.common.points(value)}</span>
    </div>
  );
}
