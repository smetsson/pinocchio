/**
 * 🤖 Bot players, for testing a full game alone.
 * Each bot is a separate anonymous Firebase user running in this browser tab, so
 * the security rules treat them exactly like real players.
 *
 * Use: open the host menu in the lobby → "Add 5 bots", or add ?bots=5 to the URL.
 * Add &autoplay to let a bot play your own seat too (and move the reveals along),
 * and &fast for 5× shorter timers: #/r/ABCD?bots=5&autoplay&fast
 * Available in local development, or on the live site when the URL contains ?bots/autoplay.
 */
import { getPack } from '../data/packs';
import { closeFb, makeBotFb, type Fb } from '../data/firebase';
import { joinRoom, subscribeRoom, trackPresence, write } from '../data/room';
import { checkLie, finalUpdates, finalVoteUpdates, likeUpdates, lieUpdates, truthUpdates, voteUpdates } from '../logic/actions';
import { currentSubject, hasSubmitted } from '../logic/engine';
import { GAME } from '../config/game';
import type { Room } from '../logic/types';
import { shuffle } from '../logic/random';

const NAMES = ['Robo Rita', 'Beep Bart', 'Chip Chloé', 'Gizmo Gert', 'Pixel Pia', 'Byte Bram', 'Nano Nina', 'Servo Sam'];
const AVATARS = ['🤖', '👾', '🦾', '🛸', '🧠', '⚙️', '🔋', '📡'];

export function botsAllowed(): boolean {
  return import.meta.env.DEV || /[?&](bots|autoplay)/.test(location.href);
}

let running: (() => void)[] = [];
let counter = 0;

export async function startBots(code: string, count: number, speed = 1): Promise<void> {
  for (let i = 0; i < count; i++) {
    const n = counter++;
    try {
      const fb = await makeBotFb(`bot-${n}-${Date.now()}`);
      const r = await joinRoom(fb, code, NAMES[n % NAMES.length], AVATARS[n % AVATARS.length]);
      if (!r.ok) {
        await closeFb(fb);
        continue;
      }
      running.push(runBot(fb, code, r.pid, speed));
    } catch (e) {
      console.warn('bot failed to start', e);
    }
  }
}

export function stopBots() {
  running.forEach((stop) => stop());
  running = [];
}

function pick<T>(items: T[]): T | undefined {
  return items[Math.floor(Math.random() * items.length)];
}

/** Let bot logic play a seat. `ownFb` = the phone's own connection (don't close it when stopping). */
export function runBot(fb: Fb, code: string, pid: string, speed: number, ownFb = false): () => void {
  const pack = () => getPack(room?.meta.pack ?? 'general');
  let room: Room | null = null;
  let pending = '';
  const delay = () => (800 + Math.random() * 4000) / speed;

  const later = (key: string, fn: () => Promise<void> | void) => {
    if (pending === key) return;
    pending = key;
    setTimeout(async () => {
      try {
        await fn();
      } catch (e) {
        console.debug('bot action failed', e);
      }
      if (pending === key) pending = '';
    }, delay());
  };

  const act = (r: Room) => {
    const { phase, q } = r.state;
    const key = `${phase}:${q}`;
    if (r.players?.[pid]?.kicked) return;
    if (hasSubmitted(r, pid)) return;
    const subject = currentSubject(r);

    if (phase === 'truths') {
      later(key, async () => {
        const dealt = (room?.pub?.prompts?.[pid] ?? []).slice(0, GAME.truthsPerPlayer);
        for (const id of dealt) {
          const prompt = pack().prompts.find((p) => p.id === id);
          await write(fb, truthUpdates(room!, code, pid, id, pick(prompt?.lies ?? []) ?? 'Something true', prompt?.me));
        }
      });
    } else if (phase === 'r-lie' && subject !== pid) {
      later(key, async () => {
        const question = room!.pub!.questions![q];
        const prompt = pack().prompts.find((p) => p.id === question.promptId);
        const invented = `${pick(['a', 'the'])} ${pick(['secret', 'tiny', 'famous', 'purple', 'haunted'])} ${pick(['llama', 'banana', 'wizard', 'spaceship', 'tuba'])}`;
        // Half the time use a pack suggestion (like "Lie for me"), otherwise invent one.
        const options = Math.random() < 0.5 ? [...shuffle(prompt?.lies ?? []), invented] : [invented, ...(prompt?.lies ?? [])];
        const lie = options.find((l) => checkLie(room!, code, q, l, prompt?.them) === 'ok');
        if (lie) await write(fb, lieUpdates(code, pid, q, lie, prompt?.them));
      });
    } else if (phase === 'r-pick' && subject !== pid) {
      later(key, async () => {
        const mine = room!.toPlayer?.[pid]?.mine?.[q];
        const options = (room!.pub?.options?.[q] ?? []).filter((o) => o.id !== mine);
        const vote = pick(options);
        if (!vote) return;
        if (Math.random() < 0.5) {
          const like = pick(options.filter((o) => o.id !== vote.id));
          if (like) await write(fb, likeUpdates(code, pid, q, like.id));
        }
        await write(fb, voteUpdates(code, pid, q, vote.id));
      });
    } else if (phase === 'f-write') {
      later(key, () =>
        write(fb, finalUpdates(code, pid, pick(['I have a twin', 'I was on TV once', 'I can juggle'])!, pick(['I met the King', 'I speak 6 languages', 'I have 3 cats'])!)),
      );
    } else if (phase === 'f-pick' && room!.pub?.final?.[q]?.subject !== pid) {
      later(key, () => write(fb, finalVoteUpdates(code, pid, q, Math.random() < 0.5 ? 0 : 1)));
    }
  };

  // "Play again": follow the players to the next room.
  let followed: (() => void) | null = null;
  let unsubRoom: (() => void) | undefined;
  unsubRoom = subscribeRoom(fb, code, pid, false, (r) => {
    room = r;
    if (r?.pub?.next && !followed) {
      stopHere();
      followed = runBot(fb, r.pub.next, pid, speed, ownFb);
      return;
    }
    if (r && !followed) act(r);
  });
  const unsubPresence = ownFb ? () => {} : trackPresence(fb, code, pid);
  // Re-check periodically (e.g. prompts dealt after joining).
  const interval = setInterval(() => room && act(room), 3000);

  function stopHere() {
    clearInterval(interval);
    unsubRoom?.();
    unsubPresence();
  }
  return () => {
    stopHere();
    if (followed) followed(); // closes the connection itself
    else if (!ownFb) void closeFb(fb);
  };
}
