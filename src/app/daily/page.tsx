"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DAILY_GAMES, STATUS_LABEL, STATUS_STYLE } from "@/lib/daily/games";
import { getGameState } from "@/lib/daily/storage";
import { todayKey } from "@/lib/daily/seed";

interface Row {
  streak: number;
  doneToday: boolean;
}

export default function DailyHub() {
  const [date, setDate] = useState<string>(todayKey());
  const [rows, setRows] = useState<Record<string, Row>>({});

  useEffect(() => {
    // Trust the server's date so streaks line up across timezones.
    fetch("/api/daily?game=date")
      .then((r) => r.json())
      .then((d: { date: string }) => setDate(d.date))
      .catch(() => {});
  }, []);

  useEffect(() => {
    const next: Record<string, Row> = {};
    for (const g of DAILY_GAMES) {
      const s = getGameState(g.id);
      next[g.id] = { streak: s.streak, doneToday: s.last?.date === date };
    }
    setRows(next);
  }, [date]);

  const doneCount = Object.values(rows).filter((r) => r.doneToday).length;

  return (
    <main className="min-h-dvh flex flex-col items-center px-5 py-14">
      <div className="w-full max-w-md rise">
        <header className="text-center">
          <h1 className="text-3xl font-bold tracking-tight">Daily</h1>
          <p className="text-[var(--muted)] mt-2 text-[15px]">
            Five challenges. New ones every day. {doneCount > 0 && `${doneCount}/5 done today.`}
          </p>
        </header>

        <div className="mt-8 grid gap-3">
          {DAILY_GAMES.map((g) => {
            const row = rows[g.id];
            return (
              <Link
                key={g.id}
                href={g.route}
                className="group card-hover flex items-center gap-4 rounded-[1.4rem] border border-[var(--hairline)] bg-[var(--card)] backdrop-blur px-5 py-4 hover:border-white/20 hover:bg-white/[0.05]"
              >
                <span className="text-2xl shrink-0">{g.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className={`font-semibold tracking-tight ${g.accent} flex items-center gap-2`}>
                    <span className="truncate">{g.title}</span>
                    {row?.doneToday && <span className="text-emerald-400 text-sm shrink-0">✓</span>}
                  </p>
                  <p className="text-sm text-[var(--muted)] mt-0.5 truncate">{g.tagline}</p>
                  <span
                    className={`mt-1.5 inline-block rounded-full border px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLE[g.status]}`}
                  >
                    {STATUS_LABEL[g.status]}
                  </span>
                </div>
                <span className="shrink-0 text-right text-sm tabular-nums text-neutral-500 min-w-[3ch]">
                  {row?.streak ? `🔥${row.streak}` : ""}
                </span>
              </Link>
            );
          })}
        </div>

        <Link
          href="/"
          className="mt-8 block text-center text-sm text-neutral-500 hover:text-neutral-300 transition"
        >
          ← Back home
        </Link>
      </div>
    </main>
  );
}
