// Server-side daily puzzle generation for the obscurity-score games. Deterministic
// from the date string. (The teammate games — Chain, Link — live in links.ts.)

import { listPrompts, getPrompt, type PromptLite } from "../dataset";
import { rankRoster } from "../scoring";
import { pickOne, rngFor, shuffle } from "./seed";

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
  return { date, prompt: pickOne(rngFor(date, "deep-cut"), pool(16)) };
}

export function digDeeperPuzzle(date: string): { date: string; prompt: PromptLite } {
  return { date, prompt: pickOne(rngFor(date, "dig-deeper"), pool(22)) };
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
  const ranked = rankRoster(getPrompt(prompt.id)!.roster); // most obscure first
  return { date, prompt, targets: ranked.slice(0, RARE_TARGET_COUNT) };
}
