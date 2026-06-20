// Duel session manager: the authoritative server-side glue. It owns live duel
// state, routes ClientMessages, and emits ServerMessages through a transport.
//
// Everything external is injected (clock, id generator, prompt source, guess
// grader, timer scheduler) so this file has NO hard dependency on the dataset,
// the realtime provider, or wall-clock time — which makes it unit-testable with
// fakes (see scripts/duel-smoke.mts) and portable across hosting choices.

import type { ModeKey } from "../modes";
import type { ClientMessage, DuelState, PlayerId } from "./types";
import { DEFAULT_DUEL_CONFIG } from "./types";
import type { DuelTransport } from "./transport";
import { Matchmaker } from "./matchmaking";
import {
  bothSubmitted,
  concludeMatch,
  createDuel,
  type GradedGuess,
  isMatchOver,
  resolveRound,
  setConnected,
  startRound,
  submitGuess,
  toPublicDuel,
  toPublicRound,
  toPublicRoundResult,
} from "./engine";

export interface PromptLite {
  id: string;
  label: string;
  rosterSize: number;
}

export interface ManagerDeps {
  transport: DuelTransport;
  now: () => number;
  randomId: () => string;
  /** A fresh random matchup for a mode (server-side; usually backed by dataset). */
  nextPrompt: (mode: ModeKey) => PromptLite;
  /** Grade a guess against a prompt's roster. */
  grade: (promptId: string, guess: string) => GradedGuess;
  /** Run `cb` after `ms`; returns a cancel function. Injected for testability. */
  schedule: (ms: number, cb: () => void) => () => void;
  /** How long to linger on the round-result reveal before the next round. */
  resultMs?: number;
  matchmaker?: Matchmaker;
}

const VALID_BEST_OF = new Set([3, 5, 7]);

export class DuelManager {
  private readonly deps: Required<Omit<ManagerDeps, "matchmaker">> & {
    matchmaker: Matchmaker;
  };
  private duels = new Map<string, DuelState>();
  private duelOf = new Map<PlayerId, string>();
  private timers = new Map<string, () => void>();

  constructor(deps: ManagerDeps) {
    this.deps = {
      resultMs: 4000,
      matchmaker: deps.matchmaker ?? new Matchmaker(),
      ...deps,
    };
  }

  /** Entry point for everything a client sends. */
  handle(playerId: PlayerId, msg: ClientMessage): void {
    switch (msg.t) {
      case "queue":
        return this.onQueue(playerId, msg.name, msg.mode, msg.bestOf);
      case "cancel_queue":
        return void this.deps.matchmaker.dequeue(playerId);
      case "submit":
        return this.onSubmit(playerId, msg.guess);
      case "ready_next":
        return; // rounds auto-advance for now; reserved for "skip the reveal"
      case "leave":
        return this.onLeave(playerId);
    }
  }

  /** A player's connection dropped. */
  disconnect(playerId: PlayerId): void {
    this.deps.matchmaker.dequeue(playerId);
    const duel = this.duelFor(playerId);
    if (!duel) return;
    this.duels.set(duel.id, setConnected(duel, playerId, false));
    // Treat a disconnect as leaving the match.
    this.onLeave(playerId);
  }

  // --- handlers -------------------------------------------------------------

  private onQueue(playerId: PlayerId, name: string, mode: ModeKey, bestOf: number): void {
    const safeBestOf = VALID_BEST_OF.has(bestOf) ? bestOf : DEFAULT_DUEL_CONFIG.bestOf;
    const handle = (name || "Player").slice(0, 24);

    const pairing = this.deps.matchmaker.enqueue({
      playerId,
      name: handle,
      mode,
      bestOf: safeBestOf,
      since: this.deps.now(),
    });

    if (!pairing) {
      this.deps.transport.send(playerId, { t: "queued" });
      return;
    }

    const id = this.deps.randomId();
    let duel = createDuel(
      id,
      { mode, bestOf: safeBestOf, roundMs: DEFAULT_DUEL_CONFIG.roundMs },
      [
        { id: pairing.a.playerId, name: pairing.a.name },
        { id: pairing.b.playerId, name: pairing.b.name },
      ],
    );
    this.duels.set(id, duel);
    for (const p of duel.players) this.duelOf.set(p.id, id);

    for (const p of duel.players) {
      this.deps.transport.send(p.id, {
        t: "matched",
        you: p.id,
        duel: toPublicDuel(duel),
      });
    }

    duel = this.beginRound(duel);
  }

