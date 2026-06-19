// Client-side persistence (localStorage): per-mode high scores and a game log.
// All functions are no-ops / safe defaults during SSR.

import type { ModeKey } from "./modes";

const KEY = "ebk:v1";

export interface PlayedRound {
  label: string;
  player: string;
  score: number;
}

export interface GameRecord {
  mode: ModeKey;
  avg: number;
  date: number; // epoch ms
  rounds: PlayedRound[];
}

interface Store {
  highscores: Partial<Record<ModeKey, number>>;
  log: GameRecord[];
}

const EMPTY: Store = { highscores: {}, log: [] };
const MAX_LOG = 20;

function read(): Store {
  if (typeof window === "undefined") return EMPTY;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? { ...EMPTY, ...JSON.parse(raw) } : EMPTY;
  } catch {
    return EMPTY;
  }
}

function write(store: Store) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* quota / private mode — ignore */
  }
}

export function loadStore(): Store {
  return read();
}

/** Record a finished game; returns whether it set a new high score. */
export function saveGame(record: GameRecord): boolean {
  const store = read();
  const prevBest = store.highscores[record.mode] ?? 0;
  const isHigh = record.avg > prevBest;
  if (isHigh) store.highscores[record.mode] = record.avg;
  store.log = [record, ...store.log].slice(0, MAX_LOG);
  write(store);
  return isHigh;
}
