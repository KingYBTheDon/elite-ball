// Smoke test for the duel ENGINE (pure rules) + matchmaking + transport.
// Run:  node scripts/duel-smoke.mts        (Node 22.6+ strips the TS types)
//
// The DuelManager is verified by `tsc`/`next build`; this exercises the
// deterministic game logic at runtime so the round rules can't silently rot.

import {
  bothSubmitted,
  concludeMatch,
  createDuel,
  isMatchOver,
  neededWins,
  resolveRound,
  startRound,
  submitGuess,
  toPublicRoundResult,
  type GradedGuess,
} from "../src/lib/duel/engine.ts";
import { Matchmaker } from "../src/lib/duel/matchmaking.ts";
import { InMemoryTransport } from "../src/lib/duel/transport.ts";

let failures = 0;
function check(label: string, cond: boolean) {
  console.log(`${cond ? "  ✓" : "  ✗"} ${label}`);
  if (!cond) failures++;
}

const cfg = { mode: "modern" as const, bestOf: 3, roundMs: 20_000 };
const prompt = { id: "chi-1990s", label: "1990s Chicago Bulls", rosterSize: 18 };
const hit = (player: string, obscurity: number): GradedGuess => ({ matched: true, player, obscurity });
const miss: GradedGuess = { matched: false, obscurity: 0 };

console.log("round resolution");
{
  let s = createDuel("d1", cfg, [{ id: "A", name: "Ann" }, { id: "B", name: "Bo" }]);
  s = startRound(s, prompt, 1000);
  s = submitGuess(s, "A", "Scrub Guy", hit("Scrub Guy", 80), 1100);
  s = submitGuess(s, "B", "Michael Jordan", hit("Michael Jordan", 8), 1200);
  check("both submitted detected", bothSubmitted(s));
  s = resolveRound(s, 1300);
  check("more obscure pick wins the round", s.round?.winnerId === "A");
  check("winner's score incremented", s.players.find((p) => p.id === "A")?.wins === 1);
  check("reveal exposes both picks", (toPublicRoundResult(s)?.picks.length ?? 0) === 2);
}

console.log("tie-breaks & whiffs");
{
  // equal obscurity -> earlier submission wins
  let s = createDuel("d2", cfg, [{ id: "A", name: "Ann" }, { id: "B", name: "Bo" }]);
  s = startRound(s, prompt, 0);
  s = submitGuess(s, "A", "X", hit("X", 50), 500);
  s = submitGuess(s, "B", "Y", hit("Y", 50), 400);
  s = resolveRound(s, 600);
  check("equal obscurity broken by speed", s.round?.winnerId === "B");

  // valid beats a whiff
  let s2 = createDuel("d3", cfg, [{ id: "A", name: "Ann" }, { id: "B", name: "Bo" }]);
  s2 = startRound(s2, prompt, 0);
  s2 = submitGuess(s2, "A", "real", hit("real", 12), 100);
  s2 = submitGuess(s2, "B", "garbage", miss, 50);
  s2 = resolveRound(s2, 200);
  check("a valid pick beats a faster whiff", s2.round?.winnerId === "A");

  // both whiff -> tie, no point
  let s3 = createDuel("d4", cfg, [{ id: "A", name: "Ann" }, { id: "B", name: "Bo" }]);
  s3 = startRound(s3, prompt, 0);
  s3 = submitGuess(s3, "A", "junk", miss, 100);
  s3 = resolveRound(s3, 25_000); // B never answered -> whiff at deadline
  check("both whiff is a tie", s3.round?.winnerId === null);
  check("no point awarded on a tie", s3.players.every((p) => p.wins === 0));
}

console.log("best-of-3 match");
{
  let s = createDuel("m1", cfg, [{ id: "A", name: "Ann" }, { id: "B", name: "Bo" }]);
  check("needs 2 wins for best-of-3", neededWins(3) === 2);
  let t = 0;
  let rounds = 0;
  while (!isMatchOver(s) && rounds < 10) {
    s = startRound(s, prompt, t);
    s = submitGuess(s, "A", "obscure", hit("obscure", 90), t + 10); // A always deeper
    s = submitGuess(s, "B", "star", hit("star", 10), t + 20);
    s = resolveRound(s, t + 30);
    t += 1000;
    rounds++;
  }
  check("match ends after clinching", isMatchOver(s));
  s = concludeMatch(s);
  check("dominant player wins the match", s.winnerId === "A");
  check("final score is 2-0", s.players.find((p) => p.id === "A")?.wins === 2);
  check("match stopped at 2 rounds (no dead rubber)", s.roundsPlayed === 2);
}

console.log("matchmaking + transport");
{
  const mm = new Matchmaker();
  const p1 = mm.enqueue({ playerId: "A", name: "Ann", mode: "modern", bestOf: 5, since: 0 });
  check("first player waits", p1 === null && mm.size() === 1);
  const p2 = mm.enqueue({ playerId: "B", name: "Bo", mode: "modern", bestOf: 5, since: 1 });
  check("second compatible player gets paired", !!p2 && p2.a.playerId === "A" && p2.b.playerId === "B");
  check("queue emptied after pairing", mm.size() === 0);
  const solo = mm.enqueue({ playerId: "C", name: "Cy", mode: "modern", bestOf: 7, since: 2 });
  check("different bracket does not pair", solo === null);

  const tx = new InMemoryTransport();
  tx.send("A", { t: "queued" });
  tx.broadcast(["A", "B"], { t: "opponent_left" });
  check("transport records per-player messages", tx.messagesFor("A").length === 2);
  check("transport lastOfType works", tx.lastOfType("B", "opponent_left")?.t === "opponent_left");
}

console.log(failures === 0 ? "\nALL PASS" : `\n${failures} FAILURE(S)`);
process.exitCode = failures === 0 ? 0 : 1;
