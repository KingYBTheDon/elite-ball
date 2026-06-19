// Step 1 of the data pipeline: download one season of league-wide player stats
// per request from stats.nba.com and cache the raw response to data/raw/.
//
// Historical seasons never change, so cached files are reused — only missing
// seasons (and the current one) are fetched. Run:
//   node scripts/pipeline/fetch-seasons.mjs [startYear] [endYear]
// Years are season-END years, e.g. 2019 == the "2018-19" season.

import { mkdirSync, existsSync, writeFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const RAW_DIR = join(ROOT, "data", "raw");

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  Referer: "https://www.nba.com/",
  Origin: "https://www.nba.com",
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-US,en;q=0.9",
  "x-nba-stats-origin": "stats",
  "x-nba-stats-token": "true",
};

/** "2018-19" for endYear 2019. */
function seasonStr(endYear) {
  return `${endYear - 1}-${String(endYear % 100).padStart(2, "0")}`;
}

function url(season) {
  const p = new URLSearchParams({
    College: "", Conference: "", Country: "", DateFrom: "", DateTo: "",
    Division: "", DraftPick: "", DraftYear: "", GameScope: "", GameSegment: "",
    Height: "", LastNGames: "0", LeagueID: "00", Location: "",
    MeasureType: "Base", Month: "0", OpponentTeamID: "0", Outcome: "",
    PORound: "0", PaceAdjust: "N", PerMode: "PerGame", Period: "0",
    PlayerExperience: "", PlayerPosition: "", PlusMinus: "N", Rank: "N",
    Season: season, SeasonSegment: "", SeasonType: "Regular Season",
    ShotClockRange: "", StarterBench: "", TeamID: "0", TwoWay: "0",
    VsConference: "", VsDivision: "", Weight: "",
  });
  return `https://stats.nba.com/stats/leaguedashplayerstats?${p}`;
}

async function fetchSeason(endYear, attempt = 1) {
  const season = seasonStr(endYear);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(url(season), { headers: HEADERS, signal: ctrl.signal });
    clearTimeout(timer);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const rs = data.resultSets?.[0];
    if (!rs?.rowSet?.length) throw new Error("empty resultSet");
    return rs;
  } catch (err) {
    clearTimeout(timer);
    if (attempt >= 4) throw err;
    const wait = attempt * 2000;
    console.log(`  retry ${attempt} (${err.message}) in ${wait}ms…`);
    await sleep(wait);
    return fetchSeason(endYear, attempt + 1);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const start = Number(process.argv[2] || 1990);
  const end = Number(process.argv[3] || new Date().getFullYear());
  mkdirSync(RAW_DIR, { recursive: true });
  console.log(`Fetching seasons ${start}–${end}…`);

  for (let y = start; y <= end; y++) {
    const file = join(RAW_DIR, `season-${y}.json`);
    // Reuse cached history; always refresh the most recent two seasons.
    if (existsSync(file) && y < end - 1) {
      console.log(`season ${seasonStr(y)}  cached`);
      continue;
    }
    try {
      const rs = await fetchSeason(y);
      writeFileSync(
        file,
        JSON.stringify({ endYear: y, season: seasonStr(y), headers: rs.headers, rowSet: rs.rowSet }),
      );
      console.log(`season ${seasonStr(y)}  ${rs.rowSet.length} players  ✓`);
    } catch (err) {
      console.log(`season ${seasonStr(y)}  FAILED: ${err.message}`);
    }
    await sleep(1200); // be polite
  }
  console.log("Done.");
}

main();
