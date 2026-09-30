import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Fb } from '../data/firebase';
import { getPack } from '../data/packs';
import { claimHost, reclaimSeat, registerSeatKey, subscribeRoom, takeHost, trackPresence, watchHistory, watchServerOffset, write } from '../data/room';
import { session } from '../data/session';
import { t } from '../i18n';
import * as engine from '../logic/engine';
import type { PromptHistory } from '../logic/prompts';
import type { Room, Updates } from '../logic/types';
import { go } from '../router';
import { Game, type GameContext } from '../ui/game';
import { Loading, Logo } from '../app';
import { JoinForm } from './JoinForm';
import { GameView } from './GameView';
import { botsAllowed, runBot, startBots } from '../bots/bots';

type Status = 'loading' | 'ready' | 'missing';

export function RoomScreen({ fb, code, params }: { fb: Fb; code: string; params: URLSearchParams }) {
  const [claiming, setClaiming] = useState(!!params.get('host'));
  const [room, setRoom] = useState<Room | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState('');
  const [isHost, setIsHost] = useState(false);
  const [seatPid, setSeatPid] = useState(session.seat(code)?.pid);

  // Host recovery link: #/r/CODE?host=KEY
  useEffect(() => {
    const key = params.get('host');
    if (!key) return;
    claimHost(fb, code, key)
      .then((pid) => {
        session.saveSeat(code, { pid, hostKey: key });
        setSeatPid(pid);
      })
      .catch(() => setError(t.errors.claimFailed))
      .finally(() => {
        setClaiming(false);
        history.replaceState(null, '', `#/r/${code}`);
      });
  }, []);

  useEffect(() => watchServerOffset(fb, setOffset), [fb]);
  const now = useCallback(() => Date.now() + offset, [offset]);

  // Subscribe. Players see public data + their own; the host sees everything.
  useEffect(() => {
    if (claiming) return;
    // Keep showing the game while switching between player and host view (no "Loading…" flash).
    setStatus((s) => (s === 'ready' ? s : 'loading'));
    return subscribeRoom(
      fb,
      code,
      seatPid,
      isHost,
      (r) => {
        if (!r) {
          setStatus('missing');
          setRoom(null);
          return;
        }
        setRoom(r);
        setStatus('ready');
        const hostNow = r.meta.hostUid === fb.uid;
        if (hostNow !== isHost) setIsHost(hostNow);
      },
      (_e, path) => {
        // Lost host rights (the creator took hosting back): continue as a normal player.
        if (path === '' && isHost) return setIsHost(false);
        if (path === '' || path === 'meta') setStatus('missing');
      },
    );
  }, [fb, code, seatPid, isHost, claiming]);

  // Find my seat: the remembered one, or any seat bound to this device's anonymous user.
  const pid = useMemo(() => {
    if (!room?.players) return undefined;
    if (seatPid && room.players[seatPid]?.uid === fb.uid) return seatPid;
    return Object.entries(room.players).find(([, p]) => p.uid === fb.uid && !p.kicked)?.[0];
  }, [room?.players, seatPid, fb.uid]);

  useEffect(() => {
    if (pid && pid !== seatPid) {
      session.saveSeat(code, { pid });
      setSeatPid(pid);
    } else if (pid) session.saveSeat(code, { pid });
  }, [pid]);

  const kicked = !!(pid && room?.players?.[pid]?.kicked);

  // This phone remembers a seat, but its sign-in identity changed (e.g. part of the browser's
  // storage was cleared): take the seat back with the saved key, and host rights for the creator.
  const [recovering, setRecovering] = useState(false);
  const recoveryTried = useRef(false);
  useEffect(() => {
    const saved = session.seat(code);
    const seat = saved && room?.players?.[saved.pid];
    if (!room || !saved || !seat || seat.kicked || seat.uid === fb.uid || recoveryTried.current) return;
    const isOwner = saved.pid === engine.ownerPid(room);
    if (!(isOwner && saved.hostKey) && !saved.seatKey) return;
    recoveryTried.current = true;
    setRecovering(true);
    const recover = isOwner && saved.hostKey ? claimHost(fb, code, saved.hostKey) : reclaimSeat(fb, code, saved.pid, saved.seatKey!);
    recover
      .then(() => setSeatPid(saved.pid))
      .catch((e) => console.warn('could not take seat back', e))
      .finally(() => setRecovering(false));
  }, [room?.players, fb.uid]);

  // Give my seat a secret key once, so this phone can always take it back.
  useEffect(() => {
    if (!pid || kicked || session.seat(code)?.seatKey) return;
    registerSeatKey(fb, code, pid).then(
      (seatKey) => session.saveSeat(code, { pid, seatKey }),
      () => undefined, // a key was already registered from another device
    );
  }, [pid, kicked]);

  useEffect(() => {
    if (!pid || kicked) return;
    return trackPresence(fb, code, pid);
  }, [fb, code, pid, kicked]);

  const pack = getPack(room?.meta.pack ?? 'general');
  const hostHistory = useHostHistory(fb, room?.meta.group ?? 'default', isHost ? pack.id : undefined);

  const act = useCallback(
    async (u: Updates) => {
      try {
        await write(fb, u);
        return true;
      } catch (e) {
        console.warn('write failed', e);
        setError(t.errors.writeFailed);
        setTimeout(() => setError(''), 3500);
        return false;
      }
    },
    [fb],
  );

  const roomRef = useRef(room);
  roomRef.current = room;
  // Test mode (only with bots allowed): ?fast = 5× shorter timers, ?autoplay = a bot plays my seat.
  const fast = botsAllowed() && params.has('fast');
  const autoplay = botsAllowed() && params.has('autoplay');
  const engineCtx = useCallback(
    (): engine.Ctx => ({ code, now: now(), pack, history: hostHistory.current, timeScale: fast ? 0.2 : 1 }),
    [code, now, pack, fast],
  );

  const host = useMemo(
    () => ({
      next: () => {
        const r = roomRef.current;
        const u = r && engine.advance(r, engineCtx());
        if (u) void write(fb, u).catch((e) => console.warn('advance failed', e));
      },
      extend: () => {
        const r = roomRef.current;
        const u = r && engine.extend(r, engineCtx());
        if (u) void act(u);
      },
      kick: (target: string) => void act(engine.kick(engineCtx(), target)),
      end: () => {
        const r = roomRef.current;
        if (r) void act(engine.endGame(r, engineCtx()));
      },
    }),
    [engineCtx, act, fb],
  );

  useHostLoop(isHost && status === 'ready', roomRef, engineCtx, fb);

  // "Play again": follow everyone to the new room.
  const next = room?.pub?.next;
  useEffect(() => {
    if (!next || !pid) return;
    session.saveSeat(next, { pid });
    go(`/r/${next}`);
  }, [next, pid]);
  useHostFailover(status === 'ready' && !!pid && !kicked, fb, code, pid, roomRef, now);

  // Dev: #/r/CODE?bots=5 adds bot players once.
  const botsStarted = useRef(false);
  useEffect(() => {
    const n = Number(params.get('bots'));
    if (!isHost || !n || botsStarted.current || room?.state.phase !== 'lobby' || !botsAllowed()) return;
    botsStarted.current = true;
    void startBots(code, Math.min(n, 9), fast ? 4 : 1);
  }, [isHost, room?.state.phase, params.get('bots')]);

  // Test mode: a bot plays my own seat.
  useEffect(() => {
    if (!autoplay || !pid || kicked) return;
    return runBot(fb, code, pid, fast ? 4 : 1, true);
  }, [autoplay, pid, kicked]);

  // Test mode: the host moves reveals and scoreboards along by itself.
  useEffect(() => {
    const phase = room?.state.phase;
    if (!autoplay || !isHost || !(phase === 'r-reveal' || phase === 'r-end' || phase === 'f-reveal')) return;
    const id = setTimeout(host.next, fast ? 1500 : 3000);
    return () => clearTimeout(id);
  }, [autoplay, isHost, room?.state.v]);
  useWakeLock(status === 'ready' && !!pid && room?.state.phase !== 'end' && !(room?.meta.mode === 'precall' && room?.state.phase === 'truths'));

  if (claiming || recovering || status === 'loading') return <Loading />;
  if (status === 'missing' || !room) {
    return (
      <div class="page">
        <Logo />
        <div class="card center col">
          <div class="big-emoji">🕳️</div>
          <p>{t.join.notFound}</p>
          <button
            class="btn"
            onClick={() => {
              session.forget(code);
              go('/');
            }}
          >
            {t.common.back}
          </button>
        </div>
      </div>
    );
  }
  if (kicked) {
    return (
      <div class="page">
        <Logo />
        <div class="card center col">
          <div class="big-emoji">👋</div>
          <p>{t.join.kicked}</p>
          <button
            class="btn"
            onClick={() => {
              session.forget(code);
              go('/');
            }}
          >
            {t.common.back}
          </button>
        </div>
      </div>
    );
  }
  if (!pid) return <JoinForm fb={fb} code={code} room={room} onJoined={(p) => setSeatPid(p)} />;

  const ctx: GameContext = { fb, code, room, pid, isHost, pack, now, act, host };
  return (
    <Game.Provider value={ctx}>
      <GameView error={error} />
    </Game.Provider>
  );
}

