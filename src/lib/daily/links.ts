// Server-side "teammate" graph for the Chain and Link daily games. Two players
// are linked if they shared a franchise in the same decade (same prompt roster).
// The graph is built once from the dataset; puzzle generation is deterministic
// per date.

import { allPromptMemberIds, fameOf, personName, personIdByName } from "../dataset";
import { rngFor, shuffle } from "./seed";

// --- graph ------------------------------------------------------------------

let ADJ: Map<string, Set<string>> | null = null;

function graph(): Map<string, Set<string>> {
  if (ADJ) return ADJ;
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    let s = adj.get(a);
    if (!s) adj.set(a, (s = new Set()));
    s.add(b);
  };
  for (const ids of allPromptMemberIds()) {
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        link(ids[i], ids[j]);
        link(ids[j], ids[i]);
      }
    }
  }
  ADJ = adj;
  return adj;
}

function linkedById(a: string, b: string): boolean {
  return graph().get(a)?.has(b) ?? false;
}

const famCache = new Map<number, string[]>();
function famousNodes(cutoff: number): string[] {
  let v = famCache.get(cutoff);
  if (v) return v;
  v = [...graph().keys()]
    .filter((id) => fameOf(id) <= cutoff && (graph().get(id)?.size ?? 0) >= 2)
    .sort(); // deterministic
  famCache.set(cutoff, v);
  return v;
}

/** A player's display name resolves unambiguously back to itself (no name clash).
 * Puzzles are validated by name, so every member must round-trip cleanly. */
function resolvesToSelf(id: string): boolean {
  const name = personName(id);
  return !!name && personIdByName(name) === id;
}

/** Is the whole set contained in a single prompt roster (a trivial clique)? */
function withinOneRoster(ids: string[]): boolean {
  const set = new Set(ids);
  return allPromptMemberIds().some((m) => {
    if (m.length < ids.length) return false;
    const ms = new Set(m);
    return ids.every((id) => ms.has(id));
  });
}

// --- Chain: arrange a hidden teammate path ----------------------------------

export interface ChainPuzzle {
  date: string;
  length: number;
  tiles: string[]; // shuffled display names (client)
  solutionIds: string[]; // server-only
}

export function chainPuzzle(date: string, length = 6): ChainPuzzle {
  const rng = rngFor(date, "chain");
  const fam = famousNodes(52);

  for (let attempt = 0; attempt < 300; attempt++) {
    const start = fam[Math.floor(rng() * fam.length)];
    const path = walk(start, length, rng, 52);
    if (path && path.every(resolvesToSelf) && !withinOneRoster(path)) {
      const names = path.map((id) => personName(id)!);
      return { date, length, tiles: shuffle(rng, names), solutionIds: path };
    }
  }
  // Fallback: relax the no-clique rule.
  for (let attempt = 0; attempt < 300; attempt++) {
    const start = fam[Math.floor(rng() * fam.length)];
    const path = walk(start, length, rng, 60);
    if (path) {
      const names = path.map((id) => personName(id)!);
      return { date, length, tiles: shuffle(rng, names), solutionIds: path };
    }
  }
  throw new Error("chain generation failed");
}

function walk(start: string, length: number, rng: () => number, cutoff: number): string[] | null {
  const path = [start];
  const used = new Set([start]);
  const dfs = (): boolean => {
    if (path.length === length) return true;
    const cur = path[path.length - 1];
    const nbrs = shuffle(
      rng,
      [...(graph().get(cur) ?? [])].filter((n) => !used.has(n) && fameOf(n) <= cutoff),
    );
    for (const n of nbrs) {
      path.push(n);
      used.add(n);
      if (dfs()) return true;
      path.pop();
      used.delete(n);
    }
    return false;
  };
  return dfs() ? path : null;
}

/** Validate a proposed ordering of names: per-link teammate check. */
export function validateChainOrder(names: string[]): { links: boolean[]; solved: boolean } {
  const ids = names.map((n) => personIdByName(n));
  const links: boolean[] = [];
  for (let i = 0; i < ids.length - 1; i++) {
    const a = ids[i];
    const b = ids[i + 1];
    links.push(!!a && !!b && linkedById(a, b));
  }
  const distinct = new Set(ids).size === ids.length && ids.every(Boolean);
  return { links, solved: distinct && links.every(Boolean) };
}

// --- Link: connect two endpoints through teammates --------------------------

export interface LinkPuzzle {
  date: string;
  a: string;
  b: string;
  aId: string;
  bId: string;
  par: number; // fewest bridge players needed
}

export function linkPuzzle(date: string): LinkPuzzle {
  const rng = rngFor(date, "link");
  const fam = famousNodes(45);

  for (let attempt = 0; attempt < 400; attempt++) {
    const a = fam[Math.floor(rng() * fam.length)];
    const dist = bfs(a, 4);
    if (!resolvesToSelf(a)) continue;
    const cands = fam.filter((b) => {
      const d = dist.get(b);
      return b !== a && d !== undefined && d >= 2 && d <= 4 && resolvesToSelf(b);
    });
    if (cands.length) {
      const b = cands[Math.floor(rng() * cands.length)];
      return {
        date,
        a: personName(a)!,
        b: personName(b)!,
        aId: a,
        bId: b,
        par: dist.get(b)! - 1,
      };
    }
  }
  throw new Error("link generation failed");
}

function bfs(start: string, maxDepth: number): Map<string, number> {
  const dist = new Map<string, number>([[start, 0]]);
  let frontier = [start];
  for (let depth = 1; depth <= maxDepth && frontier.length; depth++) {
    const next: string[] = [];
    for (const cur of frontier) {
      for (const n of graph().get(cur) ?? []) {
        if (!dist.has(n)) {
          dist.set(n, depth);
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  return dist;
}

/** Validate a full link chain [a, ...bridges, b] against the day's endpoints. */
export function validateLinkChain(
  date: string,
  names: string[],
): { links: boolean[]; solved: boolean; par: number } {
  const puz = linkPuzzle(date);
  const ids = names.map((n) => personIdByName(n));
  const links: boolean[] = [];
  for (let i = 0; i < ids.length - 1; i++) {
    const a = ids[i];
    const b = ids[i + 1];
    links.push(!!a && !!b && linkedById(a, b));
  }
  const endpointsOk = ids[0] === puz.aId && ids[ids.length - 1] === puz.bId;
  const distinct = new Set(ids).size === ids.length && ids.every(Boolean);
  return { links, solved: endpointsOk && distinct && links.every(Boolean), par: puz.par };
}

/** Resolve a typed name to its canonical display name (or null). */
export function canonicalName(name: string): string | null {
  const id = personIdByName(name);
  return id ? personName(id) ?? null : null;
}

/** One shortest teammate path between the day's endpoints (names), for reveal. */
export function shortestLinkPath(date: string): string[] {
  const puz = linkPuzzle(date);
  const parent = new Map<string, string | null>([[puz.aId, null]]);
  let frontier = [puz.aId];
  while (frontier.length && !parent.has(puz.bId)) {
    const next: string[] = [];
    for (const cur of frontier) {
      for (const n of graph().get(cur) ?? []) {
        if (!parent.has(n)) {
          parent.set(n, cur);
          next.push(n);
        }
      }
    }
    frontier = next;
  }
  const path: string[] = [];
  let cur: string | null | undefined = puz.bId;
  while (cur) {
    path.unshift(personName(cur)!);
    cur = parent.get(cur) ?? null;
  }
  return path;
}
