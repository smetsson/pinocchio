/** What this phone remembers (localStorage), so a refresh or lock screen rejoins the same seat. */
export interface Seat {
  pid: string;
  hostKey?: string;
}

const KEY = 'pinocchio:v1';

interface Stored {
  seats: Record<string, Seat>;
  lastRoom?: string;
  name?: string;
  avatar?: string;
  theme?: 'light' | 'dark' | 'auto';
}

function read(): Stored {
  try {
    return { seats: {}, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') };
  } catch {
    return { seats: {} };
  }
}

function write(s: Stored) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    /* private mode: ignore */
  }
}

export const session = {
  seat(code: string): Seat | undefined {
    return read().seats[code];
  },
  saveSeat(code: string, seat: Seat) {
    const s = read();
    s.seats[code] = { ...s.seats[code], ...seat };
    s.lastRoom = code;
    write(s);
  },
  forget(code: string) {
    const s = read();
    delete s.seats[code];
    if (s.lastRoom === code) delete s.lastRoom;
    write(s);
  },
  lastRoom(): string | undefined {
    return read().lastRoom;
  },
  profile(): { name: string; avatar: string } {
    const s = read();
    return { name: s.name ?? '', avatar: s.avatar ?? '' };
  },
  saveProfile(name: string, avatar: string) {
    write({ ...read(), name, avatar });
  },
  theme(): 'light' | 'dark' | 'auto' {
    return read().theme ?? 'auto';
  },
  setTheme(theme: 'light' | 'dark' | 'auto') {
    write({ ...read(), theme });
  },
};
