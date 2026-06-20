// Per-game daily progress in localStorage: streaks + today's result (so a
// finished game shows its summary instead of replaying). SSR-safe.

"use client";

import { daysBetween } from "./seed";
import type { DailyGameId } from "./games";

const KEY = "ebk:daily:v1";

/** A finished day's result for one game. `summary` is game-specific render data. */
export interface DayResult<T = unknown> {
  date: string;
  summary: T;
}

export interface GameState<T = unknown> {
  streak: number;
  best: number;
  lastDate: string | null;
  last?: DayResult<T>;
}

type Store = Partial<Record<DailyGameId, GameState>>;

function read(): Store {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function write(store: Store): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    /* ignore quota / private mode */
  }
}

export function getGameState<T>(id: DailyGameId): GameState<T> {
  return (read()[id] as GameState<T>) ?? { streak: 0, best: 0, lastDate: null };
}

/** Today's stored result for a game, if it was already completed today. */
export function resultForToday<T>(id: DailyGameId, date: string): DayResult<T> | null {
  const g = getGameState<T>(id);
  return g.last && g.last.date === date ? g.last : null;
}

/**
 * Record a finished day. Streak increments if yesterday was played, holds if
 * today was already recorded, otherwise resets to 1. Returns the new state.
 */
export function recordResult<T>(
  id: DailyGameId,
  date: string,
  summary: T,
): GameState<T> {
  const store = read();
  const prev = (store[id] as GameState<T>) ?? { streak: 0, best: 0, lastDate: null };

  let streak = prev.streak;
  if (prev.lastDate === date) {
    // already recorded today — keep streak
    streak = prev.streak || 1;
  } else if (prev.lastDate && daysBetween(prev.lastDate, date) === 1) {
    streak = prev.streak + 1;
  } else {
    streak = 1;
  }

  const next: GameState<T> = {
    streak,
    best: Math.max(prev.best, streak),
    lastDate: date,
    last: { date, summary },
  };
  store[id] = next as GameState;
  write(store);
  return next;
}
