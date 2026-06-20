"use client";

import { useCallback, useEffect, useState } from "react";
import type { GuessResult } from "@/lib/types";
import { PlayerSearchInput } from "@/components/PlayerSearchInput";
import { DailyHeader, Panel, ResultActions, ComeBack } from "@/components/daily/ui";
import { tierFor } from "@/lib/tiers";
import { getGameState, recordResult, resultForToday } from "@/lib/daily/storage";
import { shareSlate, dailyUrl, obscuritySquare } from "@/lib/daily/share";

interface Lite {
  id: string;
  label: string;
  rosterSize: number;
}
interface Pick {
  label: string;
  player: string;
  score: number;
}
interface Summary {
  date: string;
  picks: Pick[];
  scores: number[];
  avg: number;
}

export default function SlatePage() {
  const [puz, setPuz] = useState<{ date: string; prompts: Lite[] } | null>(null);
  const [idx, setIdx] = useState(0);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState<GuessResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    fetch("/api/daily?game=slate")
      .then((r) => r.json())
      .then((p) => {
        setPuz(p);
        const done = resultForToday<Summary>("slate", p.date);
        if (done) setSummary(done.summary);
        setStreak(getGameState("slate").streak);
      });
  }, []);

  const finish = useCallback((all: Pick[], date: string) => {
    const scores = all.map((p) => p.score);
    const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
    const s: Summary = { date, picks: all, scores, avg };
    setSummary(s);
    setStreak(recordResult("slate", date, s).streak);
  }, []);

  function advance(pick: Pick) {
    const next = [...picks, pick];
    setPicks(next);
    setGuess("");
    setFeedback(null);
    if (next.length >= (puz?.prompts.length ?? 5)) finish(next, puz!.date);
    else setIdx((i) => i + 1);
  }

  async function submit(name: string) {
    if (!puz || summary || loading) return;
    setFeedback(null);
    setLoading(true);
    const res = await fetch("/api/guess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: puz.prompts[idx].id, name }),
    });
    const r: GuessResult = await res.json();
    setLoading(false);
    if (!r.valid || !r.breakdown || !r.player) {
      setFeedback(r);
      return;
    }
    advance({ label: puz.prompts[idx].label, player: r.player, score: r.breakdown.total });
  }

  function skip() {
    if (!puz || summary) return;
    advance({ label: puz.prompts[idx].label, player: "—", score: 0 });
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rise">
        <DailyHeader title="The Slate" date={puz?.date} streak={streak} />

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
                Matchup {idx + 1} of {puz.prompts.length}
              </p>
              <div className="flex gap-1">
                {puz.prompts.map((_, i) => (
                  <span
                    key={i}
                    className={`h-1.5 w-5 rounded-full ${
                      i < picks.length ? "bg-sky-400" : i === idx ? "bg-neutral-400" : "bg-white/10"
                    }`}
                  />
                ))}
              </div>
            </div>
            <h2 className="text-2xl font-semibold mt-2 tracking-tight leading-tight">
              {puz.prompts[idx].label}
            </h2>
            <p className="text-sm text-neutral-500 mt-1">
              {puz.prompts[idx].rosterSize} players to choose from
            </p>

            <div className="mt-5">
              <PlayerSearchInput
                value={guess}
                onValueChange={setGuess}
                onSubmit={(n) => n.trim() && submit(n)}
                loading={loading}
                submitLabel="Pick"
              />
            </div>

            {feedback && !feedback.valid && feedback.suggestion && (
              <p className="mt-2 text-sm text-neutral-400">
                Did you mean{" "}
                <button
                  onClick={() => submit(feedback.suggestion!)}
                  className="font-medium text-[var(--accent)] underline underline-offset-2"
                >
                  {feedback.suggestion}
                </button>
                ?
              </p>
            )}
            {feedback && !feedback.valid && !feedback.suggestion && (
              <p className="mt-2 text-sm text-red-400/90">{feedback.message}</p>
            )}

            {picks.length > 0 && (
              <p className="mt-4 text-center text-xs text-neutral-600">
                Running average{" "}
                <span className="text-neutral-400 font-medium tabular-nums">
                  {(picks.reduce((a, b) => a + b.score, 0) / picks.length).toFixed(1)}
                </span>
              </p>
            )}

            <button
              onClick={skip}
              className="mt-3 text-sm text-neutral-500 hover:text-neutral-300 transition"
            >
              Skip (0)
            </button>
          </Panel>
        )}
      </div>
    </main>
  );
}

function Result({ summary }: { summary: Summary }) {
  const tier = tierFor(summary.avg);
  const share = shareSlate(summary.date, summary.scores, tier.name, dailyUrl("slate"));
  return (
    <Panel className="text-center">
      <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Today’s slate</p>
      <p className="mt-3 text-6xl font-bold tabular-nums tracking-tight">{summary.avg}</p>
      <p className="text-xs uppercase tracking-[0.15em] text-neutral-500 mt-1">average obscurity</p>
      <h2 className={`mt-3 text-2xl font-semibold tracking-tight ${tier.accent}`}>{tier.name}</h2>

      <div className="mt-4 text-2xl tracking-widest">
        {summary.scores.map((s) => obscuritySquare(s)).join("")}
      </div>

      <ul className="mt-5 space-y-2 text-left">
        {summary.picks.map((p, i) => (
          <li
            key={i}
            className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-sm truncate">{p.player}</p>
              <p className="text-xs text-neutral-500 truncate">{p.label}</p>
            </div>
            <span className="text-base font-semibold tabular-nums shrink-0">{p.score}</span>
          </li>
        ))}
      </ul>

      <ResultActions shareText={share} />
      <ComeBack />
    </Panel>
  );
}
