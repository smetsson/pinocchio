/**
 * 📺 Big-screen view (#/screen/CODE): a read-only display for screen-sharing on the call.
 * It never joins the game; it just shows what's happening in large type.
 */
import { useCallback, useEffect, useMemo, useState } from 'preact/hooks';
import type { Fb } from '../data/firebase';
import { getPack } from '../data/packs';
import { subscribeRoom, watchServerOffset } from '../data/room';
import { t } from '../i18n';
import { activePids, currentSubject, isAway } from '../logic/engine';
import type { Room } from '../logic/types';
import { joinLink } from '../router';
import { Avatar, QR, Timer, WaitingFor } from '../ui/components';
import { Game, useGame, type GameContext } from '../ui/game';
import { Loading, Logo } from '../app';
import { useWakeLock } from './RoomScreen';
import { QuestionHeader } from './phases/QuestionHeader';
import { Pick } from './phases/Pick';
import { Reveal } from './phases/Reveal';
import { RoundEnd } from './phases/RoundEnd';
import { FinalPick, FinalReveal } from './phases/Final';
import { End } from './phases/End';

export function BigScreen({ fb, code }: { fb: Fb; code: string }) {
  const [room, setRoom] = useState<Room | null | undefined>(undefined);
  const [offset, setOffset] = useState(0);
  useEffect(() => watchServerOffset(fb, setOffset), [fb]);
  useEffect(
    () =>
      subscribeRoom(fb, code, undefined, false, setRoom, (_e, path) => {
        if (path === 'meta') setRoom(null);
      }),
    [fb, code],
  );
  useEffect(() => {
    document.documentElement.classList.add('bigscreen');
    return () => document.documentElement.classList.remove('bigscreen');
  }, []);
  useWakeLock(!!room && room.state.phase !== 'end');

  const now = useCallback(() => Date.now() + offset, [offset]);
  const noop = useMemo(() => ({ next() {}, extend() {}, kick() {}, end() {} }), []);

  if (room === undefined) return <Loading />;
  if (room === null) {
    return (
      <div class="page">
        <Logo />
        <p class="card center">{t.screen.notFound}</p>
      </div>
    );
  }

  const ctx: GameContext = {
    fb,
    code,
    room,
    pid: '',
    isHost: false,
    spectator: true,
    pack: getPack(room.meta.pack),
    now,
    act: async () => false,
    host: noop,
  };
  return (
    <Game.Provider value={ctx}>
      <header class="header">
        <div class="header-inner">
          <Logo small />
          <span class="spacer" />
          <span class="muted small">{joinLink(code).replace(/^https?:\/\//, '')}</span>
          <span class="chip accent">{code}</span>
        </div>
      </header>
      <main class="page">
        <ScreenPhase />
      </main>
    </Game.Provider>
  );
}

function ScreenPhase() {
  const { room } = useGame();
  switch (room.state.phase) {
    case 'lobby':
      return <ScreenLobby />;
    case 'truths':
      return (
        <>
          <h1 class="center">{t.truths.title}</h1>
          {room.meta.mode === 'live' && <Timer />}
          <p class="center muted">{t.screen.answering}</p>
          <WaitingFor />
          {room.meta.mode === 'precall' && <ScreenLobby compact />}
        </>
      );
    case 'r-lie':
      return <ScreenLie />;
    case 'r-pick':
      return <Pick />;
    case 'r-reveal':
      return <Reveal />;
    case 'r-end':
      return <RoundEnd />;
    case 'f-write':
      return (
        <>
          <h1 class="center">🎭 {t.round.title(3)}</h1>
          <Timer />
          <p class="center muted">{t.screen.finalWriting}</p>
          <WaitingFor />
        </>
      );
    case 'f-pick':
      return <FinalPick />;
    case 'f-reveal':
      return <FinalReveal />;
    case 'end':
      return <End />;
  }
}

function ScreenLobby({ compact }: { compact?: boolean }) {
  const { room, code, now } = useGame();
  const pids = activePids(room);
  return (
    <div class="screen-lobby">
      <div class="card col center">
        <b>{t.screen.joinAt}</b>
        <div class="room-code">{code}</div>
        <span class="small muted">{joinLink(code).replace(/^https?:\/\//, '')}</span>
        <span class="small muted">{t.screen.orScan}</span>
        <QR text={joinLink(code)} />
      </div>
      {!compact && (
        <div class="col">
          <h2>{t.lobby.players(pids.length)}</h2>
          <div class="players">
            {pids.map((pid) => (
              <div class="player" key={pid}>
                <Avatar player={room.players![pid]} away={isAway(room, pid, now())} badge={pid === room.meta.hostPid ? '👑' : undefined} />
                <span class="name">{room.players![pid].name}</span>
              </div>
            ))}
          </div>
          <p class="muted">{t.lobby.waitingHost}</p>
        </div>
      )}
    </div>
  );
}

function ScreenLie() {
  const { room } = useGame();
  const subject = room.players?.[currentSubject(room) ?? ''];
  return (
    <>
      <QuestionHeader />
      <div class="card center col pop-in">
        <div class="big-emoji">✍️</div>
        <h2>{t.screen.lying}</h2>
        {subject && <p class="muted">{t.screen.subjectHint(subject.name)}</p>}
      </div>
      <WaitingFor />
    </>
  );
}
