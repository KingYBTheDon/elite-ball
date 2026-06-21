import { NextRequest, NextResponse } from "next/server";
import { todayKey } from "@/lib/daily/seed";
import { validateLinkChain, shortestLinkPath } from "@/lib/daily/links";

// POST /api/daily/link
//   { chain: string[] }  -> per-link validity + solved + par (chain = [a,...,b])
//   { reveal: true }     -> one shortest teammate path (names)
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { chain?: string[]; reveal?: boolean };

  if (body.reveal) {
    return NextResponse.json({ path: shortestLinkPath(todayKey()) });
  }

  const chain = body.chain;
  if (!Array.isArray(chain) || chain.length < 2) {
    return NextResponse.json({ error: "need a chain" }, { status: 400 });
  }
  return NextResponse.json(validateLinkChain(todayKey(), chain));
}
