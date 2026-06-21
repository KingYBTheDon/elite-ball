import { NextRequest, NextResponse } from "next/server";
import { todayKey } from "@/lib/daily/seed";
import {
  deepCutPuzzle,
  digDeeperPuzzle,
  rareHuntPuzzle,
  slatePuzzle,
  RARE_TARGET_COUNT,
} from "@/lib/daily/puzzles";
import { chainPuzzle, linkPuzzle } from "@/lib/daily/links";

// Depends on the server date, so never cache.
export const dynamic = "force-dynamic";

// GET /api/daily?game=<id> — today's puzzle for one game (solutions stripped).
export function GET(req: NextRequest) {
  const game = req.nextUrl.searchParams.get("game");
  const date = todayKey();

  switch (game) {
    case "date":
      return NextResponse.json({ date });
    case "deep-cut":
      return NextResponse.json(deepCutPuzzle(date));
    case "dig-deeper":
      return NextResponse.json(digDeeperPuzzle(date));
    case "slate":
      return NextResponse.json(slatePuzzle(date));
    case "rare-hunt": {
      const p = rareHuntPuzzle(date);
      // hide the target names — finding them IS the game
      return NextResponse.json({ date, prompt: p.prompt, targetCount: RARE_TARGET_COUNT });
    }
    case "chain": {
      const p = chainPuzzle(date);
      // hide the solution order — only the shuffled tiles go to the client
      return NextResponse.json({ date, tiles: p.tiles, length: p.length });
    }
    case "link": {
      const p = linkPuzzle(date);
      return NextResponse.json({ date, a: p.a, b: p.b, par: p.par });
    }
    default:
      return NextResponse.json({ error: "unknown game" }, { status: 400 });
  }
}
