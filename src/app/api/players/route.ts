import { NextResponse } from "next/server";
import { allPlayers } from "@/lib/dataset";

// The full league-wide player list for the search typeahead. It's identical for
// everyone and changes only when the dataset is rebuilt, so prerender it once.
export const dynamic = "force-static";

// GET /api/players — every player name (+ aliases) for client-side autocomplete.
export function GET() {
  return NextResponse.json(allPlayers());
}
