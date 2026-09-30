import { createContext } from 'preact';
import { useContext } from 'preact/hooks';
import type { Fb } from '../data/firebase';
import type { Player, PromptPack, Room, Updates } from '../logic/types';

export interface GameContext {
  fb: Fb;
  code: string;
  room: Room;
  pid: string;
  isHost: boolean;
  /** Big-screen view: watches the game, never plays. */
  spectator?: boolean;
  pack: PromptPack;
  /** Server-synced clock (ms). */
  now: () => number;
  /** Write updates; returns false (and shows an error) on failure. */
  act: (u: Updates) => Promise<boolean>;
  /** Host actions. */
  host: {
    next: () => void;
    extend: () => void;
    kick: (pid: string) => void;
    end: () => void;
  };
}

export const Game = createContext<GameContext>(null as unknown as GameContext);

export function useGame(): GameContext {
  return useContext(Game);
}

export function usePlayer(pid: string | undefined): Player | undefined {
  const { room } = useGame();
  return pid ? room.players?.[pid] : undefined;
}
