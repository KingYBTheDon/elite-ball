// End-to-end test of the live WebSocket duel server: two real clients connect,
// queue, get matched, play a full best-of-3 and reach match_over. Proves the
// network + matchmaking + manager + dataset wiring (round rules themselves are
// covered by duel-smoke.mts). Run with the server up:
//
//   npm run duel:server        # terminal 1
//   node scripts/duel-ws-smoke.mts
//
// Both clients submit junk, so every round is a tie and the match ends a draw —
// that's fine here; we're checking the message flow, not scoring.

import { WebSocket } from "ws";

const URL = process.env.DUEL_URL ?? "ws://localhost:8787";

interface Seen {
  matched: boolean;
  roundStarts: string[]; // labels
  roundResults: number;
  reveals: number; // rounds where both picks were present
  matchOver: boolean;
  winnerId: string | null | undefined;
}

function play(name: string): Promise<Seen> {
  return new Promise((resolve, reject) => {
    const seen: Seen = {
      matched: false,
      roundStarts: [],
      roundResults: 0,
      reveals: 0,
      matchOver: false,
      winnerId: undefined,
    };
    const ws = new WebSocket(URL);
    const fail = setTimeout(() => reject(new Error(`${name}: timed out`)), 30_000);

    ws.on("open", () => ws.send(JSON.stringify({ t: "queue", mode: "modern", bestOf: 3, name })));
    ws.on("message", (data) => {
      const msg = JSON.parse(String(data));
      switch (msg.t) {
        case "matched":
          seen.matched = true;
          break;
        case "round_start":
          seen.roundStarts.push(msg.round.label);
          ws.send(JSON.stringify({ t: "submit", guess: "definitely not a real player" }));
          break;
        case "round_result":
          seen.roundResults++;
          if (msg.result.picks.length === 2) seen.reveals++;
          break;
        case "match_over":
          seen.matchOver = true;
          seen.winnerId = msg.winnerId;
          clearTimeout(fail);
          ws.close();
          resolve(seen);
          break;
      }
    });
    ws.on("error", (e) => {
      clearTimeout(fail);
      reject(e);
    });
  });
}

let failures = 0;
const check = (label: string, cond: boolean) => {
  console.log(`${cond ? "  ✓" : "  ✗"} ${label}`);
  if (!cond) failures++;
};

const [a, b] = await Promise.all([play("Ann"), play("Bo")]);

console.log("two clients, full best-of-3 over WebSocket");
check("both clients matched", a.matched && b.matched);
check("both saw real prompt labels", a.roundStarts.length >= 1 && a.roundStarts.every((l) => typeof l === "string" && l.length > 3));
check("played 3 rounds (best-of-3 cap)", a.roundStarts.length === 3 && a.roundResults === 3);
check("each round revealed both picks", a.reveals === 3);
check("both reached match_over", a.matchOver && b.matchOver);
check("agreed outcome (draw via mutual whiffs)", a.winnerId === null && b.winnerId === null);

console.log(`\nsample matchup: "${a.roundStarts[0]}"`);
console.log(failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`);
process.exitCode = failures === 0 ? 0 : 1;
