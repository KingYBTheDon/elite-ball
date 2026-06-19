// Result tiers for a finished game, keyed off the average obscurity score.
// With the bell-curve scoring a 5-round average sits around the mid-50s for
// solid play, so the bands are spread around that.

export interface Tier {
  min: number;
  name: string;
  blurb: string;
  accent: string; // tailwind text color class
}

export const TIERS: Tier[] = [
  { min: 80, name: "Elite Ball Knowledge", blurb: "80+", accent: "text-orange-400" },
  { min: 65, name: "Ball Knowledge", blurb: "65–79", accent: "text-amber-300" },
  { min: 50, name: "NBA Enjoyer", blurb: "50–64", accent: "text-sky-300" },
  { min: 35, name: "Casual", blurb: "35–49", accent: "text-neutral-300" },
  { min: 0, name: "Hell Nah", blurb: "under 35", accent: "text-neutral-400" },
];

export function tierFor(score: number): Tier {
  return TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1];
}
