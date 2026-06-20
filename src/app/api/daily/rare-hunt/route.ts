import { NextRequest, NextResponse } from "next/server";
import { todayKey } from "@/lib/daily/seed";
import { rareHuntPuzzle } from "@/lib/daily/puzzles";
import { getPrompt } from "@/lib/dataset";
import { gradeGuess } from "@/lib/grade";

// POST /api/daily/rare-hunt  body: { name } | { reveal: true }
// Grades a guess against today's hidden 8 rarest, or reveals them at the end.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { name?: string; reveal?: boolean };
  const date = todayKey();
  const puz = rareHuntPuzzle(date);

  if (body.reveal) {
    return NextResponse.json({ targets: puz.targets });
  }

  const full = getPrompt(puz.prompt.id);
  const grade = full ? gradeGuess(full, body.name ?? "") : { matched: false as const };

  if (!grade.matched || !grade.player || !grade.breakdown) {
    return NextResponse.json({ matched: false, suggestion: grade.suggestion });
  }

  const idx = puz.targets.findIndex((t) => t.name === grade.player!.name);
  return NextResponse.json({
    matched: true,
    player: grade.player.name,
    obscurity: grade.breakdown.total,
    isTarget: idx >= 0,
  });
}
