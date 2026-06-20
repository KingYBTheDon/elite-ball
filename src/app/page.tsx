"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MODES, type ModeKey } from "@/lib/modes";
import { tierFor } from "@/lib/tiers";
import { loadStore, type GameRecord } from "@/lib/storage";

export default function Home() {
  const [highs, setHighs] = useState<Partial<Record<ModeKey, number>>>({});
  const [log, setLog] = useState<GameRecord[]>([]);

  // localStorage only exists client-side — read after mount.
  useEffect(() => {
    const s = loadStore();
    setHighs(s.highscores);
    setLog(s.log);
  }, []);

  return (
    <main className="min-h-dvh flex flex-col items-center px-5 py-16 sm:py-20">
      <div className="w-full max-w-md rise">
        <header className="text-center">
          <h1 className="text-[2.6rem] font-bold tracking-tight leading-none">
            <span className="text-[var(--accent)]">Elite</span> Ball
            <br />
            Knowledge
          </h1>
          <p className="text-[var(--muted)] mt-4 text-[15px] leading-relaxed max-w-xs mx-auto">
            Test your ball knowledge. You get a team and a decade, and you name
            the most forgotten NBA player who actually played there.
          </p>
        </header>

        <Link
          href="/daily"
          className="group card-hover mt-8 flex items-center justify-between rounded-[1.4rem] border border-[var(--accent)]/30 bg-[var(--accent)]/[0.08] backdrop-blur px-6 py-4 hover:border-[var(--accent)]/50 hover:bg-[var(--accent)]/[0.12]"
        >
          <div>
            <p className="font-semibold tracking-tight text-[var(--accent)]">Daily challenges</p>
            <p className="text-sm text-[var(--muted)] mt-0.5">Five puzzles. New every day.</p>
          </div>
          <span className="text-2xl shrink-0 transition group-hover:translate-x-0.5">→</span>
        </Link>

        <div className="mt-4 grid gap-3">
          {(Object.keys(MODES) as ModeKey[]).map((key) => (
            <Link
              key={key}
              href={`/play/${key}`}
              className="group card-hover flex items-center justify-between rounded-[1.4rem] border border-[var(--hairline)] bg-[var(--card)] backdrop-blur px-6 py-5 hover:border-[var(--accent)]/45 hover:bg-white/[0.05] hover:shadow-2xl hover:shadow-black/30"
            >
              <div>
                <p className="text-xl font-semibold tracking-tight flex items-baseline gap-2">
                  {MODES[key].label}
                  <span className="text-[13px] font-normal text-[var(--muted)]">
                    {MODES[key].sub}
                  </span>
                </p>
                {MODES[key].blurb && (
                  <p className="text-sm text-[var(--muted)] mt-1">
                    {MODES[key].blurb}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0 pl-4">
                {highs[key] != null ? (
                  <>
                    <p className="text-lg font-semibold tabular-nums text-[var(--accent)]">
                      {highs[key]}
                    </p>
                    <p className="text-[10px] uppercase tracking-[0.15em] text-neutral-600">
                      best
                    </p>
                  </>
                ) : (
                  <span className="text-neutral-600 text-2xl transition group-hover:translate-x-0.5 group-hover:text-neutral-400">
                    →
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>

        <section className="mt-12">
          <h2 className="text-[11px] uppercase tracking-[0.2em] text-neutral-500 mb-3">
            Recent games
          </h2>
          {log.length === 0 ? (
            <p className="text-sm text-neutral-600">
              Nothing here yet. Play a game and it shows up.
            </p>
          ) : (
            <ul className="space-y-2">
              {log.map((g, i) => {
                const tier = tierFor(g.avg);
                return (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-2xl border border-white/5 bg-white/[0.02] px-4 py-3"
                  >
                    <div>
                      <p className={`text-sm font-medium ${tier.accent}`}>
                        {tier.name}
                      </p>
                      <p className="text-xs text-neutral-500">
                        {MODES[g.mode].label} · {timeAgo(g.date)}
                      </p>
                    </div>
                    <span className="text-xl font-semibold tabular-nums">
                      {g.avg}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} hr ago`;
  return `${Math.floor(h / 24)} d ago`;
}
