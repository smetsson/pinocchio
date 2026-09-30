/**
 * Security rules tests. Run with: npm run test:rules (starts the Firebase emulator).
 */
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';

let env: RulesTestEnvironment;
const C = 'ROOM';
const now = Date.now();

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-pinocchio',
    database: { host: '127.0.0.1', port: 9000, rules: readFileSync('database.rules.json', 'utf8') },
  });
});
afterAll(() => env?.cleanup());
beforeEach(() => env.clearDatabase());

const db = (uid: string | null) => (uid ? env.authenticatedContext(uid).database() : env.unauthenticatedContext().database());

function baseRoom(phase = 'lobby', extra: Record<string, unknown> = {}) {
  return {
    meta: { hostUid: 'host', hostPid: 'p0', createdAt: now, expiresAt: now + 3600_000, pack: 'general', length: 'standard', mode: 'live', group: 'work' },
    state: { v: 0, phase, q: 0, deadline: 0, step: 0 },
    players: {
      p0: { uid: 'host', name: 'Host', avatar: '🦊', joinedAt: now },
      p1: { uid: 'ann', name: 'Ann', avatar: '🐸', joinedAt: now + 1 },
      p2: { uid: 'bob', name: 'Bob', avatar: '🐼', joinedAt: now + 2 },
    },
    ...extra,
  };
}

async function seed(room: Record<string, unknown>, other: Record<string, unknown> = {}) {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.database().ref().update({ [`rooms/${C}`]: room, ...other });
  });
}

describe('rooms', () => {
  it('requires sign-in', async () => {
    await seed(baseRoom());
    await assertFails(db(null).ref(`rooms/${C}/meta`).get());
    await assertSucceeds(db('ann').ref(`rooms/${C}/meta`).get());
  });

  it('lets a signed-in user create a room with a host key, but not overwrite a live one', async () => {
    const room = baseRoom();
    room.meta.hostUid = 'ann';
    await assertSucceeds(
      db('ann').ref().update({ [`rooms/NEWR`]: room, [`hostKeys/NEWR/secret123`]: true, [`roomIndex/NEWR`]: room.meta.expiresAt }),
    );
    const steal = baseRoom();
    steal.meta.hostUid = 'bob';
    await assertFails(db('bob').ref('rooms/NEWR').set(steal));
    await assertFails(db('bob').ref('hostKeys/NEWR/other').set(true));
  });

  it('makes expired rooms unreadable and deletable by anyone', async () => {
    const room = baseRoom();
    room.meta.expiresAt = now - 1000;
    await seed(room, { [`roomIndex/${C}`]: now - 1000, [`hostKeys/${C}/k`]: true });
    await assertFails(db('ann').ref(`rooms/${C}/meta`).get());
    await assertFails(db('host').ref(`rooms/${C}`).get());
    await assertSucceeds(db('bob').ref().update({ [`rooms/${C}`]: null, [`roomIndex/${C}`]: null, [`hostKeys/${C}`]: null }));
  });

  it('lets the host delete the room, but not players', async () => {
    await seed(baseRoom());
    await assertFails(db('ann').ref(`rooms/${C}`).remove());
    await assertSucceeds(db('host').ref(`rooms/${C}`).remove());
  });
});

describe('players', () => {
  it('can join in the lobby with their own uid only', async () => {
    await seed(baseRoom());
    await assertSucceeds(db('cas').ref(`rooms/${C}/players/p3`).set({ uid: 'cas', name: 'Cas', avatar: '🐙', joinedAt: now }));
    await assertFails(db('dee').ref(`rooms/${C}/players/p4`).set({ uid: 'someone', name: 'D', avatar: '🐙', joinedAt: now }));
    await assertFails(db('dee').ref(`rooms/${C}/players/p1`).set({ uid: 'dee', name: 'Ann2', avatar: '🐙', joinedAt: now }));
  });

  it("can't join once the rounds have started", async () => {
    await seed(baseRoom('r-lie'));
    await assertFails(db('cas').ref(`rooms/${C}/players/p3`).set({ uid: 'cas', name: 'Cas', avatar: '🐙', joinedAt: now }));
  });

  it('can rename themselves but not un-kick themselves', async () => {
    await seed(baseRoom());
    await assertSucceeds(db('ann').ref(`rooms/${C}/players/p1/name`).set('Annie'));
    await assertSucceeds(db('host').ref(`rooms/${C}/players/p1/kicked`).set(true));
    await assertFails(db('ann').ref(`rooms/${C}/players/p1/kicked`).remove());
    await assertFails(db('ann').ref(`rooms/${C}/status/p1/truths`).set(true));
  });
});

describe('game state', () => {
  it('only the host can advance, with v+1', async () => {
    await seed(baseRoom());
    const next = { v: 1, phase: 'truths', q: 0, deadline: 0, step: 0 };
    await assertFails(db('ann').ref(`rooms/${C}/state`).set(next));
    await assertFails(db('host').ref(`rooms/${C}/state`).set({ ...next, v: 5 }));
    await assertSucceeds(db('host').ref(`rooms/${C}/state`).set(next));
    await assertFails(db('host').ref(`rooms/${C}/state`).set(next)); // same version again = double advance
  });

  it('only the host can write public game data', async () => {
    await seed(baseRoom());
    await assertFails(db('ann').ref(`rooms/${C}/pub/scores/p1`).set(999999));
    await assertSucceeds(db('host').ref(`rooms/${C}/pub/scores/p1`).set(1000));
  });
});

