import { useEffect, useRef, useState } from 'preact/hooks';
import { onValue, ref } from 'firebase/database';
import { t } from '../i18n';
import { activePids, displayedScore, isAway, ownerPid } from '../logic/engine';
import { hostLink, joinLink, go, screenLink } from '../router';
import { session } from '../data/session';
import { deleteRoom } from '../data/room';
import { cycleTheme } from '../theme';
import { Avatar, Sheet, buzz, copyText, useTicker } from '../ui/components';
import { useGame } from '../ui/game';
import { Lobby } from './phases/Lobby';
import { Truths } from './phases/Truths';
import { Lie } from './phases/Lie';
import { Pick } from './phases/Pick';
import { Reveal } from './phases/Reveal';
import { RoundEnd } from './phases/RoundEnd';
import { FinalWrite, FinalPick, FinalReveal } from './phases/Final';
import { End } from './phases/End';
import { RoundIntro } from './phases/RoundIntro';
import { startBots, botsAllowed } from '../bots/bots';

export function GameView({ error }: { error: string }) {
  const { room, pid, isHost, code, now } = useGame();
  const phase = room.state.phase;
  useTicker(5000);

  // Tiny buzz when the phase changes, so people notice on a busy call.
  const last = useRef(`${phase}:${room.state.q}`);
  useEffect(() => {
    const key = `${phase}:${room.state.q}`;
    if (key !== last.current) {
      last.current = key;
      buzz(40);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [phase, room.state.q]);

  const me = room.players?.[pid];
  const score = displayedScore(room, pid);
  const hostAway = !isHost && isAway(room, room.meta.hostPid, now());
  const connected = useConnected();

  return (
    <>
      <header class="header">
        <div class="header-inner">
          <span class="chip accent">{code}</span>
          <span class="spacer" />
          <span class="chip">{t.common.points(score)}</span>
          <Avatar player={me} size="sm" />
          <button class="icon-btn" onClick={() => cycleTheme()} aria-label={t.host.theme}>
            🌓
          </button>
        </div>
      </header>
      {!connected && <div class="banner">{t.common.offline}</div>}
      {connected && hostAway && phase !== 'end' && <div class="banner">{t.host.hostLost}</div>}
      {connected && isHost && pid !== ownerPid(room) && phase !== 'end' && (
        <div class="banner">{t.host.standingIn(room.players?.[ownerPid(room)]?.name ?? '')}</div>
      )}
      {error && <div class="banner">{error}</div>}
      <main class="page">
        <PhaseView />
      </main>
      {isHost && phase !== 'end' && <HostBar />}
    </>
  );
}

/** False while this phone has lost its connection to Firebase (it reconnects by itself). */
function useConnected(): boolean {
  const { fb } = useGame();
  const [connected, setConnected] = useState(true);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsub = onValue(ref(fb.db, '.info/connected'), (s) => {
      clearTimeout(timer);
      // Brief blips aren't worth a banner.
      if (s.val() === true) setConnected(true);
      else timer = setTimeout(() => setConnected(false), 2000);
    });
    return () => {
      clearTimeout(timer);
      unsub();
    };
  }, [fb]);
  return connected;
}

function PhaseView() {
  const { room } = useGame();
  switch (room.state.phase) {
    case 'lobby':
      return <Lobby />;
    case 'truths':
      return <Truths />;
    case 'intro':
      return <RoundIntro />;
    case 'r-lie':
      return <Lie />;
    case 'r-pick':
      return <Pick />;
    case 'r-reveal':
      return <Reveal />;
    case 'r-end':
      return <RoundEnd />;
    case 'f-write':
      return <FinalWrite />;
    case 'f-pick':
      return <FinalPick />;
    case 'f-reveal':
      return <FinalReveal />;
    case 'end':
      return <End />;
  }
}

