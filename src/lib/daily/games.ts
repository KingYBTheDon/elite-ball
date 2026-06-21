// Metadata for the daily challenges. Pure constants — safe on the client.
// `status` flags where each game stands in the test phase.

export type DailyGameId =
  | "dig-deeper"
  | "chain"
  | "link"
  | "deep-cut"
  | "slate"
  | "rare-hunt";

export type GameStatus = "favorite" | "new" | "testing" | "cut";

export interface DailyGameMeta {
  id: DailyGameId;
  title: string;
  tagline: string;
  emoji: string;
  route: string;
  accent: string; // tailwind text color
  status: GameStatus;
}

// Order = how they appear on the hub (favorites & new first).
export const DAILY_GAMES: DailyGameMeta[] = [
  {
    id: "dig-deeper",
    title: "Dig Deeper",
    tagline: "Each pick must beat the last. How deep can you go?",
    emoji: "⛏️",
    route: "/daily/dig-deeper",
    accent: "text-amber-300",
    status: "favorite",
  },
  {
    id: "chain",
    title: "Chain",
    tagline: "Reorder the players so every neighbour was a teammate.",
    emoji: "🔗",
    route: "/daily/chain",
    accent: "text-violet-300",
    status: "new",
  },
  {
    id: "link",
    title: "Link Up",
    tagline: "Connect two stars through a chain of teammates.",
    emoji: "🪢",
    route: "/daily/link",
    accent: "text-sky-300",
    status: "new",
  },
  {
    id: "deep-cut",
    title: "Daily Deep Cut",
    tagline: "One matchup, five picks. Go as obscure as you can.",
    emoji: "🃏",
    route: "/daily/deep-cut",
    accent: "text-orange-400",
    status: "testing",
  },
  {
    id: "slate",
    title: "The Slate",
    tagline: "Five matchups, one pick each.",
    emoji: "📋",
    route: "/daily/slate",
    accent: "text-orange-300",
    status: "testing",
  },
  {
    id: "rare-hunt",
    title: "Rare Hunt",
    tagline: "Find the eight most obscure players on one roster.",
    emoji: "🔦",
    route: "/daily/rare-hunt",
    accent: "text-neutral-300",
    status: "cut",
  },
];

export const STATUS_LABEL: Record<GameStatus, string> = {
  favorite: "★ Favorite",
  new: "New",
  testing: "Testing",
  cut: "May be cut",
};

export const STATUS_STYLE: Record<GameStatus, string> = {
  favorite: "text-amber-300 bg-amber-300/10 border-amber-300/30",
  new: "text-violet-300 bg-violet-300/10 border-violet-300/30",
  testing: "text-neutral-400 bg-white/5 border-white/10",
  cut: "text-red-300/80 bg-red-400/10 border-red-400/20",
};

export const gameMeta = (id: DailyGameId): DailyGameMeta =>
  DAILY_GAMES.find((g) => g.id === id)!;
