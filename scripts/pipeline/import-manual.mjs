// Build the game dataset from manually-downloaded Basketball-Reference CSVs
// (placed in data/manual/). This is the BEST-quality path: full history plus
// accolades, joined on the stable `player_id` slug. Replaces the NBA-API build.
// Run:  node scripts/pipeline/import-manual.mjs
//
// Stats and accolades are attributed to the TEAM + ERA a player earned them in,
// not their whole career: Dwyane Wade for the 2010s Cavs is a deep cut even
// though Wade-the-player is famous. Only fame (Wikipedia pageviews, merged at
// runtime) and HOF status stay career-wide — those answer "do people know this
// person at all", which doesn't reset when a player changes teams.

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MANUAL = join(ROOT, "data", "manual");
const OUT_DIR = join(ROOT, "src", "data", "generated");

const LEAGUES = new Set(["NBA", "BAA"]); // BAA is the NBA's direct predecessor.
const MIN_ROSTER = 10;
const MULTI_TEAM = /^\dTM$/; // "2TM", "3TM", ... = combined traded-season row.

// Franchise lineage: every historical team abbreviation -> the abbreviation of
// the franchise as it exists TODAY. Teams with no modern continuation are
// omitted entirely (the game only uses teams that still exist). This is how a
// "1990s Seattle SuperSonics" prompt maps to today's OKC Thunder.
const FRANCHISE = {
  TRI: "ATL", MLH: "ATL", STL: "ATL", ATL: "ATL",
  BOS: "BOS",
  NYN: "BRK", NJN: "BRK", BRK: "BRK",
  CHH: "CHO", CHA: "CHO", CHO: "CHO", // official NBA history: Hornets lineage
  CHI: "CHI",
  CLE: "CLE",
  DAL: "DAL",
  DEN: "DEN",
  FTW: "DET", DET: "DET",
  PHW: "GSW", SFW: "GSW", GSW: "GSW",
  SDR: "HOU", HOU: "HOU",
  IND: "IND",
  BUF: "LAC", SDC: "LAC", LAC: "LAC",
  MNL: "LAL", LAL: "LAL",
  VAN: "MEM", MEM: "MEM",
  MIA: "MIA",
  MIL: "MIL",
  MIN: "MIN",
  NOH: "NOP", NOK: "NOP", NOP: "NOP",
  NYK: "NYK",
  SEA: "OKC", OKC: "OKC",
  ORL: "ORL",
  SYR: "PHI", PHI: "PHI",
  PHO: "PHO",
  POR: "POR",
  ROC: "SAC", CIN: "SAC", KCO: "SAC", KCK: "SAC", SAC: "SAC",
  SAS: "SAS",
  TOR: "TOR",
  NOJ: "UTA", UTA: "UTA",
  CHP: "WAS", CHZ: "WAS", BAL: "WAS", CAP: "WAS", WSB: "WAS", WAS: "WAS",
};

// Current full name for each present-day franchise abbreviation.
const CURRENT_NAME = {
  ATL: "Atlanta Hawks", BOS: "Boston Celtics", BRK: "Brooklyn Nets",
  CHO: "Charlotte Hornets", CHI: "Chicago Bulls", CLE: "Cleveland Cavaliers",
  DAL: "Dallas Mavericks", DEN: "Denver Nuggets", DET: "Detroit Pistons",
  GSW: "Golden State Warriors", HOU: "Houston Rockets", IND: "Indiana Pacers",
  LAC: "Los Angeles Clippers", LAL: "Los Angeles Lakers", MEM: "Memphis Grizzlies",
  MIA: "Miami Heat", MIL: "Milwaukee Bucks", MIN: "Minnesota Timberwolves",
  NOP: "New Orleans Pelicans", NYK: "New York Knicks", OKC: "Oklahoma City Thunder",
  ORL: "Orlando Magic", PHI: "Philadelphia 76ers", PHO: "Phoenix Suns",
  POR: "Portland Trail Blazers", SAC: "Sacramento Kings", SAS: "San Antonio Spurs",
  TOR: "Toronto Raptors", UTA: "Utah Jazz", WAS: "Washington Wizards",
};

// --- tiny CSV parser (handles quoted fields with commas) -------------------
function parseCSV(file) {
  const text = readFileSync(join(MANUAL, file), "utf8");
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else if (c === '"') inQuotes = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const header = rows.shift();
  return rows
    .filter((r) => r.length === header.length)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i]])));
}

const num = (v) => Number(v) || 0;
const round1 = (n) => Math.round(n * 10) / 10;
const round2 = (n) => Math.round(n * 100) / 100;
const cleanName = (n) => (n || "").replace(/\*+$/, "").trim();

console.log("Reading CSVs…");
const perGame = parseCSV("Player Per Game.csv").filter((r) => LEAGUES.has(r.lg));
const teamAbbrev = parseCSV("Team Abbrev.csv");
const careerInfo = parseCSV("Player Career Info.csv");
const allStarRows = parseCSV("All-Star Selections.csv").filter((r) => LEAGUES.has(r.lg));
const eosTeams = parseCSV("End of Season Teams.csv");
const awardRows = parseCSV("Player Award Shares.csv");
const draftRows = parseCSV("Draft Pick History.csv").filter((r) => LEAGUES.has(r.lg));

// player_id -> canonical name + HOF flag (career-wide person info).
const info = {};
for (const r of careerInfo) {
  info[r.player_id] = { name: cleanName(r.player), hof: r.hof === "TRUE" };
}

// abbreviation + season -> full (historical) team name.
const teamName = {};
for (const r of teamAbbrev) teamName[`${r.abbreviation}|${r.season}`] = r.team;