function HostBar() {
  const { room, host } = useGame();
  const [menu, setMenu] = useState(false);
  const { phase, deadline } = room.state;
  const players = activePids(room).length;

  let label = t.host.next;
  let disabled = false;
  if (phase === 'lobby') {
    label = t.host.start;
    disabled = players < 3;
  } else if (phase === 'truths') {
    label = room.meta.mode === 'precall' ? t.host.start : t.host.skip;
  } else if (phase === 'r-lie' || phase === 'f-write') label = t.host.skip;
  else if (phase === 'r-pick' || phase === 'f-pick') label = t.host.reveal;

  // Avoid accidental double taps skipping two steps.
  const [cool, setCool] = useState(false);
  const press = () => {
    if (cool) return;
    setCool(true);
    setTimeout(() => setCool(false), 700);
    host.next();
  };

  return (
    <div class="hostbar">
      <div class="hostbar-inner">
        <button class="icon-btn" onClick={() => setMenu(true)} aria-label={t.host.menu}>
          ☰
        </button>
        {deadline > 0 && phase !== 'intro' && (
          <button class="btn secondary small" onClick={host.extend}>
            {t.host.extend}
          </button>
        )}
        <button class="btn grow" disabled={disabled || cool} onClick={press} data-testid="host-next">
          {label}
        </button>
      </div>
      {menu && <HostMenu onClose={() => setMenu(false)} />}
    </div>
  );
}

function HostMenu({ onClose }: { onClose: () => void }) {
  const { room, code, host, pid: me, fb, now } = useGame();
  const [copied, setCopied] = useState('');
  const key = session.seat(code)?.hostKey;
  const link = key ? hostLink(code, key) : '';

  return (
    <Sheet onClose={onClose}>
      <div class="row">
        <h2 class="grow">{t.host.menu}</h2>
        <button class="icon-btn" onClick={onClose} aria-label={t.common.close}>
          ✕
        </button>
      </div>

      <div class="col">
        <h3>{t.host.players}</h3>
        {activePids(room).map((pid) => {
          const p = room.players![pid];
          return (
            <div class="list-row" key={pid}>
              <Avatar player={p} away={isAway(room, pid, now())} />
              <span class="grow">
                {p.name}
                {pid === me ? ` (${t.common.you})` : ''}
              </span>
              <span class="muted small">{t.common.points(room.pub?.scores?.[pid] ?? 0)}</span>
              {pid !== me && (
                <button class="btn secondary small" onClick={() => confirm(t.host.kickConfirm(p.name)) && host.kick(pid)}>
                  {t.host.kick}
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div class="col">
        <button
          class="btn secondary"
          onClick={async () => setCopied((await copyText(joinLink(code))) === 'copied' ? 'join' : '')}
        >
          🔗 {copied === 'join' ? t.common.copied : t.lobby.copyLink}
        </button>
      </div>

      <div class="col">
        <h3>{t.screen.link}</h3>
        <p class="small muted">{t.screen.linkHint}</p>
        <div class="row">
          <button class="btn secondary" style={{ flex: 1 }} onClick={async () => setCopied((await copyText(screenLink(code))) === 'copied' ? 'screen' : '')}>
            {copied === 'screen' ? t.common.copied : t.common.copy}
          </button>
          <a class="btn secondary" style={{ flex: 1, textDecoration: 'none' }} href={screenLink(code)} target="_blank" rel="noopener">
            {t.screen.open}
          </a>
        </div>
      </div>

      {link && (
        <div class="col">
          <h3>{t.host.recoveryLink}</h3>
          <p class="small muted">{t.host.recoveryHint}</p>
          <button class="btn secondary" onClick={async () => setCopied((await copyText(link)) === 'copied' ? 'host' : '')}>
            🔑 {copied === 'host' ? t.common.copied : t.common.copy}
          </button>
        </div>
      )}

      {botsAllowed() && room.state.phase === 'lobby' && (
        <button
          class="btn secondary"
          onClick={() => {
            void startBots(code, 5);
            onClose();
          }}
        >
          🤖 {t.lobby.addBots}
        </button>
      )}

      <button
        class="btn danger"
        onClick={() => {
          if (!confirm(t.host.endConfirm)) return;
          host.end();
          onClose();
        }}
      >
        🏁 {t.host.endGame}
      </button>
      <button
        class="btn ghost"
        onClick={async () => {
          if (!confirm(t.end.deleteConfirm)) return;
          await deleteRoom(fb, code);
          session.forget(code);
          go('/');
        }}
      >
        {t.end.deleteNow}
      </button>
    </Sheet>
  );
}
