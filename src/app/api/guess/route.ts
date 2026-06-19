import { NextRequest, NextResponse } from "next/server";
import { getPrompt } from "@/lib/dataset";
import { matchPlayer, suggestPlayer } from "@/lib/match";
import { scorePlayer, rankRoster } from "@/lib/scoring";
import type { GuessResult } from "@/lib/types";

// POST /api/guess  body: { id: string, name: string }
export async function POST(req: NextRequest) {
  const { id, name } = (await req.json()) as { id?: string; name?: string };

  const prompt = id ? getPrompt(id) : undefined;
  if (!prompt) {
    return NextResponse.json(
      { valid: false, message: "Unknown challenge." } satisfies GuessResult,
      { status: 400 },
    );
  }

  const player = matchPlayer(name ?? "", prompt.roster);
  if (!player) {
    const near = suggestPlayer(name ?? "", prompt.roster);
    if (near) {
      return NextResponse.json({
        valid: false,
        suggestion: near.name,
        message: `Did you mean ${near.name}?`,
      } satisfies GuessResult);
    }
    return NextResponse.json({
      valid: false,
      message: `No ${prompt.team} player from the ${prompt.decade} by that name.`,
    } satisfies GuessResult);
  }

  const breakdown = scorePlayer(player);
  const ranked = rankRoster(prompt.roster);
  const rank = ranked.findIndex((r) => r.name === player.name) + 1;

  return NextResponse.json({
    valid: true,
    message: "Valid pull!",
    player: player.name,
    breakdown,
    rank,
    rosterSize: prompt.roster.length,
    ranked,
  } satisfies GuessResult);
}