// --- per-stint aggregation (team + decade granular) ------------------------
const byPlayerSeason = new Map();
for (const r of perGame) {
  const key = `${r.player_id}|${r.season}`;
  if (!byPlayerSeason.has(key)) byPlayerSeason.set(key, []);
  byPlayerSeason.get(key).push(r);
}

const stints = new Map(); // "id|FR|decade" -> { g, ptsW, allStars, allNBA, awardShare }
const membership = new Map(); // "FR|decade" -> Set(id)
const nameVotes = new Map(); // "FR|decade" -> { histName: count }
const seasonPrimary = new Map(); // "id|season" -> stint key of the player's main team that season

function stintFor(id, fr, decade) {
  const k = `${id}|${fr}|${decade}`;
  let s = stints.get(k);
  if (!s) {
    s = { g: 0, ptsW: 0, allStars: 0, allNBA: 0, awardShare: 0 };
    stints.set(k, s);
  }
  return s;
}

for (const [, rows] of byPlayerSeason) {
  const id = rows[0].player_id;
  const season = Number(rows[0].season);
  const decade = Math.floor((season - 1) / 10) * 10;

  let best = null; // the player's primary team this season, by games played
  for (const r of rows) {
    if (MULTI_TEAM.test(r.team)) continue; // skip combined traded-season rows
    const fr = FRANCHISE[r.team];
    if (!fr) continue; // defunct franchise with no team today -> excluded
    const g = num(r.g);

    const s = stintFor(id, fr, decade);
    s.g += g;
    s.ptsW += num(r.pts_per_game) * g;

    const mkey = `${fr}|${decade}`;
    if (!membership.has(mkey)) membership.set(mkey, new Set());
    membership.get(mkey).add(id);
    const histName = teamName[`${r.team}|${r.season}`] || r.team;
    if (!nameVotes.has(mkey)) nameVotes.set(mkey, {});
    const votes = nameVotes.get(mkey);
    votes[histName] = (votes[histName] || 0) + 1;

    if (!best || g > best.g) best = { fr, decade, g };
  }
  if (best) seasonPrimary.set(`${id}|${season}`, `${id}|${best.fr}|${best.decade}`);
}

// Attribute league honors to the team a player was on that season. All-Star,
// All-NBA and MVP/DPOY voting carry no usable team column (the All-Star "team"
// is the exhibition roster), so we join through the season's primary team.
function award(id, season, field, amt) {
  const k = seasonPrimary.get(`${id}|${season}`);
  if (!k) return;
  const s = stints.get(k);
  if (s) s[field] += amt;
}
for (const r of allStarRows) award(r.player_id, Number(r.season), "allStars", 1);
for (const r of eosTeams)
  if (r.type === "All-NBA") award(r.player_id, Number(r.season), "allNBA", 1);
for (const r of awardRows)
  if (r.award === "nba mvp" || r.award === "nba dpoy")
    award(r.player_id, Number(r.season), "awardShare", num(r.share));

// Draft pedigree is credited to the franchise that DRAFTED the player (a high
// pick is a famous bust *for that team*); other stints don't inherit it.
const draftByFr = {}; // "id|FR" -> best (lowest) overall pick
for (const r of draftRows) {
  const pick = num(r.overall_pick);
  if (!pick) continue;
  const fr = FRANCHISE[r.tm];
  if (!fr) continue;
  const k = `${r.player_id}|${fr}`;
  if (!(k in draftByFr) || pick < draftByFr[k]) draftByFr[k] = pick;
}

// --- person-level info (career-wide: name + HOF) ---------------------------
const playerOut = {};
for (const k of stints.keys()) {
  const id = k.split("|")[0];
  if (!playerOut[id]) {
    playerOut[id] = { name: info[id]?.name || id, hof: info[id]?.hof || false };
  }
}

// --- build prompts with per-stint rosters ----------------------------------
const prompts = [];
for (const [mkey, ids] of membership) {
  if (ids.size < MIN_ROSTER) continue;
  const [fr, decadeNum] = mkey.split("|");
  const decade = `${decadeNum}s`;
  const votes = nameVotes.get(mkey);
  const histName = Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0];
  const currentName = CURRENT_NAME[fr];
  // Show the era's name, with today's franchise in parens when it has moved.
  const label =
    histName === currentName
      ? `${decade} ${histName}`
      : `${decade} ${histName} (now ${currentName})`;

  const roster = [...ids].map((id) => {
    const s = stints.get(`${id}|${fr}|${decadeNum}`);
    return {
      id,
      games: s.g,
      ppg: s.g ? round1(s.ptsW / s.g) : 0,
      allStars: s.allStars,
      allNBA: s.allNBA,
      awardShare: round2(s.awardShare),
      draftPick: draftByFr[`${id}|${fr}`] ?? null,
    };
  });

  prompts.push({
    id: `${fr.toLowerCase()}-${decadeNum}s`,
    team: histName,
    decade,
    label,
    roster,
  });
}
prompts.sort((a, b) => a.label.localeCompare(b.label));

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(
  join(OUT_DIR, "dataset.json"),
  JSON.stringify({
    generatedAt: new Date().toISOString(),
    source: "basketball-reference (manual)",
    players: playerOut,
    prompts,
  }),
);

const used = new Set(prompts.flatMap((p) => p.roster.map((r) => r.id))).size;
const stintCount = prompts.reduce((n, p) => n + p.roster.length, 0);
console.log(
  `Built dataset from BBRef: ${prompts.length} prompts, ` +
    `${Object.keys(playerOut).length} players (${used} in prompts), ` +
    `${stintCount} stints.`,
);
console.log(
  `Accolades attributed per stint. HOF players: ${
    Object.values(playerOut).filter((p) => p.hof).length
  }.`,
);
