// Server-side daily puzzle generation. Deterministic from the date string, so
// the same call on any server instance (or a later request for grading) yields
// the identical puzzle. Built on the real dataset + obscurity engine.

import { listPrompts, getPrompt, type PromptLite } from "../dataset";
import { scorePlayer, rankRoster } from "../scoring";
import { pickN, pickOne, rngFor, shuffle } from "./seed";

// Daily pool: the Modern era (1990+), for recognizable teams.
const MODE = "modern" as const;

function pool(minRoster = 12): PromptLite[] {
  return listPrompts(MODE)
    .filter((p) => p.rosterSize >= minRoster)
    .sort((a, b) => a.id.localeCompare(b.id)); // stable order
}

const franchiseOf = (id: string) => id.split("-")[0];

// --- Deep Cut / Dig Deeper: one matchup --------------------------------------

export function deepCutPuzzle(date: string): { date: string; prompt: PromptLite } {
  const prompt = pickOne(rngFor(date, "deep-cut"), pool(16));
  return { date, prompt };
}

export function digDeeperPuzzle(date: string): { date: string; prompt: PromptLite } {
  // Bigger rosters so there's room to keep climbing.
  const prompt = pickOne(rngFor(date, "dig-deeper"), pool(22));
  return { date, prompt };
}

// --- Slate: five distinct-franchise matchups ---------------------------------

export function slatePuzzle(date: string): { date: string; prompts: PromptLite[] } {
  const rng = rngFor(date, "slate");
  const order = shuffle(rng, pool(14));
  const prompts: PromptLite[] = [];
  const used = new Set<string>();
  for (const p of order) {
    if (prompts.length === 5) break;
    const fr = franchiseOf(p.id);
    if (used.has(fr)) continue;
    used.add(fr);
    prompts.push(p);
  }
  return { date, prompts };
}

// --- Rare Hunt: the 8 most obscure on one roster -----------------------------

export const RARE_TARGET_COUNT = 8;

export function rareHuntPuzzle(date: string): {
  date: string;
  prompt: PromptLite;
  targets: { name: string; score: number }[];
} {
  const prompt = pickOne(rngFor(date, "rare-hunt"), pool(20));
  const full = getPrompt(prompt.id)!;
  const ranked = rankRoster(full.roster); // most obscure first
  const targets = ranked.slice(0, RARE_TARGET_COUNT);
  return { date, prompt, targets };
}

// --- Connect: 16 players in 4 team groups ------------------------------------

export interface ConnectGroup {
  label: string;
  members: string[]; // 4 names
}
export interface ConnectPuzzle {
  date: string;
  groups: ConnectGroup[]; // the solution (kept server-side)
  tiles: string[]; // 16 shuffled names (what the client sees)
}

const GROUP_SIZE = 4;
const GROUP_COUNT = 4;

export function connectPuzzle(date: string): ConnectPuzzle {
  const rng = rngFor(date, "connect");

  // One representative prompt per franchise (its largest Modern roster).
  const byFr = new Map<string, PromptLite>();
  for (const p of pool(14)) {
    const fr = franchiseOf(p.id);
    const cur = byFr.get(fr);
    if (!cur || p.rosterSize > cur.rosterSize) byFr.set(fr, p);
  }
  const reps = shuffle(rng, [...byFr.values()]);

  // Cache roster names per prompt.
  const namesOf = new Map<string, { name: string; score: number }[]>();
  const rosterNames = (p: PromptLite) => {
    let v = namesOf.get(p.id);
    if (!v) {
      v = getPrompt(p.id)!.roster.map((pl) => ({ name: pl.name, score: scorePlayer(pl).total }));
      namesOf.set(p.id, v);
    }
    return v;
  };

  // Try windows of 4 franchises until one yields four clean groups.
  for (let i = 0; i + GROUP_COUNT <= reps.length; i++) {
    const four = reps.slice(i, i + GROUP_COUNT);
    const groups = buildGroups(rng, four, rosterNames);
    if (groups) {
      const tiles = shuffle(rng, groups.flatMap((g) => g.members));
      return { date, groups, tiles };
    }
  }
  // Extremely unlikely fallback: first four with relaxed picking.
  const four = reps.slice(0, GROUP_COUNT);
  const groups = four.map((p) => ({
    label: p.label,
    members: rosterNames(p).slice(0, GROUP_SIZE).map((x) => x.name),
  }));
  return { date, groups, tiles: shuffle(rng, groups.flatMap((g) => g.members)) };
}

function buildGroups(
  rng: () => number,
  four: PromptLite[],
  rosterNames: (p: PromptLite) => { name: string; score: number }[],
): ConnectGroup[] | null {
  const sets = four.map((p) => new Set(rosterNames(p).map((x) => x.name)));
  const groups: ConnectGroup[] = [];

  for (let i = 0; i < four.length; i++) {
    // Names exclusive to this franchise among the four (so each tile has one home).
    const exclusive = rosterNames(four[i]).filter(
      (x) => !sets.some((s, j) => j !== i && s.has(x.name)),
    );
    // Prefer the "middle" obscurity band: not superstars, not total ghosts.
    const mid = exclusive
      .slice()
      .sort((a, b) => a.score - b.score)
      .filter((x) => x.score >= 38 && x.score <= 88);
    const bag = mid.length >= GROUP_SIZE ? mid : exclusive;
    if (bag.length < GROUP_SIZE) return null;
    const members = pickN(rng, bag, GROUP_SIZE).map((x) => x.name);
    groups.push({ label: four[i].label, members });
  }
  return groups;
}
