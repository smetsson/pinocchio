import { t } from '../../i18n';
import { standings } from '../../logic/engine';
import { Avatar } from '../../ui/components';
import { useGame } from '../../ui/game';

export function Scoreboard() {
  const { room, pid: me } = useGame();
  return (
    <div class="points-list" data-testid="scoreboard">
      {standings(room).map((r, i) => (
        <div class={`points-row rank-${r.rank}`} key={r.pid} style={{ animationDelay: `${i * 0.1}s`, borderColor: r.pid === me ? 'var(--accent)' : undefined }}>
          <span class="rank">{r.rank === 1 ? '👑' : r.rank}</span>
          <Avatar player={room.players?.[r.pid]} size="sm" />
          <span>{room.players?.[r.pid]?.name}</span>
          <span class="pts">{t.common.points(r.score)}</span>
        </div>
      ))}
    </div>
  );
}
