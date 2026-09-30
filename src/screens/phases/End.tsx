import { useEffect, useState } from 'preact/hooks';
import { t } from '../../i18n';
import { standings } from '../../logic/engine';
import { deleteRoom, startRematch } from '../../data/room';
import { session } from '../../data/session';
import { go } from '../../router';
import { Avatar, confetti } from '../../ui/components';
import { useGame } from '../../ui/game';
import { Scoreboard } from './Scoreboard';

export function End() {
  const { room, isHost, fb, code, spectator, pid } = useGame();
  const rows = standings(room);
  const [deleted, setDeleted] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const a = setTimeout(() => confetti(2500), 1800);
    const b = setTimeout(() => confetti(2500), 3200);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

  const podium = [rows[1], rows[0], rows[2]];
  const awards = room.pub?.awards ?? [];

  return (
    <>
      <h1 class="center">{t.end.title}</h1>
      <div class="podium" data-testid="podium">
        {podium.map((r, i) =>
          r ? (
            <div class={`step p${[2, 1, 3][i]}`} key={r.pid}>
              <Avatar player={room.players?.[r.pid]} size={i === 1 ? 'lg' : undefined} />
              <span class="name">{room.players?.[r.pid]?.name}</span>
              <span class="small muted">{t.common.points(r.score)}</span>
              <div class="block">{[2, 1, 3][i]}</div>
            </div>
          ) : (
            <div key={i} />
          ),
        )}
      </div>

      {awards.length > 0 && (
        <>
          <h2>{t.end.awards}</h2>
          <div class="awards">
            {awards.map((a, i) => {
              const info = t.end.award[a.id];
              return (
                <div class="award" key={a.id} style={{ animationDelay: `${2.2 + i * 0.25}s` }}>
                  <span class="icon">{info.icon}</span>
                  <span class="title">{info.title}</span>
                  <div class="row" style={{ justifyContent: 'center', flexWrap: 'wrap' }}>
                    {a.pids.map((p) => (
                      <span key={p} class="row" style={{ gap: '4px' }}>
                        <Avatar player={room.players?.[p]} size="sm" />
                        <b class="small">{room.players?.[p]?.name}</b>
                      </span>
                    ))}
                  </div>
                  <span class="small muted">{info.desc(a.value)}</span>
                </div>
              );
            })}
          </div>
        </>
      )}

      <h2>{t.scores.title}</h2>
      <Scoreboard animate />

      {isHost && !deleted && (
        <button
          class="btn"
          disabled={busy}
          data-testid="play-again"
          onClick={async () => {
            setBusy(true);
            try {
              const { code: next, hostKey } = await startRematch(fb, code, room);
              session.saveSeat(next, { pid, hostKey });
              go(`/r/${next}`);
            } catch {
              setBusy(false);
            }
          }}
        >
          🔁 {t.end.playAgain}
        </button>
      )}
      {!isHost && !spectator && <p class="small muted center">{t.end.playAgainHint}</p>}

      <p class="small muted center">{t.end.autoDelete}</p>
      {isHost && !deleted && (
        <button
          class="btn secondary"
          onClick={async () => {
            if (!confirm(t.end.deleteConfirm)) return;
            await deleteRoom(fb, code);
            setDeleted(true);
            session.forget(code);
            go('/');
          }}
        >
          {t.end.deleteNow}
        </button>
      )}
      {!spectator && (
        <button
          class="btn secondary"
          onClick={() => {
            session.forget(code);
            go(isHost ? '/new' : '/');
          }}
        >
          {isHost ? t.end.newGame : t.end.leave}
        </button>
      )}
    </>
  );
}
