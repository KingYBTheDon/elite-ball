// Metadata for the five daily challenges. Pure constants — safe on the client.

export type DailyGameId = "deep-cut" | "dig-deeper" | "slate" | "rare-hunt" | "connect";

export interface DailyGameMeta {
  id: DailyGameId;
  title: string;
  tagline: string;
  emoji: string;
  route: string;
  accent: string; // tailwind text color for accents
}

export const DAILY_GAMES: DailyGameMeta[] = [
  {
    id: "deep-cut",
    title: "Daily Deep Cut",
    tagline: "One matchup, five picks. Go as obscure as you can.",
    emoji: "🃏",
    route: "/daily/deep-cut",
    accent: "text-orange-400",
  },
  {
    id: "dig-deeper",
    title: "Dig Deeper",
    tagline: "Each pick must beat the last. How deep can you go?",
    emoji: "⛏️",
    route: "/daily/dig-deeper",
    accent: "text-amber-300",
  },
  {
    id: "slate",
    title: "The Slate",
    tagline: "Five matchups, one pick each.",
    emoji: "📋",
    route: "/daily/slate",
    accent: "text-sky-300",
  },
  {
    id: "rare-hunt",
    title: "Rare Hunt",
    tagline: "Find the eight most obscure players on one roster.",
    emoji: "🔦",
    route: "/daily/rare-hunt",
    accent: "text-emerald-300",
  },
  {
    id: "connect",
    title: "Connect",
    tagline: "Sort sixteen players into the team they belong to.",
    emoji: "🧩",
    route: "/daily/connect",
    accent: "text-violet-300",
  },
];

export const gameMeta = (id: DailyGameId): DailyGameMeta =>
  DAILY_GAMES.find((g) => g.id === id)!;
