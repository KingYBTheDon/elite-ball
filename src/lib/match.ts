// Forgiving name matching so players don't lose on spelling/accents.

import type { Player } from "./types";

/** lowercase, strip accents + punctuation, collapse whitespace. */
export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // accents
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** All the normalized names a player answers to: real name + any aliases. */
function nameForms(p: Player): string[] {
  const forms = [normalizeName(p.name)];
  for (const a of p.aliases ?? []) {
    const n = normalizeName(a);
    if (n) forms.push(n);
  }
  return forms;
}

/**
 * Find a roster player matching the typed guess. Accepts, in order:
 *   1. an exact full name or alias (Metta World Peace, Penny Hardaway),
 *   2. a single first OR last name, but only when it's unique on the roster
 *      (so "Giannis" works, but "James" with two Jameses stays ambiguous).
 * Returns null if nothing matches or the guess is ambiguous.
 */
export function matchPlayer(guess: string, roster: Player[]): Player | null {
  const g = normalizeName(guess);
  if (!g) return null;

  // Exact full-name or alias match.
  const exact = roster.filter((p) => nameForms(p).includes(g));
  if (exact.length === 1) return exact[0];
  if (exact.length > 1) return null; // two players share this exact name

  // Single token: a first or last name, accepted only if unique on the roster.
  const tokenHits = roster.filter((p) =>
    nameForms(p).some((f) => {
      const parts = f.split(" ");
      return parts.length > 1 && (parts[0] === g || parts[parts.length - 1] === g);
    }),
  );
  if (tokenHits.length === 1) return tokenHits[0];

  return null;
}

/** Levenshtein edit distance between two strings. */
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  let curr = new Array<number>(n + 1);
  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[n];
}

/**
 * "Did you mean?" — the closest roster player to a non-matching guess, but ONLY
 * if it's a genuine near-miss (a typo). The tight, length-scaled threshold means
 * you can't fish for names: to land in range you basically already knew the name.
 * Returns null when nothing is close enough (a real "don't know it" miss).
 */
export function suggestPlayer(guess: string, roster: Player[]): Player | null {
  const g = normalizeName(guess);
  if (g.length < 3) return null;

  // Compare against each full name/alias AND its individual long tokens, so a
  // misspelled single name ("Jordon") can still point to "Michael Jordan".
  let best: Player | null = null;
  let bestForm = "";
  let bestDist = Infinity;
  let bestIsToken = false;
  for (const p of roster) {
    for (const form of nameForms(p)) {
      const tokens = form.split(" ").filter((t) => t.length >= 4);
      const candidates = [form, ...tokens];
      for (const c of candidates) {
        const d = editDistance(g, c);
        if (d < bestDist) {
          bestDist = d;
          best = p;
          bestForm = c;
          bestIsToken = c !== form;
        }
      }
    }
  }
  if (!best || bestDist === 0) return null;

  // Single-name corrections are stricter: tighter threshold + same first letter,
  // since real typos rarely change the opening letter (rules out "Smith"→"Keith").
  if (bestIsToken) {
    const tokenMax = Math.max(1, Math.round(bestForm.length * 0.2));
    return bestDist <= tokenMax && bestForm[0] === g[0] ? best : null;
  }
  const threshold = Math.max(2, Math.round(bestForm.length * 0.25));
  return bestDist <= threshold ? best : null;
}
