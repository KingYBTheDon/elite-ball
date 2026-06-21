// Runtime data access. Reads the pre-built dataset (rosters + career stats,
// bundled at build time) and merges the Wikipedia fame signal. The website
// makes ZERO external calls — everything here is local, built monthly by the
// scripts in scripts/pipeline/.

import path from "node:path";
import fs from "node:fs";
import dataset from "@/data/generated/dataset.json";
import type { Player, Prompt } from "./types";
import { MODES, type ModeKey } from "./modes";
import { buildCalibration, rawTotal, scorePlayer, setCalibration } from "./scoring";
import { ALIASES } from "@/data/aliases";
import { normalizeName } from "./match";

// Person-level (career-wide) info.
interface RawPlayer {
  name: string;
  hof: boolean;
}
// One roster entry = a player's stint with a team in a decade (team-specific).
interface RawStint {
  id: string;
  games: number;
  ppg: number;
  allStars: number;
  allNBA: number;
  awardShare: number;
  draftPick: number | null;
}
interface RawPrompt {
  id: string;
  team: string;
  decade: string;
  label: string;
  roster: RawStint[];
}
interface PageviewEntry {
  pv: number;
}

// Fame for players not yet fetched: a fringe-rotation default so a missing
// lookup never masquerades as a maximally obscure deep cut.
const DEFAULT_PV = 5000;

// pageviews.json changes monthly and is populated by a background job, so read
// it from disk (not a bundled import) and tolerate it being absent/partial.
function loadPageviews(): Record<string, PageviewEntry> {
  const p = path.join(process.cwd(), "src", "data", "generated", "pageviews.json");
  try {
    return JSON.parse(fs.readFileSync(p, "utf8"));
  } catch {
    return {};
  }
}

const players = dataset.players as Record<string, RawPlayer>;
const rawPrompts = dataset.prompts as RawPrompt[];

function buildPrompt(rp: RawPrompt, pv: Record<string, PageviewEntry>): Prompt {
  const roster: Player[] = rp.roster.map((st) => {
    const person = players[String(st.id)];
    const views = pv[String(st.id)]?.pv; // fame is career-wide, keyed by player id
    return {
      name: person.name,
      wiki: person.name,
      pv: views && views > 0 ? views : DEFAULT_PV,
      ppg: st.ppg,
      games: st.games,
      allStars: st.allStars,
      allNBA: st.allNBA,
      awardShare: st.awardShare,
      hof: person.hof, // career-wide
      draftPick: st.draftPick,
      aliases: ALIASES[st.id], // career-wide nicknames / alt names
    };
  });
  return { id: rp.id, team: rp.team, decade: rp.decade, label: rp.label, roster };
}

// Cache built prompts per process; pageviews are read once at startup.
const pageviews = loadPageviews();
const promptCache = new Map<string, Prompt>(
  rawPrompts.map((rp) => [rp.id, buildPrompt(rp, pageviews)]),
);
const ids = [...promptCache.keys()];

// Calibrate the scoring curve against the whole population of stints, so the
// percentile remap is anchored to the real spread of obscurity in the game.
setCalibration(
  buildCalibration(
    [...promptCache.values()].flatMap((p) => p.roster.map(rawTotal)),
  ),
);

// --- player index + co-occurrence (for the daily "teammate" games) ----------
// Two players are "linked" if they shared a franchise in the same decade
// (i.e. appear in the same prompt roster). We also track a display name and a
// fame proxy (best/lowest obscurity across their stints) per player id.
const nameById = new Map<string, string>();
const idByNorm = new Map<string, string>(); // normalized name -> id
const fameById = new Map<string, number>(); // lower = more famous
const promptMemberIds: string[][] = [];

for (const rp of rawPrompts) {
  const prompt = promptCache.get(rp.id)!;
  const memberIds = rp.roster.map((st) => String(st.id));
  promptMemberIds.push(memberIds);
  rp.roster.forEach((st, i) => {
    const id = String(st.id);
    const player = prompt.roster[i];
    nameById.set(id, player.name);
    const norm = normalizeName(player.name);
    if (!idByNorm.has(norm)) idByNorm.set(norm, id);
    for (const alt of ALIASES[id] ?? []) {
      const an = normalizeName(alt);
      if (!idByNorm.has(an)) idByNorm.set(an, id);
    }
    const ob = scorePlayer(player).total;
    fameById.set(id, Math.min(fameById.get(id) ?? 1e9, ob));
  });
}

export function personName(id: string): string | undefined {
  return nameById.get(id);
}
export function personIdByName(name: string): string | undefined {
  return idByNorm.get(normalizeName(name));
}
/** Best (lowest) obscurity across a player's stints — a fame proxy. */
export function fameOf(id: string): number {
  return fameById.get(id) ?? 100;
}
/** Each prompt's roster as player-id lists — the edges of the co-occurrence graph. */
export function allPromptMemberIds(): string[][] {
  return promptMemberIds;
}

const decadeYear = (decade: string) => parseInt(decade, 10); // "1990s" -> 1990

// Precompute the prompt pool for each mode.
const poolByMode: Record<ModeKey, string[]> = {
  modern: ids.filter((id) => decadeYear(promptCache.get(id)!.decade) >= MODES.modern.minDecade),
  classic: ids.filter((id) => decadeYear(promptCache.get(id)!.decade) >= MODES.classic.minDecade),
};

export function getPrompt(id: string): Prompt | undefined {
  return promptCache.get(id);
}

export function randomPrompt(mode: ModeKey = "modern"): Prompt {
  const pool = poolByMode[mode] ?? poolByMode.modern;
  return promptCache.get(pool[Math.floor(Math.random() * pool.length)])!;
}

export function promptCount(mode?: ModeKey): number {
  return mode ? poolByMode[mode].length : ids.length;
}

export interface PromptLite {
  id: string;
  label: string;
  rosterSize: number;
}

/** Lightweight list of all prompts (optionally for one mode) — for the daily picker. */
export function listPrompts(mode?: ModeKey): PromptLite[] {
  const pool = mode ? poolByMode[mode] : ids;
  return pool.map((id) => {
    const p = promptCache.get(id)!;
    return { id, label: p.label, rosterSize: p.roster.length };
  });
}

// Flat list of EVERY player (with any aliases) for the typeahead. It spans the
// whole league on purpose — suggesting from the current roster would reveal the
// answers, but suggesting from everyone only helps with spelling/recall.
export interface PlayerEntry {
  name: string;
  alt?: string[];
}
let playerList: PlayerEntry[] | null = null;
export function allPlayers(): PlayerEntry[] {
  if (playerList) return playerList;
  const seen = new Set<string>();
  const list: PlayerEntry[] = [];
  for (const id of Object.keys(players)) {
    const { name } = players[id];
    if (seen.has(name)) continue; // collapse rare duplicate display names
    seen.add(name);
    const alt = ALIASES[id];
    list.push(alt ? { name, alt } : { name });
  }
  list.sort((a, b) => a.name.localeCompare(b.name));
  playerList = list;
  return list;
}
