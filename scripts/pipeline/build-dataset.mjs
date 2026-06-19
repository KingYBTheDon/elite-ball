// Step 2 of the pipeline (fully offline): read cached raw seasons and build the
// game dataset — players with career stats + prompts grouped by team & decade.
// Output: src/data/generated/dataset.json. Run:
//   node scripts/pipeline/build-dataset.mjs

import { readdirSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RAW_DIR = join(ROOT, "data", "raw");
const OUT_DIR = join(ROOT, "src", "data", "generated");

// Minimum players for a (team, decade) to become a playable prompt.
const MIN_ROSTER = 10;

// Column indices in the cached rowSet.
const COL = { id: 0, name: 1, team: 4, gp: 6, pts: 30 };

// Team abbreviation -> display name (covers franchises across 1990-2025).
const TEAMS = {
  ATL: "Atlanta Hawks", BOS: "Boston Celtics", BKN: "Brooklyn Nets",
  NJN: "New Jersey Nets", CHA: "Charlotte Hornets", CHH: "Charlotte Hornets",
  CHI: "Chicago Bulls", CLE: "Cleveland Cavaliers", DAL: "Dallas Mavericks",
  DEN: "Denver Nuggets", DET: "Detroit Pistons", GSW: "Golden State Warriors",
  HOU: "Houston Rockets", IND: "Indiana Pacers", LAC: "Los Angeles Clippers",
  LAL: "Los Angeles Lakers", MEM: "Memphis Grizzlies", VAN: "Vancouver Grizzlies",
  MIA: "Miami Heat", MIL: "Milwaukee Bucks", MIN: "Minnesota Timberwolves",
  NOP: "New Orleans Pelicans", NOH: "New Orleans Hornets", NOK: "New Orleans/Oklahoma City Hornets",
  NYK: "New York Knicks", OKC: "Oklahoma City Thunder", SEA: "Seattle SuperSonics",
  ORL: "Orlando Magic", PHI: "Philadelphia 76ers", PHX: "Phoenix Suns",
  POR: "Portland Trail Blazers", SAC: "Sacramento Kings", SAS: "San Antonio Spurs",
  TOR: "Toronto Raptors", UTA: "Utah Jazz", WAS: "Washington Wizards",
  WSB: "Washington Bullets",
};

function decadeOf(endYear) {
  const startYear = endYear - 1; // "2018-19" belongs to the 2010s
  return Math.floor(startYear / 10) * 10;
}

function main() {
  const files = readdirSync(RAW_DIR).filter((f) => /^season-\d+\.json$/.test(f));
  if (!files.length) throw new Error("No raw seasons. Run fetch-seasons.mjs first.");

  // Aggregate per player across all cached seasons.
  const players = new Map(); // id -> { id, name, gpSum, ptsWeighted }
  const membership = new Map(); // "TEAM|DECADE" -> Set(playerId)

  for (const file of files) {
    const { rowSet, endYear } = JSON.parse(readFileSync(join(RAW_DIR, file), "utf8"));
    const decade = decadeOf(endYear);
    for (const row of rowSet) {
      const id = row[COL.id];
      const name = row[COL.name];
      const team = row[COL.team];
      const gp = Number(row[COL.gp]) || 0;
      const ppg = Number(row[COL.pts]) || 0;

      let p = players.get(id);
      if (!p) {
        p = { id, name, gpSum: 0, ptsWeighted: 0 };
        players.set(id, p);
      }
      p.name = name; // keep most recent spelling
      p.gpSum += gp;
      p.ptsWeighted += ppg * gp;

      if (TEAMS[team]) {
        const key = `${team}|${decade}`;
        if (!membership.has(key)) membership.set(key, new Set());
        membership.get(key).add(id);
      }
    }
  }

  // Finalize player career stats.
  const playerOut = {};
  for (const p of players.values()) {
    playerOut[p.id] = {
      id: p.id,
      name: p.name,
      games: p.gpSum,
      ppg: p.gpSum ? Math.round((p.ptsWeighted / p.gpSum) * 10) / 10 : 0,
    };
  }

  // Build prompts for every team-decade meeting the roster threshold.
  const prompts = [];
  for (const [key, ids] of membership) {
    if (ids.size < MIN_ROSTER) continue;
    const [team, decadeNum] = key.split("|");
    const decade = `${decadeNum}s`;
    prompts.push({
      id: `${team.toLowerCase()}-${decadeNum}s`,
      team: TEAMS[team],
      decade,
      label: `${decade} ${TEAMS[team]}`,
      playerIds: [...ids],
    });
  }
  prompts.sort((a, b) => a.label.localeCompare(b.label));

  mkdirSync(OUT_DIR, { recursive: true });
  const out = {
    generatedAt: new Date().toISOString(),
    seasonsCovered: files.length,
    players: playerOut,
    prompts,
  };
  writeFileSync(join(OUT_DIR, "dataset.json"), JSON.stringify(out));

  const uniqueInPrompts = new Set(prompts.flatMap((p) => p.playerIds)).size;
  console.log(
    `Built dataset: ${prompts.length} prompts, ` +
      `${Object.keys(playerOut).length} players (${uniqueInPrompts} used in prompts), ` +
      `from ${files.length} seasons.`,
  );
}

main();
