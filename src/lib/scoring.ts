// Obscurity scoring engine — the heart of the game.
//
// Turns a player's stint (one team+decade) into a 0-100 "obscurity" score where
// HIGHER = more obscure = a better answer. Two stages:
//
//  1. RAW BLEND — four obscurity signals are mixed. Stats and accolades are
//     team-specific (Dwyane Wade for the 2010s Cavs has no All-Stars there), but
//     fame (Wikipedia pageviews) is career-wide, so a famous player stays
//     well-known even on an obscure team. Popularity carries the most weight.
//
//  2. CURVE — the raw blend is remapped through the population's percentile onto
//     a target bell curve (mean ~55, std ~20). This guarantees scores spread
//     across the full range instead of clumping, regardless of how the raw
//     signals happen to distribute. Calibration is injected once at startup by
//     dataset.ts via setCalibration(); without it we fall back to the raw blend.
//
// All knobs live in SCORING.

import type { Player, ScoreBreakdown, RankedPlayer } from "./types";

export const SCORING = {
  // Weights sum to 1. Each feeds a 0-100 obscurity sub-score.
  weights: { fame: 0.45, notability: 0.3, career: 0.1, production: 0.15 },

  fame: { lo: 20, hi: 3_000_000 }, // Wikipedia monthly pageviews (log scale).
  career: { lo: 10, hi: 700 }, // games played for this team+decade.
  production: { lo: 0, hi: 27 }, // points per game for this team+decade.

  // "Notability" = how decorated/hyped a player is FOR THIS TEAM. It reduces
  // obscurity but never zeroes the score on its own.
  notability: {
    perAllStar: 10,
    perAllNBA: 7,
    awardShareWeight: 18, // × MVP+DPOY voting share earned here
    hof: 22, // career-wide (still known as a Hall of Famer)
    draftMax: 22, // a #1 overall pick OF THIS franchise (famous even as a bust)
    draftSpan: 30, // draft notability fades to 0 by this pick
    max: 100,
  },

  // Target distribution for the curved score.
  curve: { mean: 55, std: 20 },

  floor: 1, // minimum score when uncalibrated — no hard 0s.
} as const;

const clamp01 = (t: number) => Math.max(0, Math.min(1, t));
const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round1 = (n: number) => Math.round(n * 10) / 10;

/** Map a value into 0..1 across [lo, hi]. */
function norm(value: number, lo: number, hi: number): number {
  return clamp01((value - lo) / (hi - lo));
}

/** Map a value into 0..1 across [lo, hi] on a log10 scale. */
function normLog(value: number, lo: number, hi: number): number {
  const l = Math.log10(Math.max(value, 1));
  return clamp01((l - Math.log10(lo)) / (Math.log10(hi) - Math.log10(lo)));
}

/** How famous/decorated a player is for this stint, 0-100 (higher = more notable). */
function notability(p: Player): number {
  const n = SCORING.notability;
  const dp = p.draftPick;
  const draftNote =
    dp && dp <= n.draftSpan ? n.draftMax * (1 - (dp - 1) / n.draftSpan) : 0;
  return Math.min(
    n.max,
    (p.allStars ?? 0) * n.perAllStar +
      (p.allNBA ?? 0) * n.perAllNBA +
      (p.awardShare ?? 0) * n.awardShareWeight +
      (p.hof ? n.hof : 0) +
      draftNote,
  );
}

interface SubScores {
  fame: number;
  notability: number;
  career: number;
  production: number;
  raw: number;
}

/** The four 0-100 obscurity sub-scores plus their weighted (uncurved) blend. */
function subScores(p: Player): SubScores {
  const fame = (1 - normLog(p.pv, SCORING.fame.lo, SCORING.fame.hi)) * 100;
  const career = (1 - norm(p.games, SCORING.career.lo, SCORING.career.hi)) * 100;
  const production =
    (1 - norm(p.ppg, SCORING.production.lo, SCORING.production.hi)) * 100;
  const notabilityObs = 100 - notability(p); // less decorated => more obscure

  const w = SCORING.weights;
  const raw =
    w.fame * fame +
    w.notability * notabilityObs +
    w.career * career +
    w.production * production;

  return { fame, notability: notabilityObs, career, production, raw };
}

// --- population curve -------------------------------------------------------

let CALIBRATION: number[] | null = null;

/** Build a 101-point quantile table from every stint's raw blend. */
export function buildCalibration(raws: number[]): number[] {
  const sorted = [...raws].sort((a, b) => a - b);
  const N = 100;
  const q = new Array<number>(N + 1);
  for (let k = 0; k <= N; k++) {
    const pos = (k / N) * (sorted.length - 1);
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    q[k] = sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }
  return q;
}

/** Inject the population calibration (called once at startup by dataset.ts). */
export function setCalibration(quantiles: number[]): void {
  CALIBRATION = quantiles;
}

/** Raw blended obscurity for a stint — used to build the calibration table. */
export function rawTotal(p: Player): number {
  return subScores(p).raw;
}

/** Empirical percentile (0..1) of a raw value within the quantile table. */
function percentileOf(raw: number, q: number[]): number {
  const N = q.length - 1;
  if (raw <= q[0]) return 0;
  if (raw >= q[N]) return 1;
  let lo = 0;
  let hi = N;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (q[mid] <= raw) lo = mid;
    else hi = mid;
  }
  const span = q[hi] - q[lo] || 1;
  return (lo + (raw - q[lo]) / span) / N;
}

/** Inverse standard-normal CDF (Acklam's rational approximation). */
function invNorm(p: number): number {
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.38357751867269e2, -3.066479806614716e1, 2.506628277459239];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
  const plow = 0.02425;
  const phigh = 1 - plow;
  if (p < plow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= phigh) {
    const q = p - 0.5;
    const r = q * q;
    return (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

/** Remap a raw blend onto the target bell curve via its population percentile. */
function curve(raw: number): number {
  if (!CALIBRATION) return Math.max(SCORING.floor, raw);
  const p = clamp(percentileOf(raw, CALIBRATION), 1e-4, 1 - 1e-4);
  const z = invNorm(p);
  return clamp(SCORING.curve.mean + z * SCORING.curve.std, SCORING.floor, 100);
}

/**
 * Obscurity breakdown for a stint. The four sub-scores are the RAW signals
 * (0-100, higher = more obscure); `total` is the curved population score.
 */
export function scorePlayer(p: Player): ScoreBreakdown {
  const s = subScores(p);
  return {
    total: round1(curve(s.raw)),
    fame: round1(s.fame),
    notability: round1(s.notability),
    career: round1(s.career),
    production: round1(s.production),
  };
}

/** Score and sort a whole roster, most obscure first. */
export function rankRoster(roster: Player[]): RankedPlayer[] {
  return roster
    .map((p) => ({ name: p.name, score: scorePlayer(p).total }))
    .sort((a, b) => b.score - a.score);
}
