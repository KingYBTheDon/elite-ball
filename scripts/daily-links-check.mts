// Validates Chain + Link puzzle generation. Run: npx tsx scripts/daily-links-check.mts
import {
  chainPuzzle,
  linkPuzzle,
  validateChainOrder,
  validateLinkChain,
} from "../src/lib/daily/links.ts";
import { personName } from "../src/lib/dataset.ts";

let fails = 0;
const bad = (m: string) => {
  console.log("  ✗ " + m);
  fails++;
};

const dates: string[] = [];
for (let i = 0; i < 40; i++) {
  dates.push(new Date(Date.UTC(2026, 5, 1) + i * 86_400_000).toISOString().slice(0, 10));
}

let shownChain = 0;
let shownLink = 0;
for (const date of dates) {
  // Chain
  const c = chainPuzzle(date);
  if (c.tiles.length !== c.length) bad(`${date} chain tiles ${c.tiles.length} != ${c.length}`);
  if (new Set(c.tiles).size !== c.length) bad(`${date} chain dup tiles`);
  const solNames = c.solutionIds.map((id) => personName(id)!);
  const v = validateChainOrder(solNames);
  if (!v.solved) bad(`${date} chain solution does not validate`);
  if (shownChain < 2) {
    shownChain++;
    console.log(`  Chain ${date}: ${solNames.join(" — ")}`);
  }

  // Link
  const l = linkPuzzle(date);
  if (l.par < 1) bad(`${date} link par ${l.par}`);
  if (l.a === l.b) bad(`${date} link same endpoints`);
  if (shownLink < 3) {
    shownLink++;
    console.log(`  Link ${date}: ${l.a}  …(${l.par})…  ${l.b}`);
  }
  // a degenerate 2-name chain [a,b] should NOT solve (they're >=2 apart)
  const direct = validateLinkChain(date, [l.a, l.b]);
  if (direct.solved) bad(`${date} link solved with no bridges (par ${l.par})`);
}

console.log(`\nchecked ${dates.length} dates`);
console.log(fails === 0 ? "ALL PASS" : `${fails} FAILURE(S)`);
process.exitCode = fails === 0 ? 0 : 1;
