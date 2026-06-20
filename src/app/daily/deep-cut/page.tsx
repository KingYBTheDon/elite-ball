"use client";

import { useCallback, useEffect, useState } from "react";
import type { GuessResult } from "@/lib/types";
import { PlayerSearchInput } from "@/components/PlayerSearchInput";
import { ScoreBar } from "@/components/ScoreBar";
import { DailyHeader, Panel, ResultActions, ComeBack } from "@/components/daily/ui";
import { tierFor } from "@/lib/tiers";
import { getGameState, recordResult, resultForToday } from "@/lib/daily/storage";
import { shareDeepCut, dailyUrl, obscuritySquare } from "@/lib/daily/share";

const PICKS = 5;

interface Pick {
  player: string;
  score: number;
}
interface Summary {
  date: string;
  label: string;
  picks: Pick[];
  scores: number[];
  avg: number;
}

export default function DeepCutPage() {
  const [puz, setPuz] = useState<{ date: string; prompt: { id: string; label: string; rosterSize: number } } | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState<GuessResult | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    fetch("/api/daily?game=deep-cut")
      .then((r) => r.json())
      .then((p) => {
        setPuz(p);
        const done = resultForToday<Summary>("deep-cut", p.date);
        if (done) setSummary(done.summary);
        setStreak(getGameState("deep-cut").streak);
      });
  }, []);

  const finish = useCallback(
    (all: Pick[], label: string, date: string) => {
      const scores = all.map((p) => p.score);
      const avg = Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10;
      const s: Summary = { date, label, picks: all, scores, avg };
      setSummary(s);
      setStreak(recordResult("deep-cut", date, s).streak);
    },
    [],
  );

  async function submit(name: string) {
    if (!puz || summary || loading) return;
    setNote(null);
    setFeedback(null);
    setLoading(true);
    const res = await fetch("/api/guess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: puz.prompt.id, name }),
    });
    const r: GuessResult = await res.json();
    setLoading(false);

    if (!r.valid || !r.breakdown || !r.player) {
      setFeedback(r);
      return;
    }
    if (picks.some((p) => p.player === r.player)) {
      setNote(`You already named ${r.player}.`);
      return;
    }
    const next = [...picks, { player: r.player, score: r.breakdown.total }];
    setPicks(next);
    setGuess("");
    setFeedback(null);
    if (next.length >= PICKS) finish(next, puz.prompt.label, puz.date);
  }

  function skip() {
    if (!puz || summary) return;
    const next = [...picks, { player: "—", score: 0 }];
    setPicks(next);
    setGuess("");
    setFeedback(null);
    setNote(null);
    if (next.length >= PICKS) finish(next, puz.prompt.label, puz.date);
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rise">
        <DailyHeader title="Daily Deep Cut" date={puz?.date} streak={streak} />

        {summary ? (
          <Result summary={summary} />
        ) : !puz ? (
          <Panel>
            <div className="h-8 w-2/3 rounded-lg bg-white/5 animate-pulse" />
          </Panel>
        ) : (
          <Panel>
            <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
              Pick {picks.length + 1} of {PICKS}
            </p>
            <h2 className="text-2xl font-semibold mt-1 tracking-tight leading-tight">
              {puz.prompt.label}
            </h2>
            <p className="text-sm text-neutral-500 mt-1">
              Name five — the more obscure, the better.
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

            {note && <p className="mt-2 text-sm text-amber-300/90">{note}</p>}
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
              <ul className="mt-5 space-y-2">
                {picks.map((p, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2"
                  >
                    <span className="text-sm truncate">{p.player}</span>
                    <span className="text-base font-semibold tabular-nums">{p.score}</span>
                  </li>
                ))}
              </ul>
            )}

            <button
              onClick={skip}
              className="mt-4 text-sm text-neutral-500 hover:text-neutral-300 transition"
            >
              Skip this pick (0)
            </button>
          </Panel>
        )}
      </div>
    </main>
  );
}

function Result({ summary }: { summary: Summary }) {
  const tier = tierFor(summary.avg);
  const share = shareDeepCut(summary.date, summary.scores, summary.avg, dailyUrl("deep-cut"));
  return (
    <Panel className="text-center">
      <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">{summary.label}</p>
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
            className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2"
          >
            <span className="text-sm truncate">{p.player}</span>
            <span className="text-base font-semibold tabular-nums">{p.score}</span>
          </li>
        ))}
      </ul>

      <ResultActions shareText={share} />
      <ComeBack />
    </Panel>
  );
}
