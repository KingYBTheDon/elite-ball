import { NextRequest, NextResponse } from "next/server";
import { randomPrompt } from "@/lib/dataset";
import { isMode, type ModeKey } from "@/lib/modes";

// Each request returns a fresh random challenge — never cache this.
export const dynamic = "force-dynamic";

// GET /api/prompt?mode=modern|classic — a random team+decade challenge.
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get("mode");
  const mode: ModeKey = raw && isMode(raw) ? raw : "modern";
  const p = randomPrompt(mode);
  return NextResponse.json({
    id: p.id,
    team: p.team,
    decade: p.decade,
    label: p.label,
    rosterSize: p.roster.length,
  });
}
