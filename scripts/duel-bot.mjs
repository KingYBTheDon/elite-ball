// A persistent sparring bot for manual/UI testing of the duel server. Connects,
// queues, and on each round locks in a pick after a short delay; re-queues when
// a match ends so a human at /duel always has an opponent.
//
//   node scripts/duel-bot.mjs [mode] [bestOf] [name]
//
// Picks are intentionally weak ("benchwarmer") so a human making real pulls can
// win — it's a sparring partner, not a challenge.

import { WebSocket } from "ws";

const URL = process.env.DUEL_URL ?? "ws://localhost:8787";
const mode = process.argv[2] ?? "modern";
const bestOf = Number(process.argv[3] ?? 3);
const name = process.argv[4] ?? "Sparring Bot";

const ws = new WebSocket(URL);
const queueUp = () => ws.send(JSON.stringify({ t: "queue", mode, bestOf, name }));

ws.on("open", () => {
  console.log(`[bot] connected, queueing ${mode}/${bestOf} as "${name}"`);
  queueUp();
});

ws.on("message", (data) => {
  const msg = JSON.parse(String(data));
  switch (msg.t) {
    case "matched":
      console.log("[bot] matched");
      break;
    case "round_start":
      // lock in a deliberately weak guess after a beat
      setTimeout(() => ws.send(JSON.stringify({ t: "submit", guess: "deep bench guy" })), 600);
      break;
    case "match_over":
      console.log("[bot] match over, re-queueing");
      setTimeout(queueUp, 500);
      break;
    case "opponent_left":
      console.log("[bot] opponent left, re-queueing");
      setTimeout(queueUp, 500);
      break;
  }
});

ws.on("close", () => {
  console.log("[bot] disconnected");
  process.exit(0);
});
ws.on("error", (e) => console.error("[bot] error", e.message));
