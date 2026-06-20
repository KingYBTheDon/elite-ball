// Spoiler-free share cards — the growth loop. Each builder returns plain text
// with an emoji grid (no player names), ready to copy to the clipboard.

const BRAND = "Elite Ball Knowledge";

/** Obscurity score (0-100) → a coloured square by tier. */
export function obscuritySquare(score: number): string {
  if (score >= 80) return "🟧";
  if (score >= 65) return "🟨";
  if (score >= 50) return "🟩";
  if (score >= 35) return "🟦";
  return "⬜";
}

function wrap(title: string, date: string, body: string, url?: string): string {
  const link = url ? `\n${url}` : "";
  return `${BRAND} — ${title} (${date})\n${body}${link}`;
}

export function shareDeepCut(date: string, scores: number[], avg: number, url?: string): string {
  const grid = scores.map(obscuritySquare).join("");
  return wrap("Daily Deep Cut", date, `${grid}  avg ${avg.toFixed(1)}`, url);
}

export function shareDigDeeper(date: string, scores: number[], url?: string): string {
  const grid = scores.map(obscuritySquare).join("");
  return wrap("Dig Deeper", date, `${grid}  depth ${scores.length}`, url);
}

export function shareSlate(date: string, scores: number[], tier: string, url?: string): string {
  const grid = scores.map(obscuritySquare).join("");
  return wrap("The Slate", date, `${grid}\n${tier} · avg ${(scores.reduce((a, b) => a + b, 0) / (scores.length || 1)).toFixed(1)}`, url);
}

export function shareRareHunt(
  date: string,
  found: number,
  total: number,
  attempts: number,
  url?: string,
): string {
  const grid = "🟩".repeat(found) + "⬜".repeat(Math.max(0, total - found));
  return wrap("Rare Hunt", date, `${grid}  ${found}/${total} in ${attempts}`, url);
}

/** Connect: one row of four squares per guess, coloured by the group guessed. */
export const CONNECT_COLORS = ["🟪", "🟦", "🟩", "🟨"]; // index = group index
export function shareConnect(
  date: string,
  rows: number[][], // each row: four group-indices (or -1 for "no group / mixed")
  solved: number,
  url?: string,
): string {
  const grid = rows
    .map((row) => row.map((g) => (g < 0 ? "⬛" : CONNECT_COLORS[g] ?? "⬛")).join(""))
    .join("\n");
  return wrap("Connect", date, `${solved}/4 groups\n${grid}`, url);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export function dailyUrl(game: string): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}/daily/${game}`;
}