describe('private answers', () => {
  it('truths are readable by their author and the host only', async () => {
    await seed(baseRoom('truths'));
    await assertSucceeds(db('ann').ref(`rooms/${C}/priv/p1/truths/first-concert`).set('Clouseau'));
    await assertFails(db('bob').ref(`rooms/${C}/priv/p1/truths/first-concert`).set('hacked'));
    await assertFails(db('bob').ref(`rooms/${C}/priv/p1`).get());
    await assertSucceeds(db('ann').ref(`rooms/${C}/priv/p1`).get());
    await assertSucceeds(db('host').ref(`rooms/${C}`).get());
  });

  it("truths can't be written after the truth phase", async () => {
    await seed(baseRoom('r-lie'));
    await assertFails(db('ann').ref(`rooms/${C}/priv/p1/truths/first-concert`).set('late'));
  });
});

describe('lies and votes', () => {
  const question = { round: 1, subject: 'p0', promptId: 'first-concert', truthHash: 'TRUTHHASH' };
  const roundRoom = (phase: string) => baseRoom(phase, { pub: { questions: [question] } });

  it('a lie needs a unique hash that is not the truth', async () => {
    await seed(roundRoom('r-lie'));
    const lie = (pid: string, hash: string) => ({
      [`rooms/${C}/priv/${pid}/lies/0`]: { text: 'A lie', hash },
      [`rooms/${C}/lieHashes/0/${hash}`]: pid,
      [`rooms/${C}/status/${pid}/lie-0`]: true,
    });
    await assertFails(db('ann').ref().update(lie('p1', 'TRUTHHASH')));
    await assertSucceeds(db('ann').ref().update(lie('p1', 'abc')));
    await assertFails(db('bob').ref().update(lie('p2', 'abc'))); // duplicate
    await assertSucceeds(db('bob').ref().update(lie('p2', 'def')));
    await assertFails(db('ann').ref().update({ [`rooms/${C}/priv/p1/lies/0`]: { text: 'changed', hash: 'abc' } })); // locked in
  });

  it("the subject can't lie about themselves", async () => {
    await seed(roundRoom('r-lie'));
    await assertFails(
      db('host').ref().update({ [`rooms/${C}/priv/p0/lies/0`]: { text: 'x', hash: 'h' }, [`rooms/${C}/lieHashes/0/h`]: 'p0' }),
    );
  });

  it("can't lie outside the lie phase or for another question", async () => {
    await seed(roundRoom('r-pick'));
    await assertFails(
      db('ann').ref().update({ [`rooms/${C}/priv/p1/lies/0`]: { text: 'x', hash: 'h' }, [`rooms/${C}/lieHashes/0/h`]: 'p1' }),
    );
  });

  it("can vote, but not for your own lie, and the subject can't vote", async () => {
    await seed({ ...roundRoom('r-pick'), toPlayer: { p1: { mine: { 0: 'optA' } } } });
    await assertFails(db('ann').ref(`rooms/${C}/priv/p1/votes/0`).set('optA'));
    await assertSucceeds(db('ann').ref(`rooms/${C}/priv/p1/votes/0`).set('optB'));
    await assertFails(db('host').ref(`rooms/${C}/priv/p0/votes/0`).set('optB'));
    await assertFails(db('ann').ref(`rooms/${C}/toPlayer/p2`).get());
    await assertSucceeds(db('ann').ref(`rooms/${C}/toPlayer/p1`).get());
  });

  it("the host's secret answer key is hidden from players", async () => {
    await seed({ ...roundRoom('r-pick'), secret: { owners: { 0: { optA: 'p1' } } } });
    await assertFails(db('ann').ref(`rooms/${C}/secret`).get());
  });
});

describe('host recovery', () => {
  it('a new device with the host key can become host', async () => {
    await seed(baseRoom(), { [`hostKeys/${C}/supersecret`]: true });
    await assertFails(db('host').ref(`hostKeys/${C}`).get());
    await assertFails(db('newphone').ref(`rooms/${C}/meta/hostUid`).set('newphone'));
    await assertSucceeds(db('newphone').ref(`claims/${C}/newphone`).set('wrongkey'));
    await assertFails(db('newphone').ref(`rooms/${C}/meta/hostUid`).set('newphone'));
    await assertSucceeds(db('newphone').ref(`claims/${C}/newphone`).set('supersecret'));
    await assertSucceeds(db('newphone').ref(`rooms/${C}/meta/hostUid`).set('newphone'));
    // ...and can then move the host's seat to the new device.
    await assertSucceeds(db('newphone').ref(`rooms/${C}/players/p0/uid`).set('newphone'));
  });
});

describe('prompt history', () => {
  it('stores timestamps only', async () => {
    await assertSucceeds(db('ann').ref('history/work/general/first-concert').set(now));
    await assertFails(db('ann').ref('history/work/general/first-concert').set('my secret answer'));
    await assertSucceeds(db('ann').ref('history/work/general').remove());
    await assertFails(db(null).ref('history').get());
  });
});
