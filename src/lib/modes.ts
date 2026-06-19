// Game-mode metadata. Pure constants (no fs/json), safe to import from client
// components and the server data layer alike.

export const MODES = {
  modern: {
    label: "Modern",
    sub: "’90s to now",
    blurb: "Mostly names you’ll recognise.",
    minDecade: 1990,
  },
  classic: {
    label: "Classic",
    sub: "’60s to now",
    blurb: "Six decades back. The hard one.",
    minDecade: 1960,
  },
} as const;

export type ModeKey = keyof typeof MODES;

export const isMode = (m: string): m is ModeKey => m in MODES;

export const ROUNDS_PER_GAME = 5;
