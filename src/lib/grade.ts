// Grade a typed guess against a prompt's roster — the single source of truth
// for "is this a valid pull and how obscure is it". Used by the single-player
// /api/guess route and (server-side) by the multiplayer duel manager, so both
// modes score identically.

import type { Prompt, Player, ScoreBreakdown } from "./types";
import { matchPlayer, suggestPlayer } from "./match";
import { scorePlayer } from "./scoring";

export interface Grade {
  /** Did the guess resolve to a player on this roster? */
  matched: boolean;
  /** The matched roster player, when matched. */
  player?: Player;
  /** Obscurity breakdown, when matched. */
  breakdown?: ScoreBreakdown;
  /** A "Did you mean …?" near-miss when not matched (typo). */
  suggestion?: string;
}

export function gradeGuess(prompt: Prompt, name: string): Grade {
  const player = matchPlayer(name, prompt.roster);
  if (!player) {
    const near = suggestPlayer(name, prompt.roster);
    return { matched: false, suggestion: near?.name };
  }
  return { matched: true, player, breakdown: scorePlayer(player) };
}
