import { useState } from 'preact/hooks';
import { t } from '../../i18n';
import { GAME } from '../../config/game';
import { activePids, isAway } from '../../logic/engine';
import { joinLink } from '../../router';
import { Avatar, QR, shareOrCopy } from '../../ui/components';
import { useGame } from '../../ui/game';

export function Lobby() {
  const { room, code, pid: me, isHost, now } = useGame();
  const pids = activePids(room);
  const link = joinLink(code);
  const [shared, setShared] = useState(false);

  return (
    <>
      <div class="card col center">
        <span class="muted small">{t.lobby.code}</span>
        <div class="room-code" data-testid="room-code">
          {code}
        </div>
        {isHost && <QR text={link} />}
        <button
          class="btn secondary"
          onClick={async () => {
            const r = await shareOrCopy(link, t.appName, t.lobby.shareText);
            if (r === 'copied') {
              setShared(true);
              setTimeout(() => setShared(false), 2000);
            }
          }}
        >
          📤 {shared ? t.common.copied : t.lobby.shareTitle}
        </button>
      </div>

      <div class="row">
        <h3 class="grow">{t.lobby.players(pids.length)}</h3>
        {pids.length < GAME.minPlayers && <span class="small muted">{t.lobby.needMore(GAME.minPlayers)}</span>}
      </div>
      <div class="players" data-testid="players">
        {pids.map((pid) => {
          const p = room.players![pid];
          return (
            <div class={`player ${pid === me ? 'me' : ''}`} key={pid}>
              <Avatar player={p} away={isAway(room, pid, now())} badge={pid === room.meta.hostPid ? '👑' : undefined} />
              <span class="name">{p.name}</span>
            </div>
          );
        })}
      </div>
      {!isHost && (
        <div class="center col" style={{ marginTop: '12px' }}>
          <div class="big-emoji">⏳</div>
          <p class="muted">{t.lobby.waitingHost}</p>
        </div>
      )}
    </>
  );
}
