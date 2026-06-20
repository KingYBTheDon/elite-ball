import { NextRequest, NextResponse } from "next/server";
import { todayKey } from "@/lib/daily/seed";
import { connectPuzzle } from "@/lib/daily/puzzles";

// POST /api/daily/connect  body: { names: string[4] } | { reveal: true }
// Checks a proposed group of 4 names, or reveals the full solution at the end.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { names?: string[]; reveal?: boolean };
  const date = todayKey();
  const puz = connectPuzzle(date);

  if (body.reveal) {
    return NextResponse.json({ groups: puz.groups });
  }

  const names = body.names;
  if (!Array.isArray(names) || names.length !== 4) {
    return NextResponse.json({ error: "need 4 names" }, { status: 400 });
  }

  const groupOf = new Map<string, number>();
  puz.groups.forEach((g, i) => g.members.forEach((m) => groupOf.set(m, i)));

  const counts: Record<number, number> = {};
  for (const n of names) {
    const gi = groupOf.get(n);
    if (gi !== undefined) counts[gi] = (counts[gi] ?? 0) + 1;
  }
  const max = Math.max(0, ...Object.values(counts));

  if (max === 4) {
    const gi = Number(Object.entries(counts).find(([, c]) => c === 4)![0]);
    return NextResponse.json({
      correct: true,
      groupIndex: gi,
      label: puz.groups[gi].label,
      members: puz.groups[gi].members,
    });
  }
  return NextResponse.json({ correct: false, oneAway: max === 3 });
}
