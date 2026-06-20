"use client";

import { useCallback, useEffect, useState } from "react";
import { PlayerSearchInput } from "@/components/PlayerSearchInput";
import { DailyHeader, Panel, ResultActions, ComeBack } from "@/components/daily/ui";
import { getGameState, recordResult, resultForToday } from "@/lib/daily/storage";
import { shareRareHunt, dailyUrl } from "@/lib/daily/share";

const MAX_GUESSES = 12;

interface Found {
  name: string;
  score: number;
}
interface Summary {
  date: string;
  label: string;
  found: Found[];
  attempts: number;
  targetCount: number;
  targets: { name: string; score: number }[];
}

export default function RareHuntPage() {
  const [puz, setPuz] = useState<{ date: string; prompt: { label: string; rosterSize: number }; targetCount: number } | null>(null);
  const [found, setFound] = useState<Found[]>([]);
  const [spent, setSpent] = useState(0);
  const [guess, setGuess] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    fetch("/api/daily?game=rare-hunt")
      .then((r) => r.json())
      .then((p) => {
        setPuz(p);
        const done = resultForToday<Summary>("rare-hunt", p.date);
        if (done) setSummary(done.summary);
        setStreak(getGameState("rare-hunt").streak);
      });
  }, []);

  const finish = useCallback(
    async (finalFound: Found[], attempts: number, date: string, label: string, targetCount: number) => {
      const rev = await fetch("/api/daily/rare-hunt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reveal: true }),
      })
        .then((r) => r.json())
        .catch(() => ({ targets: [] }));
      const s: Summary = {
        date,
        label,
        found: finalFound,
        attempts,
        targetCount,
        targets: rev.targets ?? [],
      };
      setSummary(s);
      setStreak(recordResult("rare-hunt", date, s).streak);
    },
    [],
  );

  async function submit(name: string) {
    if (!puz || summary || loading) return;
    setNote(null);
    setLoading(true);
    const r = await fetch("/api/daily/rare-hunt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).then((res) => res.json());
    setLoading(false);

    if (!r.matched) {
      setNote(r.suggestion ? `No match. Did you mean ${r.suggestion}?` : "No player by that name on this roster.");
      return;
    }
    if (found.some((f) => f.name === r.player)) {
      setNote(`${r.player} — already found.`);
      return;
    }

    const attempts = spent + 1;
    setSpent(attempts);
    setGuess("");

    if (r.isTarget) {
      const nextFound = [...found, { name: r.player, score: r.obscurity }];
      setFound(nextFound);
      if (nextFound.length >= puz.targetCount || attempts >= MAX_GUESSES) {
        finish(nextFound, attempts, puz.date, puz.prompt.label, puz.targetCount);
      }
    } else {
      setNote(`${r.player} played here — but too well-known (${r.obscurity}).`);
      if (attempts >= MAX_GUESSES) {
        finish(found, attempts, puz.date, puz.prompt.label, puz.targetCount);
      }
    }
  }

  function giveUp() {
    if (!puz || summary) return;
    finish(found, spent, puz.date, puz.prompt.label, puz.targetCount);
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rise">
        <DailyHeader title="Rare Hunt" date={puz?.date} streak={streak} />

        {summary ? (
          <Result summary={summary} />
        ) : !puz ? (
          <Panel>
            <div className="h-8 w-2/3 rounded-lg bg-white/5 animate-pulse" />
          </Panel>
        ) : (
          <Panel>
            <div className="flex items-center justify-between">
              <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
                Found {found.length}/{puz.targetCount}
              </p>
              <span className="text-sm tabular-nums text-neutral-400">
                {MAX_GUESSES - spent} guesses left
              </span>
            </div>
            <h2 className="text-2xl font-semibold mt-1 tracking-tight leading-tight">
              {puz.prompt.label}
            </h2>
            <p className="text-sm text-neutral-500 mt-1">
              Name the {puz.targetCount} most obscure players who played here.
            </p>

            <div className="mt-5">
              <PlayerSearchInput
                value={guess}
                onValueChange={setGuess}
                onSubmit={(n) => n.trim() && submit(n)}
                loading={loading}
                submitLabel="Hunt"
              />
            </div>

            {note && <p className="mt-2 text-sm text-neutral-400">{note}</p>}

            {/* slots */}
            <div className="mt-5 grid grid-cols-2 gap-2">
              {Array.from({ length: puz.targetCount }).map((_, i) => {
                const f = found[i];
                return (
                  <div
                    key={i}
                    className={`rounded-xl border px-3 py-2 text-sm flex items-center justify-between ${
                      f
                        ? "border-emerald-400/30 bg-emerald-400/10"
                        : "border-white/5 bg-white/[0.02] text-neutral-600"
                    }`}
                  >
                    <span className="truncate">{f ? f.name : "— — —"}</span>
                    {f && <span className="tabular-nums text-emerald-300 shrink-0 pl-2">{f.score}</span>}
                  </div>
                );
              })}
            </div>

            <button
              onClick={giveUp}
              className="mt-4 text-sm text-neutral-500 hover:text-neutral-300 transition"
            >
              Give up
            </button>
          </Panel>
        )}
      </div>
    </main>
  );
}

function Result({ summary }: { summary: Summary }) {
  const share = shareRareHunt(
    summary.date,
    summary.found.length,
    summary.targetCount,
    summary.attempts,
    dailyUrl("rare-hunt"),
  );
  const foundNames = new Set(summary.found.map((f) => f.name));
  return (
    <Panel className="text-center">
      <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">{summary.label}</p>
      <p className="mt-3 text-6xl font-bold tabular-nums tracking-tight text-emerald-300">
        {summary.found.length}
        <span className="text-neutral-600 text-3xl">/{summary.targetCount}</span>
      </p>
      <p className="text-xs uppercase tracking-[0.15em] text-neutral-500 mt-1">
        deep cuts found in {summary.attempts}
      </p>

      <p className="mt-5 text-[11px] uppercase tracking-widest text-neutral-500 text-left">
        The {summary.targetCount} rarest
      </p>
      <ul className="mt-2 space-y-1.5 text-left">
        {summary.targets.map((t) => (
          <li
            key={t.name}
            className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
              foundNames.has(t.name)
                ? "border-emerald-400/30 bg-emerald-400/10"
                : "border-white/5 bg-white/[0.03]"
            }`}
          >
            <span className="text-sm truncate">
              {foundNames.has(t.name) ? "✓ " : ""}
              {t.name}
            </span>
            <span className="text-sm font-semibold tabular-nums shrink-0 pl-2">{t.score}</span>
          </li>
        ))}
      </ul>

      <ResultActions shareText={share} />
      <ComeBack />
    </Panel>
  );
}