  private onSubmit(playerId: PlayerId, guess: string): void {
    const duel = this.duelFor(playerId);
    if (!duel || duel.phase !== "round" || !duel.round) return;

    const graded = this.deps.grade(duel.round.promptId, guess);
    const next = submitGuess(duel, playerId, guess, graded, this.deps.now());
    this.duels.set(duel.id, next);

    // Nudge the opponent that a pick has landed (without revealing it).
    const opponent = this.opponentOf(next, playerId);
    if (opponent) this.deps.transport.send(opponent, { t: "opponent_submitted" });

    if (bothSubmitted(next)) this.finishRound(next.id);
  }

  private onLeave(playerId: PlayerId): void {
    const duel = this.duelFor(playerId);
    if (!duel) return;
    this.clearTimer(duel.id);
    const opponent = this.opponentOf(duel, playerId);
    if (opponent) this.deps.transport.send(opponent, { t: "opponent_left" });
    this.cleanup(duel.id);
  }

  // --- round flow -----------------------------------------------------------

  private beginRound(duel: DuelState): DuelState {
    const prompt = this.deps.nextPrompt(duel.config.mode);
    const next = startRound(duel, prompt, this.deps.now());
    this.duels.set(next.id, next);

    this.deps.transport.broadcast(this.playerIds(next), {
      t: "round_start",
      round: toPublicRound(next)!,
    });

    // Auto-resolve when the clock runs out.
    this.setTimer(next.id, next.config.roundMs, () => this.finishRound(next.id));
    return next;
  }

  private finishRound(duelId: string): void {
    const duel = this.duels.get(duelId);
    if (!duel || !duel.round || duel.round.winnerId !== undefined) return;

    this.clearTimer(duelId);
    const resolved = resolveRound(duel, this.deps.now());
    this.duels.set(duelId, resolved);

    this.deps.transport.broadcast(this.playerIds(resolved), {
      t: "round_result",
      result: toPublicRoundResult(resolved)!,
    });

    if (isMatchOver(resolved)) {
      const done = concludeMatch(resolved);
      this.duels.set(duelId, done);
      this.deps.transport.broadcast(this.playerIds(done), {
        t: "match_over",
        winnerId: done.winnerId ?? null,
        duel: toPublicDuel(done),
      });
      this.cleanup(duelId);
      return;
    }

    // Linger on the reveal, then start the next round.
    this.setTimer(duelId, this.deps.resultMs, () => {
      const current = this.duels.get(duelId);
      if (current) this.beginRound(current);
    });
  }

  // --- bookkeeping ----------------------------------------------------------

  private duelFor(playerId: PlayerId): DuelState | undefined {
    const id = this.duelOf.get(playerId);
    return id ? this.duels.get(id) : undefined;
  }

  private playerIds(duel: DuelState): PlayerId[] {
    return duel.players.map((p) => p.id);
  }

  private opponentOf(duel: DuelState, playerId: PlayerId): PlayerId | undefined {
    return duel.players.find((p) => p.id !== playerId)?.id;
  }

  private setTimer(duelId: string, ms: number, cb: () => void): void {
    this.clearTimer(duelId);
    this.timers.set(duelId, this.deps.schedule(ms, cb));
  }

  private clearTimer(duelId: string): void {
    const cancel = this.timers.get(duelId);
    if (cancel) cancel();
    this.timers.delete(duelId);
  }

  private cleanup(duelId: string): void {
    this.clearTimer(duelId);
    const duel = this.duels.get(duelId);
    if (duel) for (const p of duel.players) this.duelOf.delete(p.id);
    this.duels.delete(duelId);
  }

  /** Active duel count — for diagnostics. */
  get activeDuels(): number {
    return this.duels.size;
  }
}
