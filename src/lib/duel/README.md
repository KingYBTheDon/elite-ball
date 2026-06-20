# Duel mode (1v1 multiplayer) — foundation

Omegle-style: two strangers are matched, both get the **same** team+decade each
round, and the **more obscure valid pick wins** the round. First to a majority of
`bestOf` (3/5/7) wins the match.

This folder is the **backend foundation only** — pure logic + a clean seam for a
realtime provider. Nothing here is wired into a page or deployed yet.

## What's here

| File | Role | Pure? |
|---|---|---|
| `types.ts` | Domain model + client/server wire protocol | types only |
| `engine.ts` | Round/match state machine + round-resolution rules + public projections | ✅ pure, no I/O |
| `matchmaking.ts` | FIFO queue, pairs players by `(mode, bestOf)` | ✅ in-memory |
| `transport.ts` | `DuelTransport` interface + `InMemoryTransport` for tests | — |
| `manager.ts` | Authoritative glue: routes `ClientMessage`s, drives rounds/timers, emits `ServerMessage`s. All externals injected. | impure but dependency-injected |

`../grade.ts` is the shared "is this a valid pull and how obscure" function, used
by both `/api/guess` (single-player) and the duel manager, so scoring is identical.

Runtime test: `npm run test:duel` (exercises the engine, matchmaking, transport).

## Design rules baked into the engine

- More obscure **valid** pick wins the round; a valid pick always beats a whiff.
- Equal obscurity → **faster** submission wins. Both whiff → tie (no point).
- Win at `floor(bestOf/2)+1`; hitting the round cap without a majority → higher
  win count takes it (equal = drawn match). *(Sudden-death is a future option.)*
- The opponent's pick is **never** sent until the round resolves (`toPublicRound`
  only exposes *who* has locked in, not *what*) — no copying.

## What's deliberately NOT decided yet: the realtime transport

Vercel serverless functions can't hold a WebSocket open, and they're stateless,
so the in-memory `Matchmaker`/`DuelManager` can't be the production deployment
as-is. Two viable paths (pick at deploy time — the `DuelTransport` seam means the
engine/manager don't change):

1. **Hosted pub/sub (recommended): Pusher or Ably + Upstash Redis.**
   - Browser subscribes to a per-player (or per-duel) channel.
   - `ClientMessage`s come in via a normal `/api/duel` route handler.
   - That handler loads/saves duel state in **Upstash Redis** (so it survives
     across stateless invocations) and publishes `ServerMessage`s via the
     provider's REST API. Implement a `PusherTransport implements DuelTransport`.
   - Round timers: serverless can't `setTimeout` reliably across invocations —
     use a per-round `deadline` (already in state) plus either Upstash QStash /
     Vercel Cron to fire `finishRound`, or resolve lazily when the next request
     arrives after `deadline`.

2. **Standalone WebSocket server** (Node `ws`/Socket.IO on Render/Railway/Fly).
   - Keeps the current in-memory `Matchmaker`/`DuelManager` almost verbatim
     (one process = shared state, real `setTimeout` works).
   - Frontend opens a WS to that host; wrap the socket as a `DuelTransport`.
   - Simplest to reason about; adds a second deploy target.

## TODO to ship

- [ ] Choose transport (option 1 or 2 above) and write the `DuelTransport` adapter.
- [ ] State store + matchmaking for the chosen transport (Redis if serverless).
- [ ] Deadline enforcement (cron/QStash, lazy-on-request, or in-process timer).
- [ ] `/api/duel` route (or WS server) that feeds `ClientMessage`s to a manager.
- [ ] Client: `/duel` page — handle entry, queue/“finding opponent”, live round
      UI (shared prompt, your input with the existing autocomplete, opponent-
      ready dot, countdown), reveal screen, match summary. Reuse `Game`/`ScoreBar`.
- [ ] Reconnect/forfeit grace window (currently a disconnect = immediate leave).
- [ ] Anti-abuse: rate-limit submits, validate handles, ignore stale duel ids.
