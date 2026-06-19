// Result tiers for a finished game, keyed off the average obscurity score.
//
// NAMES ARE PLACEHOLDERS. With the new bell-curve scoring a 5-round average sits
// around the mid-50s for solid play, so the bands are spread around that. Swap
// `name` (and `blurb`) for whatever you land on.

export interface Tier {
  min: number;
  name: string;
  blurb: string;
  accent: string; // tailwind text color class
}

export const TIERS: Tier[] = [
  { min: 80, name: "Tier S", blurb: "80+", accent: "text-orange-400" },
  { min: 65, name: "Tier A", blurb: "65–79", accent: "text-amber-300" },
  { min: 50, name: "Tier B", blurb: "50–64", accent: "text-sky-300" },
  { min: 35, name: "Tier C", blurb: "35–49", accent: "text-neutral-300" },
  { min: 0, name: "Tier D", blurb: "under 35", accent: "text-neutral-400" },
];

export function tierFor(score: number): Tier {
  return TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1];
}
