# Data pipeline

The website reads only pre-built local JSON — it never calls an external API at
runtime, so there are no rate limits and no latency for players. All network
work happens here, offline, and is meant to be re-run only when you feel like
refreshing (a few times a season is plenty).

## Primary path: manual Basketball-Reference import (best quality)

Basketball-Reference has the most complete data — full history plus accolades
(All-Star, All-NBA, awards, HOF) — but blocks automated requests. So a human
downloads it once and the importer does the rest. See `data/manual/README.md`
for how to get the CSVs.

```bash
# 1. Drop BBRef CSVs into data/manual/  (see data/manual/README.md)
npm run data:import    # build src/data/generated/dataset.json from them (offline, instant)
npm run data:fame      # fetch Wikipedia pageviews -> src/data/generated/pageviews.json
```

Or both at once (the refresh ritual):

```bash
npm run refresh
```

The score uses accolades, so it works well **even before** `data:fame` finishes —
pageviews just refine the long tail of obscure players.

## Fallback path: fully automated NBA API (no manual download)

If you don't want to download anything, this pulls rosters + stats from
`stats.nba.com` (1 request/season, reliable from 1996-97 on) — but it has **no
accolades**, so the score is weaker.

```bash
npm run refresh:auto   # data:seasons -> data:build -> data:fame
```

## Sources

| Data | Source | Notes |
|---|---|---|
| Rosters, career stats, accolades | Basketball-Reference (manual download) | Full history; All-Star/All-NBA/awards/HOF. Joined on `player_id`. |
| Rosters + stats (fallback) | `stats.nba.com` (`leaguedashplayerstats`) | Automated; no accolades; 1996-97 onward. |
| Fame signal | Wikimedia Pageviews API | 12-month avg monthly views per player. Free, unlimited. |

## What's cheap vs. expensive

- **Seasons**: historical seasons never change, so `data:seasons` only fetches
  missing seasons and re-fetches the two most recent. ~30 requests, ~1 min.
- **Build**: pure local computation, instant.
- **Fame**: the real recurring cost — ~2 requests per player. It's **resumable
  and cached**: a monthly run only refreshes entries older than 25 days and adds
  new players, saving progress every 25 players. First full run ≈ 15-25 min.

After refreshing, rebuild/redeploy the app (or restart `next dev`) so the new
JSON is picked up.

## Generated files (committed, the app depends on them)

- `src/data/generated/dataset.json` — players + team/decade prompts
- `src/data/generated/pageviews.json` — fame signal

`data/raw/` is a local cache and does not need to be committed.
