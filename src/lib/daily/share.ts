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

export function shareChain(
  date: string,
  length: number,
  tries: number,
  solved: boolean,
  url?: string,
): string {
  const bar = (solved ? "🟩" : "⬛").repeat(length - 1);
  const line = solved
    ? `${bar}  ${length}-chain in ${tries} ${tries === 1 ? "try" : "tries"}`
    : `${bar}  gave up`;
  return wrap("Chain", date, line, url);
}

export function shareLink(
  date: string,
  bridges: number,
  par: number,
  solved: boolean,
  url?: string,
): string {
  const body = solved
    ? `🪢 linked with ${bridges} bridge${bridges === 1 ? "" : "s"} (par ${par})`
    : "🪢 couldn’t connect";
  return wrap("Link Up", date, body, url);
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
