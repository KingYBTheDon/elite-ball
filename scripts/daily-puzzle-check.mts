// Validates daily puzzle generation across many dates. Run: npx tsx scripts/daily-puzzle-check.mts
import {
  connectPuzzle,
  deepCutPuzzle,
  digDeeperPuzzle,
  rareHuntPuzzle,
  slatePuzzle,
} from "../src/lib/daily/puzzles.ts";

let fails = 0;
const bad = (m: string) => {
  console.log("  ✗ " + m);
  fails++;
};

const dates: string[] = [];
for (let i = 0; i < 60; i++) {
  const d = new Date(Date.UTC(2026, 5, 1) + i * 86_400_000);
  dates.push(d.toISOString().slice(0, 10));
}

let connectExamples = 0;
for (const date of dates) {
  // determinism
  if (JSON.stringify(connectPuzzle(date)) !== JSON.stringify(connectPuzzle(date)))
    bad(`${date} connect not deterministic`);
  if (deepCutPuzzle(date).prompt.id !== deepCutPuzzle(date).prompt.id)
    bad(`${date} deep-cut not deterministic`);

  const slate = slatePuzzle(date);
  if (slate.prompts.length !== 5) bad(`${date} slate has ${slate.prompts.length} prompts`);
  if (new Set(slate.prompts.map((p) => p.id)).size !== 5) bad(`${date} slate has dupes`);

  const rare = rareHuntPuzzle(date);
  if (rare.targets.length !== 8) bad(`${date} rare-hunt has ${rare.targets.length} targets`);

  const c = connectPuzzle(date);
  if (c.tiles.length !== 16) bad(`${date} connect tiles=${c.tiles.length}`);
  if (new Set(c.tiles).size !== 16) bad(`${date} connect duplicate tiles`);
  if (c.groups.length !== 4) bad(`${date} connect groups=${c.groups.length}`);
  for (const g of c.groups) if (g.members.length !== 4) bad(`${date} connect group size ${g.members.length}`);
  // every tile belongs to exactly one group
  const all = c.groups.flatMap((g) => g.members);
  if (new Set(all).size !== 16) bad(`${date} connect tiles not partitioned cleanly`);
  if (new Set(c.groups.map((g) => g.label)).size !== 4) bad(`${date} connect duplicate team labels`);

  if (connectExamples < 2) {
    connectExamples++;
    console.log(`\n  e.g. ${date} Connect:`);
    for (const g of c.groups) console.log(`    ${g.label}: ${g.members.join(", ")}`);
  }
}

console.log(`\nchecked ${dates.length} dates`);
console.log(fails === 0 ? "ALL PASS" : `${fails} FAILURE(S)`);
process.exitCode = fails === 0 ? 0 : 1;
