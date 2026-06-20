import { NextRequest, NextResponse } from "next/server";
import { getPrompt } from "@/lib/dataset";
import { gradeGuess } from "@/lib/grade";
import { rankRoster } from "@/lib/scoring";
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

  const grade = gradeGuess(prompt, name ?? "");
  if (!grade.matched || !grade.player || !grade.breakdown) {
    if (grade.suggestion) {
      return NextResponse.json({
        valid: false,
        suggestion: grade.suggestion,
        message: `Did you mean ${grade.suggestion}?`,
      } satisfies GuessResult);
    }
    return NextResponse.json({
      valid: false,
      message: `No ${prompt.team} player from the ${prompt.decade} by that name.`,
    } satisfies GuessResult);
  }

  const ranked = rankRoster(prompt.roster);
  const rank = ranked.findIndex((r) => r.name === grade.player!.name) + 1;

  return NextResponse.json({
    valid: true,
    message: "Valid pull!",
    player: grade.player.name,
    breakdown: grade.breakdown,
    rank,
    rosterSize: prompt.roster.length,
    ranked,
  } satisfies GuessResult);
}