function useHostHistory(fb: Fb, group: string, pack: string | undefined) {
  const ref = useRef<PromptHistory>({});
  useEffect(() => {
    if (!pack) return;
    return watchHistory(fb, group, pack, (h) => (ref.current = h));
  }, [fb, group, pack]);
  return ref;
}

/**
 * If the host's phone is away mid-game, the first connected player stands in as host so the
 * game keeps going. The room's creator takes hosting back as soon as they're here again.
 */
function useHostFailover(enabled: boolean, fb: Fb, code: string, pid: string | undefined, roomRef: { current: Room | null }, now: () => number) {
  useEffect(() => {
    if (!enabled || !pid) return;
    let busy = false;
    const id = setInterval(async () => {
      const room = roomRef.current;
      if (!room || busy || room.meta.hostUid === fb.uid || document.visibilityState !== 'visible') return;
      const reclaim = engine.ownerPid(room) === pid && room.state.phase !== 'end';
      if (!reclaim && engine.backupHost(room, now()) !== pid) return;
      busy = true;
      try {
        await takeHost(fb, code, pid);
      } catch {
        /* someone else was quicker, or the host is back */
      } finally {
        busy = false;
      }
    }, 2000);
    return () => clearInterval(id);
  }, [enabled, fb, code, pid, now]);
}

/** The host's phone drives the game: auto-advance on timeouts / when everyone is done. */
function useHostLoop(enabled: boolean, roomRef: { current: Room | null }, ctx: () => engine.Ctx, fb: Fb) {
  const busy = useRef(false);
  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(async () => {
      const room = roomRef.current;
      if (!room || busy.current) return;
      const u = engine.tick(room, ctx());
      if (!u) return;
      busy.current = true;
      try {
        await write(fb, u);
      } catch (e) {
        console.warn('host tick failed', e);
      } finally {
        // Give the listener a moment to deliver the new state before ticking again.
        setTimeout(() => (busy.current = false), 300);
      }
    }, 500);
    return () => clearInterval(id);
  }, [enabled, ctx, fb]);
}

/** Keep the screen on during the game (phones that lock drop their connection). */
export function useWakeLock(enabled: boolean) {
  useEffect(() => {
    if (!enabled || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        if (document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen');
        if (cancelled) void lock?.release();
      } catch {
        /* not allowed */
      }
    };
    void request();
    const onVis = () => document.visibilityState === 'visible' && request();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVis);
      void lock?.release();
    };
  }, [enabled]);
}
