/**
 * Generates database.rules.json (Firebase Realtime Database security rules).
 * Run: npm run rules
 *
 * Summary:
 *  - Everything requires (anonymous) sign-in, and rooms become unreadable after meta/expiresAt.
 *  - Only the host can change the game state, the public game data and the secret answer keys.
 *  - Players can only write their own seat, answers, votes and likes, and only in the right phase.
 *  - Truths and lies are private (owner + host) until the host publishes them anonymised.
 */
import { writeFileSync } from 'node:fs';

const R = (p) => `root.child('rooms/' + $code + '${p}')`;
const signedIn = 'auth != null';
const alive = `${R('/meta/expiresAt')}.val() > now`;
const isHost = `${R('/meta/hostUid')}.val() === auth.uid`;
const host = `${signedIn} && ${isHost} && ${alive}`;
const pub = `${signedIn} && ${alive}`;
const me = `${signedIn} && ${alive} && ${R("/players/' + $pid + '/uid")}.val() === auth.uid && ${R("/players/' + $pid + '/kicked")}.val() !== true`;
const phase = (p) => `(${R('/state/phase')}.val() === '${p}')`;
const atQ = (v) => `${R('/state/q')}.val() + '' === ${v}`;
const subjectOfQ = `${R("/pub/questions/' + $q + '/subject")}.val()`;
const mine = `${R("/toPlayer/' + $pid + '/mine/' + $q + '")}.val()`;
const str = (max) => `newData.isString() && newData.val().length > 0 && newData.val().length <= ${max}`;
const MAX_TTL = 15 * 24 * 3600 * 1000;
const mode = (m) => `(${R('/meta/mode')}.val() === '${m}')`;
// Host failover (keep 15000 in sync with GAME.hostFailoverSeconds in src/config/game.ts).
const HOST_AWAY_MS = 15000;
const hostPresence = `${R("/presence/' + " + R('/meta/hostPid') + ".val() + '")}`;
const hostAway = `(${hostPresence}.isNumber() && ${hostPresence}.val() < now - ${HOST_AWAY_MS})`;
// Failover is possible from the lobby until the podium, except days ahead in pre-call mode.
const gameRunning = `!${phase('end')} && !(${phase('truths')} && ${mode('precall')})`;
const seatIsMine = (pidExpr) => `${R("/players/' + " + pidExpr + " + '/uid")}.val() === auth.uid && ${R("/players/' + " + pidExpr + " + '/kicked")}.val() !== true`;
const ownerPidExpr = `${R('/meta/ownerPid')}.val()`;
// Guard with isString(): gluing a missing claim into a path is an error, and an error makes the whole rule false.
const claimOk = `(root.child('claims/' + $code + '/' + auth.uid).isString() && root.child('hostKeys/' + $code + '/' + root.child('claims/' + $code + '/' + auth.uid).val()).exists())`;
// A phone proving it owns seat $pid with the secret seat key it saved when it joined.
const seatClaimOk = `(root.child('claims/' + $code + '/' + auth.uid).isString() && root.child('seatKeys/' + $code + '/' + $pid + '/' + root.child('claims/' + $code + '/' + auth.uid).val()).exists())`;
const roomGone = `(!${R('')}.exists() || ${R('/meta/expiresAt')}.val() < now || ${isHost})`;

