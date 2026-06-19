// Game-mode metadata. Pure constants (no fs/json), safe to import from client
// components and the server data layer alike.

// NOTE: the object keys (modern/classic) are internal — they drive the /play
// URLs and saved scores, so they stay put. Only the display `label` changed.
export const MODES = {
  modern: {
    label: "Classic",
    sub: "’90s to now",
    blurb: "",
    minDecade: 1990,
  },
  classic: {
    label: "Historic",
    sub: "’60s to now",
    blurb: "Ultimate Elite Ball Knowledge.",
    minDecade: 1960,
  },
} as const;

export type ModeKey = keyof typeof MODES;

export const isMode = (m: string): m is ModeKey => m in MODES;

export const ROUNDS_PER_GAME = 5;
