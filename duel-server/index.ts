// Standalone WebSocket server for duel (1v1) mode. Run with:  npm run duel:server
//
// This is the authoritative realtime backend. It wraps the pure DuelManager
// (src/lib/duel) with real dependencies — live prompts + the shared guess
// grader + wall-clock timers — and exposes it over WebSocket. One process =
// shared in-memory state, so matchmaking and round timers Just Work. Deploy it
// on any always-on Node host (Render/Railway/Fly); the browser connects via
// NEXT_PUBLIC_DUEL_WS_URL.

import { WebSocketServer, WebSocket } from "ws";
import { randomUUID } from "node:crypto";
import { DuelManager } from "@/lib/duel/manager";
import type { DuelTransport } from "@/lib/duel/transport";
import type { ClientMessage, PlayerId, ServerMessage } from "@/lib/duel/types";
import { randomPrompt, getPrompt } from "@/lib/dataset";
import { gradeGuess } from "@/lib/grade";

const PORT = Number(process.env.DUEL_PORT ?? 8787);

// playerId -> live socket
const sockets = new Map<PlayerId, WebSocket>();

function send(playerId: PlayerId, msg: ServerMessage): void {
  const ws = sockets.get(playerId);
  if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
}

const transport: DuelTransport = {
  send,
  broadcast(ids, msg) {
    for (const id of ids) send(id, msg);
  },
};

const manager = new DuelManager({
  transport,
  now: () => Date.now(),
  randomId: () => randomUUID(),
  nextPrompt: (mode) => {
    // DUEL_FIXED_PROMPT pins every round to one matchup — handy for testing.
    const fixed = process.env.DUEL_FIXED_PROMPT;
    const p = (fixed && getPrompt(fixed)) || randomPrompt(mode);
    return { id: p.id, label: p.label, rosterSize: p.roster.length };
  },
  grade: (promptId, guess) => {
    const prompt = getPrompt(promptId);
    if (!prompt) return { matched: false, obscurity: 0 };
    const g = gradeGuess(prompt, guess);
    return { matched: g.matched, player: g.player?.name, obscurity: g.breakdown?.total ?? 0 };
  },
  schedule: (ms, cb) => {
    const t = setTimeout(cb, ms);
    return () => clearTimeout(t);
  },
});

const wss = new WebSocketServer({ port: PORT });
console.log(`[duel] WebSocket server listening on :${PORT}`);

wss.on("connection", (ws) => {
  const playerId = randomUUID();
  sockets.set(playerId, ws);

  ws.on("message", (data) => {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(String(data));
    } catch {
      return; // ignore non-JSON
    }
    if (!msg || typeof (msg as { t?: unknown }).t !== "string") return;
    try {
      manager.handle(playerId, msg);
    } catch (err) {
      console.error("[duel] handler error:", err);
      send(playerId, { t: "error", message: "Server error." });
    }
  });

  ws.on("close", () => {
    sockets.delete(playerId);
    manager.disconnect(playerId);
  });
  ws.on("error", () => {
    /* close handler does cleanup */
  });
});

const shutdown = () => {
  console.log("[duel] shutting down");
  wss.close();
  process.exit(0);
};
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
