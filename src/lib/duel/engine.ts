// Pure duel state machine. No I/O, no data access, no clock of its own — every
// function takes the current state (+ a timestamp where needed) and returns the
// next state. That keeps the rules deterministic and unit-testable, and lets the
// same logic run on the server (authoritative) or the client (optimistic).
//
// Round rule: the more obscure VALID pick wins the round. A valid pick always
// beats a whiff. Equal obscurity is broken by who locked in first; if BOTH
// whiff, the round is a tie (no point). First to a majority of `bestOf` wins;
// if the round cap is hit without a majority, the higher win count takes it
// (equal => drawn match).

import type {
  DuelConfig,
  DuelId,
  DuelState,
  PlayerId,
  PublicDuel,
  PublicPlayer,
  PublicRound,
  PublicRoundResult,
  RoundSubmission,
} from "./types";

/** Rounds needed to clinch the match. */
export function neededWins(bestOf: number): number {
  return Math.floor(bestOf / 2) + 1;
}

export function createDuel(
  id: DuelId,
  config: DuelConfig,
  seats: { id: PlayerId; name: string }[],
): DuelState {
  return {
    id,
    config,
    phase: "waiting",
    players: seats.map((s) => ({ id: s.id, name: s.name, wins: 0, connected: true })),
    roundsPlayed: 0,
  };
}

/** Open a new round on the given prompt. */
export function startRound(
  state: DuelState,
  prompt: { id: string; label: string; rosterSize: number },
  now: number,
): DuelState {
  return {
    ...state,
    phase: "round",
    round: {
      index: state.roundsPlayed,
      promptId: prompt.id,
      label: prompt.label,
      rosterSize: prompt.rosterSize,
      startedAt: now,
      deadline: now + state.config.roundMs,
      submissions: {},
    },
  };
}

export interface GradedGuess {
  matched: boolean;
  player?: string;
  obscurity: number;
}

/** Record a player's pick. Ignored if not in a round or they already locked in. */
export function submitGuess(
  state: DuelState,
  playerId: PlayerId,
  guess: string,
  graded: GradedGuess,
  now: number,
): DuelState {
  if (state.phase !== "round" || !state.round) return state;
  if (state.round.submissions[playerId]) return state;
  if (!state.players.some((p) => p.id === playerId)) return state;

  const sub: RoundSubmission = {
    playerId,
    guess,
    matched: graded.matched,
    player: graded.player,
    obscurity: graded.matched ? graded.obscurity : 0,
    at: now,
  };
  return {
    ...state,
    round: {
      ...state.round,
      submissions: { ...state.round.submissions, [playerId]: sub },
    },
  };
}

/** True once every player has locked a pick for the current round. */
export function bothSubmitted(state: DuelState): boolean {
  const r = state.round;
  return !!r && state.players.every((p) => r.submissions[p.id]);
}

function whiff(playerId: PlayerId, now: number): RoundSubmission {
  return { playerId, guess: "", matched: false, obscurity: 0, at: now };
}

/** Winner of a 2-player round, or null for a tie. */
function decideRound(a: RoundSubmission, b: RoundSubmission): PlayerId | null {
  if (a.obscurity === b.obscurity) {
    if (a.obscurity === 0) return null; // both whiffed
    return a.at <= b.at ? a.playerId : b.playerId; // tie broken by speed
  }
  return a.obscurity > b.obscurity ? a.playerId : b.playerId;
}

/**
 * Resolve the open round: fill any missing pick as a whiff, decide the winner,
 * award the point, and move to the round-result phase. Idempotent.
 */
export function resolveRound(state: DuelState, now: number): DuelState {
  const r = state.round;
  if (!r || r.winnerId !== undefined) return state;

  const submissions = { ...r.submissions };
  for (const p of state.players) {
    if (!submissions[p.id]) submissions[p.id] = whiff(p.id, now);
  }
  const [a, b] = state.players.map((p) => submissions[p.id]);
  const winnerId = decideRound(a, b);

  return {
    ...state,
    phase: "round_result",
    roundsPlayed: state.roundsPlayed + 1,
    players: state.players.map((p) =>
      p.id === winnerId ? { ...p, wins: p.wins + 1 } : p,
    ),
    round: { ...r, submissions, winnerId },
  };
}

export function isMatchOver(state: DuelState): boolean {
  const need = neededWins(state.config.bestOf);
  if (state.players.some((p) => p.wins >= need)) return true;
  return state.roundsPlayed >= state.config.bestOf;
}

/** Finalize the match, picking the player with more round wins (null = draw). */
export function concludeMatch(state: DuelState): DuelState {
  const [a, b] = state.players;
  const winnerId = a.wins === b.wins ? null : a.wins > b.wins ? a.id : b.id;
  return { ...state, phase: "finished", winnerId };
}

export function setConnected(
  state: DuelState,
  playerId: PlayerId,
  connected: boolean,
): DuelState {
  return {
    ...state,
    players: state.players.map((p) => (p.id === playerId ? { ...p, connected } : p)),
  };
}

// --- public projections (strip anything a client shouldn't see mid-round) ---

function toPublicPlayer(p: DuelState["players"][number]): PublicPlayer {
  return { id: p.id, name: p.name, wins: p.wins, connected: p.connected };
}

export function toPublicRound(state: DuelState): PublicRound | undefined {
  const r = state.round;
  if (!r) return undefined;
  return {
    index: r.index,
    label: r.label,
    rosterSize: r.rosterSize,
    deadline: r.deadline,
    // only WHO has locked in, never the pick itself, until the reveal
    submitted: Object.keys(r.submissions),
  };
}

export function toPublicDuel(state: DuelState): PublicDuel {
  return {
    id: state.id,
    config: state.config,
    phase: state.phase,
    players: state.players.map(toPublicPlayer),
    round: toPublicRound(state),
    roundsPlayed: state.roundsPlayed,
    winnerId: state.winnerId,
  };
}

/** Full reveal for the round-result screen (both picks visible). */
export function toPublicRoundResult(state: DuelState): PublicRoundResult | undefined {
  const r = state.round;
  if (!r) return undefined;
  return {
    index: r.index,
    label: r.label,
    winnerId: r.winnerId ?? null,
    players: state.players.map(toPublicPlayer),
    picks: state.players.map((p) => {
      const s = r.submissions[p.id];
      return {
        playerId: p.id,
        player: s?.player,
        guess: s?.guess ?? "",
        obscurity: s?.obscurity ?? 0,
        matched: s?.matched ?? false,
      };
    }),
  };
}
