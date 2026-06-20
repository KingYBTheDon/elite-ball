// Domain model + wire protocol for the 1v1 "duel" mode (Omegle-style: two
// strangers are matched, both get the SAME team+decade each round, and the more
// obscure valid pick wins the round; first to a majority wins the match).
//
// These types are shared by client and server. The game engine (engine.ts) is
// pure and operates on this state; the manager (manager.ts) wires it to data,
// matchmaking and a realtime transport.

import type { ModeKey } from "../modes";

export type DuelId = string;
export type PlayerId = string;

export interface DuelConfig {
  mode: ModeKey;
  /** Total rounds at most; first to majority wins. 3, 5 or 7. */
  bestOf: number;
  /** Per-round time limit in ms. */
  roundMs: number;
}

export const DEFAULT_DUEL_CONFIG: Omit<DuelConfig, "mode"> = {
  bestOf: 5,
  roundMs: 20_000,
};

export type DuelPhase =
  | "waiting" // not enough players / between matches
  | "countdown" // brief pre-round countdown
  | "round" // accepting guesses
  | "round_result" // showing who won the round
  | "finished"; // match over

export interface DuelPlayerState {
  id: PlayerId;
  /** Display handle the player chose. */
  name: string;
  /** Rounds won so far. */
  wins: number;
  connected: boolean;
}

/** One player's pick in a round (server-side; the opponent's stays hidden until reveal). */
export interface RoundSubmission {
  playerId: PlayerId;
  /** Raw text the player submitted. */
  guess: string;
  /** Whether it resolved to a roster player. */
  matched: boolean;
  /** Resolved player name (when matched). */
  player?: string;
  /** Obscurity score, 0 when not matched. */
  obscurity: number;
  /** When it arrived (ms) — used to break exact ties by speed. */
  at: number;
}

export interface DuelRoundState {
  index: number; // 0-based
  promptId: string;
  /** Matchup label shown to both players, e.g. "1990s Seattle SuperSonics (now …)". */
  label: string;
  rosterSize: number;
  startedAt: number;
  deadline: number;
  /** Submissions keyed by player id (at most one per player). */
  submissions: Record<PlayerId, RoundSubmission>;
  /** Set once resolved: winner id, or null for a tie. */
  winnerId?: PlayerId | null;
}

export interface DuelState {
  id: DuelId;
  config: DuelConfig;
  phase: DuelPhase;
  /** Exactly two once matched. */
  players: DuelPlayerState[];
  round?: DuelRoundState;
  /** Rounds fully resolved so far. */
  roundsPlayed: number;
  /** Set when phase === "finished": winner id, or null for a drawn match. */
  winnerId?: PlayerId | null;
}

// --- public projections (what each client is allowed to see) ----------------

export interface PublicPlayer {
  id: PlayerId;
  name: string;
  wins: number;
  connected: boolean;
}

export interface PublicRound {
  index: number;
  label: string;
  rosterSize: number;
  deadline: number;
  /** Who has locked in a pick (not WHAT they picked) — for the "opponent ready" dot. */
  submitted: PlayerId[];
}

/** A revealed pick, shown to both players after the round resolves. */
export interface RevealedPick {
  playerId: PlayerId;
  player?: string; // resolved name, omitted if they whiffed
  guess: string;
  obscurity: number;
  matched: boolean;
}

export interface PublicRoundResult {
  index: number;
  label: string;
  picks: RevealedPick[];
  winnerId: PlayerId | null;
  players: PublicPlayer[]; // updated win counts
}

export interface PublicDuel {
  id: DuelId;
  config: DuelConfig;
  phase: DuelPhase;
  players: PublicPlayer[];
  round?: PublicRound;
  roundsPlayed: number;
  winnerId?: PlayerId | null;
}

// --- messages ---------------------------------------------------------------

export type ClientMessage =
  | { t: "queue"; mode: ModeKey; bestOf: number; name: string }
  | { t: "cancel_queue" }
  | { t: "submit"; guess: string }
  | { t: "ready_next" }
  | { t: "leave" };

export type ServerMessage =
  | { t: "queued" }
  | { t: "matched"; you: PlayerId; duel: PublicDuel }
  | { t: "round_start"; round: PublicRound }
  | { t: "opponent_submitted" }
  | { t: "round_result"; result: PublicRoundResult }
  | { t: "match_over"; winnerId: PlayerId | null; duel: PublicDuel }
  | { t: "opponent_left" }
  | { t: "error"; message: string };