const rules = {
  rules: {
    rooms: {
      $code: {
        '.read': host,
        // Create a new room (or reuse an expired code), or delete it (host, or anyone once expired).
        '.write': `${signedIn} && $code.matches(/^[A-Z]{4}$/) && (
          ((!data.exists() || data.child('meta/expiresAt').val() < now) && newData.child('meta/hostUid').val() === auth.uid && newData.child('state/v').val() === 0)
          || (!newData.exists() && (${isHost} || data.child('meta/expiresAt').val() < now)))`,
        meta: {
          '.read': pub,
          '.write': host,
          '.validate': "newData.hasChildren(['hostUid', 'hostPid', 'createdAt', 'expiresAt', 'pack', 'length', 'mode'])",
          // Becoming host is two steps. 1) Claim the host seat (hostPid), allowed for:
          //  - the room's creator, taking hosting back after a stand-in took over,
          //  - anyone with the secret host key (host recovery link),
          //  - a player standing in while the host's phone has been away for 15+ seconds mid-game.
          // 2) Bind it to your login (hostUid): only whoever owns the host seat (or holds the key).
          hostUid: {
            '.write': `${signedIn} && ${alive} && newData.val() === auth.uid && (${claimOk} || ${seatIsMine(R('/meta/hostPid') + '.val()')})`,
            '.validate': 'newData.isString()',
          },
          hostPid: {
            '.write': `${signedIn} && ${alive} && (
              (newData.val() === ${ownerPidExpr} && (${claimOk} || ${seatIsMine(ownerPidExpr)}))
              || (${seatIsMine('newData.val()')} && ${hostAway} && ${gameRunning}))`,
            '.validate': str(40),
          },
          ownerPid: { '.validate': `${str(40)} && (!data.exists() || newData.val() === data.val())` },
          expiresAt: { '.validate': `newData.isNumber() && newData.val() <= now + ${MAX_TTL}` },
          createdAt: { '.validate': 'newData.isNumber()' },
          pack: { '.validate': str(40) },
          length: { '.validate': "newData.val() === 'short' || newData.val() === 'standard'" },
          mode: { '.validate': "newData.val() === 'live' || newData.val() === 'precall'" },
          group: { '.validate': str(60) },
          $other: { '.validate': false },
        },
        players: {
          '.read': pub,
          $pid: {
            '.write': `${signedIn} && ${alive} && (
              (!data.exists() && newData.child('uid').val() === auth.uid && !${phase('end')})
              || (data.child('uid').val() === auth.uid && newData.child('uid').val() === auth.uid && newData.child('kicked').val() === data.child('kicked').val())
              || (${seatClaimOk} && newData.child('uid').val() === auth.uid && newData.child('kicked').val() === data.child('kicked').val())
              || ${isHost})`,
            '.validate': "newData.hasChildren(['uid', 'name', 'avatar', 'joinedAt'])",
            uid: { '.validate': 'newData.isString()' },
            name: { '.validate': str(20) },
            avatar: { '.validate': str(16) },
            joinedAt: { '.validate': 'newData.isNumber()' },
            kicked: { '.validate': 'newData.isBoolean()' },
            $other: { '.validate': false },
          },
        },
        presence: {
          '.read': pub,
          $pid: { '.write': me, '.validate': 'newData.val() === true || newData.isNumber()' },
        },
        state: {
          '.read': pub,
          '.write': host,
          // Optimistic lock: every change must bump v by exactly one.
          '.validate': "newData.hasChildren(['v', 'phase', 'q', 'deadline', 'step']) && (!data.exists() || newData.child('v').val() === data.child('v').val() + 1)",
        },
        pub: { '.read': pub, '.write': host },
        status: {
          '.read': pub,
          $pid: { '.write': me, $key: { '.validate': 'newData.val() === true' } },
        },
        priv: {
          $pid: {
            '.read': me,
            truths: {
              $promptId: { '.write': `${me} && ${phase('truths')}`, '.validate': str(100) },
            },
            lies: {
              $q: {
                '.write': `${me} && !data.exists() && ${phase('r-lie')} && ${atQ('$q')} && ${subjectOfQ} !== $pid`,
                '.validate': "newData.hasChildren(['text', 'hash']) && newData.parent().parent().parent().parent().child('lieHashes/' + $q + '/' + newData.child('hash').val()).val() === $pid",
                text: { '.validate': str(100) },
                hash: { '.validate': str(40) },
                $other: { '.validate': false },
              },
            },
            votes: {
              $q: {
                '.write': `${me} && ${phase('r-pick')} && ${atQ('$q')} && ${subjectOfQ} !== $pid && newData.val() !== ${mine}`,
                '.validate': str(20),
              },
            },
            likes: {
              $q: {
                '.write': `${me} && ${phase('r-pick')} && ${atQ('$q')} && ${subjectOfQ} !== $pid && (!newData.exists() || newData.val() !== ${mine})`,
                '.validate': str(20),
              },
            },
            final: {
              '.write': `${me} && ${phase('f-write')}`,
              '.validate': "newData.hasChildren(['truth', 'lie'])",
              truth: { '.validate': str(100) },
              lie: { '.validate': str(100) },
              $other: { '.validate': false },
            },
            fvotes: {
              $i: {
                '.write': `${me} && ${phase('f-pick')} && ${R('/state/q')}.val() + '' === $i && ${R("/pub/final/' + $i + '/subject")}.val() !== $pid`,
                '.validate': 'newData.val() === 0 || newData.val() === 1',
              },
            },
          },
        },
        toPlayer: {
          '.write': host,
          $pid: { '.read': me },
        },
        secret: { '.write': host },
        lieHashes: {
          '.read': pub,
          $q: {
            $h: {
              '.write': `${signedIn} && ${alive} && !data.exists() && ${phase('r-lie')} && ${atQ('$q')}
                && ${R("/players/' + newData.val() + '/uid")}.val() === auth.uid
                && ${R("/pub/questions/' + $q + '/truthHash")}.val() !== $h
                && ${subjectOfQ} !== newData.val()`,
              '.validate': str(40),
            },
          },
        },
      },
    },
    // Secret host keys (for the host recovery link). Nobody can read them.
    hostKeys: {
      $code: {
        '.write': `${signedIn} && !newData.exists() && ${roomGone}`,
        $key: {
          '.write': `${signedIn} && !data.parent().exists() && newData.parent().parent().parent().child('rooms/' + $code + '/meta/hostUid').val() === auth.uid`,
          '.validate': 'newData.val() === true',
        },
      },
    },
    // Secret seat keys: lets a phone take back its own seat if its sign-in identity is ever lost.
    // Written once by the seat's owner; nobody can read them.
    seatKeys: {
      $code: {
        '.write': `${signedIn} && !newData.exists() && ${roomGone}`,
        $pid: {
          $key: {
            '.write': `${signedIn} && !data.parent().exists() && root.child('rooms/' + $code + '/players/' + $pid + '/uid').val() === auth.uid`,
            '.validate': 'newData.val() === true',
          },
        },
      },
    },
    // A player's claim of a host or seat key (write-only).
    claims: {
      $code: {
        '.write': `${signedIn} && !newData.exists() && ${roomGone}`,
        $uid: { '.write': `${signedIn} && auth.uid === $uid`, '.validate': str(60) },
      },
    },
    // Room code -> expiry time, so any phone can clean up expired rooms.
    roomIndex: {
      '.read': signedIn,
      $code: {
        '.write': `${signedIn} && (
          (newData.exists() && newData.parent().parent().child('rooms/' + $code + '/meta/hostUid').val() === auth.uid)
          || (!newData.exists() && (data.val() < now || ${roomGone})))`,
        '.validate': 'newData.isNumber()',
      },
    },
    // When each prompt was last played, per group, so a group doesn't see repeats. Contains no answers.
    history: {
      '.read': signedIn,
      $group: {
        $pack: {
          '.write': `${signedIn} && !newData.exists()`,
          $prompt: { '.write': signedIn, '.validate': 'newData.isNumber()' },
        },
      },
    },
  },
};

// Collapse whitespace in multi-line conditions.
const json = JSON.stringify(rules, (k, v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ') : v), 2);
writeFileSync(new URL('../database.rules.json', import.meta.url), json + '\n');
console.log('✅ database.rules.json written');
