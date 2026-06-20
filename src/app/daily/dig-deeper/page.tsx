"use client";

import { useCallback, useEffect, useState } from "react";
import type { GuessResult } from "@/lib/types";
import { PlayerSearchInput } from "@/components/PlayerSearchInput";
import { DailyHeader, Panel, ResultActions, ComeBack } from "@/components/daily/ui";
import { getGameState, recordResult, resultForToday } from "@/lib/daily/storage";
import { shareDigDeeper, dailyUrl, obscuritySquare } from "@/lib/daily/share";

interface Pick {
  player: string;
  score: number;
}
interface Summary {
  date: string;
  label: string;
  picks: Pick[];
  breaker?: Pick; // the pick that ended the run, if any
  depth: number;
}

export default function DigDeeperPage() {
  const [puz, setPuz] = useState<{ date: string; prompt: { id: string; label: string; rosterSize: number } } | null>(null);
  const [picks, setPicks] = useState<Pick[]>([]);
  const [guess, setGuess] = useState("");
  const [feedback, setFeedback] = useState<GuessResult | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    fetch("/api/daily?game=dig-deeper")
      .then((r) => r.json())
      .then((p) => {
        setPuz(p);
        const done = resultForToday<Summary>("dig-deeper", p.date);
        if (done) setSummary(done.summary);
        setStreak(getGameState("dig-deeper").streak);
      });
  }, []);

  const finish = useCallback((all: Pick[], breaker: Pick | undefined, label: string, date: string) => {
    const s: Summary = { date, label, picks: all, breaker, depth: all.length };
    setSummary(s);
    setStreak(recordResult("dig-deeper", date, s).streak);
  }, []);

  const last = picks.length ? picks[picks.length - 1].score : null;

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
    const pick = { player: r.player, score: r.breakdown.total };
    if (last !== null && pick.score <= last) {
      // didn't beat the last — run ends here
      finish(picks, pick, puz.prompt.label, puz.date);
      return;
    }
    const next = [...picks, pick];
    setPicks(next);
    setGuess("");
  }

  function cashOut() {
    if (!puz || summary) return;
    finish(picks, undefined, puz.prompt.label, puz.date);
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rise">
        <DailyHeader title="Dig Deeper" date={puz?.date} streak={streak} />

        {summary ? (
          <Result summary={summary} />
        ) : !puz ? (
          <Panel>
            <div className="h-8 w-2/3 rounded-lg bg-white/5 animate-pulse" />
          </Panel>
        ) : (
          <Panel>
            <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
              Depth {picks.length}
            </p>
            <h2 className="text-2xl font-semibold mt-1 tracking-tight leading-tight">
              {puz.prompt.label}
            </h2>
            <p className="text-sm text-neutral-500 mt-1">
              {last === null
                ? "Name anyone to start the climb."
                : `Each pick must beat ${last}. Keep digging.`}
            </p>

            <div className="mt-5">
              <PlayerSearchInput
                value={guess}
                onValueChange={setGuess}
                onSubmit={(n) => n.trim() && submit(n)}
                loading={loading}
                submitLabel="Dig"
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
              <ol className="mt-5 space-y-2">
                {picks.map((p, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2"
                  >
                    <span className="text-sm truncate tabular-nums">
                      {i + 1}. {p.player}
                    </span>
                    <span className="text-base font-semibold tabular-nums text-amber-300">
                      {p.score}
                    </span>
                  </li>
                ))}
              </ol>
            )}

            {picks.length > 0 && (
              <button
                onClick={cashOut}
                className="mt-4 text-sm text-neutral-500 hover:text-neutral-300 transition"
              >
                Cash out at depth {picks.length}
              </button>
            )}
          </Panel>
        )}
      </div>
    </main>
  );
}

function Result({ summary }: { summary: Summary }) {
  const share = shareDigDeeper(summary.date, summary.picks.map((p) => p.score), dailyUrl("dig-deeper"));
  return (
    <Panel className="text-center">
      <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">{summary.label}</p>
      <p className="mt-3 text-6xl font-bold tabular-nums tracking-tight text-amber-300">
        {summary.depth}
      </p>
      <p className="text-xs uppercase tracking-[0.15em] text-neutral-500 mt-1">depth reached</p>

      <div className="mt-4 text-2xl tracking-widest">
        {summary.picks.map((p) => obscuritySquare(p.score)).join("")}
      </div>

      <ol className="mt-5 space-y-2 text-left">
        {summary.picks.map((p, i) => (
          <li
            key={i}
            className="flex items-center justify-between rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2"
          >
            <span className="text-sm truncate tabular-nums">
              {i + 1}. {p.player}
            </span>
            <span className="text-base font-semibold tabular-nums text-amber-300">{p.score}</span>
          </li>
        ))}
        {summary.breaker && (
          <li className="flex items-center justify-between rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2">
            <span className="text-sm truncate text-red-300/90">{summary.breaker.player} (didn’t beat it)</span>
            <span className="text-base font-semibold tabular-nums text-red-300/90">
              {summary.breaker.score}
            </span>
          </li>
        )}
      </ol>

      <ResultActions shareText={share} />
      <ComeBack />
    </Panel>
  );
}
