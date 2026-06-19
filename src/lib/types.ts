// Core domain types for the Elite Ball Knowledge game.

// A player as seen for ONE team+decade prompt ("stint"). Stats and accolades
// are team-specific, except fame (pageviews) and HOF, which are career-wide.
export interface Player {
  /** Display name, e.g. "Sim Bhullar" */
  name: string;
  /** English Wikipedia article title used for the pageviews fame signal. */
  wiki: string;
  /** Avg monthly Wikipedia pageviews — CAREER-WIDE recognition (not per team). */
  pv: number;
  /** Points per game FOR THIS TEAM+DECADE. */
  ppg: number;
  /** Regular-season games played FOR THIS TEAM+DECADE. */
  games: number;
  /** All-Star selections earned while on this team+decade. */
  allStars: number;
  /** All-NBA selections earned while on this team+decade. */
  allNBA?: number;
  /** MVP + DPOY voting share earned while on this team+decade. */
  awardShare?: number;
  /** Hall of Fame inductee — CAREER-WIDE (a person fact, not per team). */
  hof?: boolean;
  /** Overall draft pick number, only if THIS franchise drafted them. null = otherwise. */
  draftPick?: number | null;
  /** Alternate names / nicknames the player can be guessed by (career-wide). */
  aliases?: string[];
}

export interface Prompt {
  id: string;
  team: string;
  /** e.g. "2010s" */
  decade: string;
  /** Human label, e.g. "2010s Sacramento Kings" */
  label: string;
  roster: Player[];
}

export interface ScoreBreakdown {
  /** Final obscurity score, 0-100. Higher = more obscure = better. */
  total: number;
  /** Obscurity sub-scores, each 0-100 (higher = more obscure). */
  fame: number;
  notability: number;
  career: number;
  production: number;
}

export interface RankedPlayer {
  name: string;
  score: number;
}

export interface GuessResult {
  valid: boolean;
  message: string;
  /** A near-miss correction ("Did you mean …?") when the guess looks like a typo. */
  suggestion?: string;
  player?: string;
  breakdown?: ScoreBreakdown;
  /** 1-based rank of this guess among the full roster (1 = most obscure). */
  rank?: number;
  rosterSize?: number;
  /** Full roster ranked by obscurity, for the reveal. */
  ranked?: RankedPlayer[];
}
