/**
 * 🌍 All UI text lives here. To add Dutch: copy this file to nl.ts, translate the
 * values (keep the keys), and register it in src/i18n/index.ts.
 */
export const en = {
  appName: 'Pinocchio',
  tagline: 'The bluffing game about your colleagues',

  common: {
    next: 'Next',
    back: 'Back',
    cancel: 'Cancel',
    close: 'Close',
    submit: 'Submit',
    save: 'Save',
    copy: 'Copy',
    copied: 'Copied!',
    share: 'Share',
    you: 'you',
    points: (n: number) => `${n.toLocaleString()} pts`,
    plusPoints: (n: number) => `+${n.toLocaleString()}`,
    loading: 'Loading…',
    offline: 'Reconnecting…',
    host: 'host',
  },

  home: {
    create: 'Create a room',
    join: 'Join a room',
    codePlaceholder: 'CODE',
    joinButton: 'Join',
    rejoin: (code: string) => `Back to room ${code}`,
    notConfigured: 'Firebase is not configured yet. Paste your config into src/firebase-config.ts (see README).',
    howTo: 'Everyone plays on their own phone. Write believable lies about your colleagues, spot the truth, and fool your friends.',
  },

  profile: {
    name: 'Your name',
    namePlaceholder: 'e.g. Sofie',
    avatar: 'Pick your avatar',
  },

  create: {
    title: 'New room',
    pack: 'Question pack',
    freshLeft: (fresh: number, total: number) => `${fresh} of ${total} questions not played yet`,
    allPlayed: 'Your team has played every question in this pack! Old ones will come back, oldest first.',
    resetHistory: 'Reset history',
    resetConfirm: 'Forget which questions your team has already played in this pack?',
    length: 'Game length',
    short: 'Short',
    shortHint: '~20 min',
    standard: 'Standard',
    standardHint: '~30 min',
    mode: 'When do players answer the personal questions?',
    live: 'Live',
    liveHint: 'At the start of the game (~3 min)',
    precall: 'Before the call',
    precallHint: 'Share the link days ahead; the call is pure play',
    create: 'Create room',
    creating: 'Creating…',
  },

  join: {
    title: (code: string) => `Join room ${code}`,
    join: 'Join the game',
    joining: 'Joining…',
    notFound: "That room doesn't exist (or has expired).",
    started: 'This game has already started. Ask the host to start a new room.',
    full: 'This room is full.',
    nameTaken: 'Someone already uses that name. Pick another one!',
    kicked: 'The host removed you from this game.',
  },

  lobby: {
    title: 'Waiting for players',
    shareTitle: 'Invite your team',
    shareText: 'Join our Pinocchio game!',
    code: 'Room code',
    copyLink: 'Copy link',
    players: (n: number) => `${n} ${n === 1 ? 'player' : 'players'}`,
    needMore: (n: number) => `Need at least ${n} players`,
    start: 'Start game',
    waitingHost: 'Waiting for the host to start…',
    addBots: 'Add 5 bots (test)',
  },

  truths: {
    title: 'Tell the truth!',
    intro: 'Answer these about yourself, truthfully. Your colleagues will try to fake your answers later.',
    precallIntro: 'Answer these about yourself, truthfully. Your answers are saved: you can close this page and come back for the game.',
    swap: '🔀 Other question',
    placeholder: 'Your true answer',
    saved: 'Saved ✓',
    allDone: 'All done! 🎉',
    allDoneHint: "We'll use your answers when the game starts.",
    precallHostHint: 'Share the link with the team. Press "Start game" during the call; everyone who answered will be in the game.',
    answered: (n: number, total: number) => `${n}/${total} answered`,
    edit: 'Edit my answers',
    done: 'Done',
  },

  round: {
    title: (r: number) => (r === 3 ? 'Final round' : `Round ${r}`),
    double: 'Double points!',
    doubleShort: '×2',
    questionOf: (i: number, n: number) => `Question ${i} of ${n}`,
  },

  lie: {
    title: 'Write a believable lie',
    placeholder: 'Your lie',
    lieForMe: '🎲 Lie for me',
    submit: 'Lock it in',
    locked: 'Lie locked in! 🤥',
    lockedHint: 'Waiting for the others…',
    tooClose: "Too close to the truth! Try another one. 😉",
    taken: 'Someone already wrote that one. Try another!',
    noIdeas: "Pinocchio is out of ideas for this one. You'll have to invent it yourself! 😅",
    empty: 'Write something first.',
    tooLong: 'That one is a bit long.',
    subjectTitle: "They're lying about you… 🙊",
    subjectHint: 'Your colleagues are writing fake answers about you. Keep a straight face!',
  },

  pick: {
    title: 'Find the truth!',
    yours: 'your lie',
    picked: 'Picked! 👀',
    likeHint: 'Tap 👍 on your favourite lie',
    subjectTitle: 'Who will find your truth?',
    subjectHint: "Everyone's picking. You just watch. 😇",
  },

  reveal: {
    pickedBy: 'Picked by',
    nobody: 'Nobody fell for it',
    nobodyFound: 'Nobody found the truth! 😱',
    lieBy: (name: string) => `A lie by ${name}`,
    houseLie: "Pinocchio's lie 🪵",
    truth: 'THE TRUTH ✨',
    likes: (n: number) => `👍 ${n}`,
    alsoLies: 'Nobody fell for these:',
    points: 'Points this question',
    fooledYou: 'fooled!',
  },

  scores: {
    title: 'Scoreboard',
    afterRound: (r: number) => `After round ${r}`,
    nextRound2: 'Round 2: double points!',
    nextFinal: 'Final round: Truth or Fib',
  },

  final: {
    intro: 'Write one TRUE fact and one FIB about yourself. The others will guess which one is true.',
    truth: 'Something true about me',
    fib: 'A fib about me',
    truthPlaceholder: 'e.g. I once met the Pope',
    fibPlaceholder: 'e.g. I can speak Japanese',
    same: 'Your truth and your fib are the same!',
    submit: 'Lock them in',
    locked: 'Locked in! 🤐',
    pickTitle: (name: string) => `Which one is true about ${name}?`,
    subjectTitle: 'Which one will they believe?',
    subjectHint: "Everyone's guessing. Poker face! 😐",
    votes: (n: number) => `${n} ${n === 1 ? 'vote' : 'votes'}`,
    trueLabel: 'TRUE ✅',
    fibLabel: 'FIB 🤥',
    fooled: 'Fooled:',
    right: 'Got it right:',
    each: (n: number) => `+${n.toLocaleString()} each`,
  },

  end: {
    title: 'And the winner is…',
    awards: 'Awards',
    award: {
      liar: { title: 'Best Liar', icon: '🤥', desc: (n: number) => `fooled ${n} ${n === 1 ? 'time' : 'times'}` },
      detector: { title: 'Lie Detector', icon: '🔍', desc: (n: number) => `found the truth ${n} ${n === 1 ? 'time' : 'times'}` },
      favorite: { title: 'Crowd Favourite', icon: '👍', desc: (n: number) => `${n} ${n === 1 ? 'like' : 'likes'}` },
      mystery: { title: 'The Enigma', icon: '🕵️', desc: (n: number) => `${n}% missed their truth` },
    },
    deleteNow: '🗑️ Delete all answers now',
    deleteConfirm: 'Delete this room and all answers now? This cannot be undone.',
    deleted: 'Room deleted. Thanks for playing!',
    autoDelete: 'All answers are deleted automatically within 24 hours.',
    newGame: 'New game',
  },

  waiting: {
    title: 'Waiting for',
    everyone: 'Everyone is in! ✨',
    away: 'away',
  },

  host: {
    start: 'Start game',
    next: 'Next ▶',
    skip: 'Skip ⏭',
    reveal: 'Reveal ▶',
    extend: '+30s',
    menu: 'Host menu',
    players: 'Players',
    kick: 'Remove',
    kickConfirm: (name: string) => `Remove ${name} from the game?`,
    endGame: 'End game now',
    endConfirm: 'End the game now and go to the final scores?',
    recoveryLink: 'Host recovery link',
    recoveryHint: 'Open this on another phone if yours breaks, to take over as host. Keep it secret!',
    hostLost: 'The host is reconnecting…',
    theme: 'Theme',
    startTruthsFirst: 'Start the game (with everyone who answered)',
  },

  theme: { auto: 'Auto', light: 'Light', dark: 'Dark' },

  timer: { seconds: (s: number) => `${s}s` },

  errors: {
    generic: 'Something went wrong. Try again?',
    writeFailed: "Couldn't save that. Check your connection and try again.",
    claimFailed: "That host link didn't work.",
  },
};

export type Strings = typeof en;
