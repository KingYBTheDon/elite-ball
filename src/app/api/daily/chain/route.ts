import { NextRequest, NextResponse } from "next/server";
import { chainPuzzle, validateChainOrder } from "@/lib/daily/links";
import { personName } from "@/lib/dataset";
import { todayKey } from "@/lib/daily/seed";

// POST /api/daily/chain  body: { order: string[] } | { reveal: true }
// Validates a proposed ordering, or reveals one valid solution at the end.
export async function POST(req: NextRequest) {
  const body = (await req.json()) as { order?: string[]; reveal?: boolean };

  if (body.reveal) {
    const p = chainPuzzle(todayKey());
    return NextResponse.json({ solution: p.solutionIds.map((id) => personName(id)) });
  }

  const order = body.order;
  if (!Array.isArray(order) || order.length < 2) {
    return NextResponse.json({ error: "need an ordering" }, { status: 400 });
  }
  return NextResponse.json(validateChainOrder(order));
}
