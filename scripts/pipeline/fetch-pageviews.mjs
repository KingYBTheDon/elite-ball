// Step 3 of the pipeline: the fame signal (popularity TODAY), which is what
// separates a forgotten legend from a current superstar. For every player used
// in a prompt, resolve their Wikipedia article ACCURATELY and fetch ~12-month
// average monthly pageviews.
//
// Resolver: try the exact name, then "<name> (basketball)", then a search — and
// in every case VALIDATE via the page summary that the article is really a
// basketball player (rejects disambiguation pages and wrong-person matches like
// "Bob Harris" -> the GM "Bob Myers"). Resumable + cached.
// Output: src/data/generated/pageviews.json. Run:
//   node scripts/pipeline/fetch-pageviews.mjs

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const GEN = join(ROOT, "src", "data", "generated");
const DATASET = join(GEN, "dataset.json");
const OUT = join(GEN, "pageviews.json");

const UA = "EliteBallKnowledge/0.1 (contact@example.com)";
const STALE_DAYS = 25;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const yyyymmdd = (d) => d.toISOString().slice(0, 10).replace(/-/g, "") + "00";

// Fetch JSON, backing off politely on 429 (rate limit). Wikipedia throttles
// anonymous bursts hard, so we honor Retry-After and exponentially back off.
async function getJSON(url, attempt = 1) {
  try {
    const res = await fetch(url, { headers: { "User-Agent": UA } });
    if (res.status === 429 && attempt <= 6) {
      const retryAfter = Number(res.headers.get("retry-after"));
      const wait = retryAfter ? retryAfter * 1000 : Math.min(2000 * 2 ** attempt, 60000);
      await sleep(wait);
      return getJSON(url, attempt + 1);
    }
    if (!res.ok) return null;
    return await res.json();
  } catch {
    if (attempt <= 4) {
      await sleep(1000 * attempt);
      return getJSON(url, attempt + 1);
    }
    return null;
  }
}

/** Does this Wikipedia page summary describe a basketball player? */
function isBasketball(summary) {
  if (!summary || summary.type === "disambiguation") return false;
  const text = `${summary.description || ""} ${summary.extract || ""}`.toLowerCase();
  return text.includes("basketball") || /\bnba\b/.test(text);
}

async function summary(title) {
  const t = encodeURIComponent(title.replace(/ /g, "_"));
  return getJSON(`https://en.wikipedia.org/api/rest_v1/page/summary/${t}`);
}

/** Accurately resolve a player name to their Wikipedia article title (or null). */
export async function resolveTitle(name) {
  // 1) exact name, 2) explicit basketball disambiguation
  for (const cand of [name, `${name} (basketball)`]) {
    const s = await summary(cand);
    if (isBasketball(s) && s.title) return s.title;
    await sleep(80);
  }
  // 3) search, validating each candidate is actually a hooper
  const q = encodeURIComponent(`${name} basketball`);
  const data = await getJSON(
    `https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=3&srsearch=${q}`,
  );
  for (const hit of data?.query?.search ?? []) {
    const s = await summary(hit.title);
    if (isBasketball(s) && s.title) return s.title;
    await sleep(80);
  }
  return null;
}

/** Average monthly pageviews over the last 12 months. */
export async function pageviews(title) {
  const end = new Date();
  const start = new Date();
  start.setMonth(start.getMonth() - 12);
  const article = encodeURIComponent(title.replace(/ /g, "_"));
  const data = await getJSON(
    `https://wikimedia.org/api/rest_v1/metrics/pageviews/per-article/` +
      `en.wikipedia/all-access/user/${article}/monthly/` +
      `${yyyymmdd(start)}/${yyyymmdd(end)}`,
  );
  const items = data?.items ?? [];
  if (!items.length) return 0;
  return Math.round(items.reduce((s, i) => s + i.views, 0) / items.length);
}

function isFresh(entry) {
  if (!entry?.fetchedAt) return false;
  return (Date.now() - new Date(entry.fetchedAt)) / 86400000 < STALE_DAYS;
}

async function main() {
  if (!existsSync(DATASET)) throw new Error("Run import-manual.mjs first.");
  const dataset = JSON.parse(readFileSync(DATASET, "utf8"));
  const usedIds = new Set(dataset.prompts.flatMap((p) => p.playerIds));
  const cache = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};

  const todo = [...usedIds].filter((id) => !isFresh(cache[id]));
  console.log(`${usedIds.size} players in prompts, ${todo.length} need fetching.`);

  let done = 0, resolved = 0;
  for (const id of todo) {
    const player = dataset.players[id];
    const title = cache[id]?.title ?? (await resolveTitle(player.name));
    const pv = title ? await pageviews(title) : 0;
    if (title) resolved++;
    cache[id] = { id, name: player.name, title, pv, fetchedAt: new Date().toISOString() };
    if (++done % 25 === 0) {
      writeFileSync(OUT, JSON.stringify(cache));
      console.log(`  …${done}/${todo.length} (${resolved} resolved)`);
    }
    await sleep(80);
  }

  writeFileSync(OUT, JSON.stringify(cache));
  console.log(`Done. ${Object.keys(cache).length} cached, ${resolved}/${todo.length} resolved this run.`);
}

// Allow importing the resolver without running the full job.
import { pathToFileURL } from "node:url";
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
