"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { GuessResult } from "@/lib/types";
import { MODES, ROUNDS_PER_GAME, type ModeKey } from "@/lib/modes";
import { tierFor } from "@/lib/tiers";
import { saveGame, type PlayedRound } from "@/lib/storage";
import { ScoreBar } from "./ScoreBar";

interface PromptDTO {
  id: string;
  label: string;
  rosterSize: number;
}

export function Game({ mode }: { mode: ModeKey }) {
  const [prompt, setPrompt] = useState<PromptDTO | null>(null);
  const [guess, setGuess] = useState("");
  const [result, setResult] = useState<GuessResult | null>(null);
  const [loading, setLoading] = useState(false);

  const [roundIndex, setRoundIndex] = useState(0);
  const [answers, setAnswers] = useState<PlayedRound[]>([]);
  const [finished, setFinished] = useState(false);
  const [isHigh, setIsHigh] = useState(false);

  const loadRound = useCallback(async () => {
    setResult(null);
    setGuess("");
    setPrompt(null);
    const res = await fetch(`/api/prompt?mode=${mode}`);
    setPrompt(await res.json());
  }, [mode]);

  useEffect(() => {
    loadRound();
  }, [loadRound]);

  async function submitName(name: string) {
    if (!prompt || !name.trim() || loading || result?.valid) return;
    setLoading(true);
    const res = await fetch("/api/guess", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: prompt.id, name }),
    });
    setResult(await res.json());
    setLoading(false);
  }

  function finishGame(allAnswers: PlayedRound[]) {
    const avg =
      Math.round(
        (allAnswers.reduce((s, a) => s + a.score, 0) / allAnswers.length) * 10,
      ) / 10;
    const high = saveGame({ mode, avg, date: Date.now(), rounds: allAnswers });
    setIsHigh(high);
    setFinished(true);
  }

  function advance(answer: PlayedRound) {
    const next = [...answers, answer];
    setAnswers(next);
    if (next.length >= ROUNDS_PER_GAME) {
      finishGame(next);
    } else {
      setRoundIndex((r) => r + 1);
      loadRound();
    }
  }

  function nextAfterReveal() {
    if (!prompt || !result?.valid || !result.breakdown) return;
    advance({
      label: prompt.label,
      player: result.player ?? "—",
      score: result.breakdown.total,
    });
  }

  function giveUp() {
    if (!prompt) return;
    advance({ label: prompt.label, player: "—", score: 0 });
  }

  function playAgain() {
    setAnswers([]);
    setRoundIndex(0);
    setFinished(false);
    setIsHigh(false);
    loadRound();
  }

  const avg = answers.length
    ? answers.reduce((s, a) => s + a.score, 0) / answers.length
    : 0;

  if (finished) {
    return (
      <Results
        mode={mode}
        avg={
          Math.round(
            (answers.reduce((s, a) => s + a.score, 0) / answers.length) * 10,
          ) / 10
        }
        rounds={answers}
        isHigh={isHigh}
        onPlayAgain={playAgain}
      />
    );
  }

  return (
    <div className="w-full max-w-md rise">
      {/* progress */}
      <div className="flex items-center justify-between mb-4">
        <Link href="/" className="text-sm text-neutral-500 hover:text-neutral-300 transition">
          ← Back
        </Link>
        <div className="flex items-center gap-1.5">
          {Array.from({ length: ROUNDS_PER_GAME }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 w-6 rounded-full transition-colors ${
                i < answers.length
                  ? "bg-[var(--accent)]"
                  : i === roundIndex
                    ? "bg-neutral-400"
                    : "bg-white/10"
              }`}
            />
          ))}
        </div>
        <span className="text-sm text-neutral-500 tabular-nums">
          {roundIndex + 1}/{ROUNDS_PER_GAME}
        </span>
      </div>

      <div className="rounded-[1.6rem] border border-[var(--hairline)] bg-[var(--card)] backdrop-blur p-6 shadow-2xl shadow-black/40">
        <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
          {MODES[mode].label} · Round {roundIndex + 1}
        </p>

        {!prompt ? (
          <div className="h-8 mt-2 w-2/3 rounded-lg bg-white/5 animate-pulse" />
        ) : (
          <h2 className="text-2xl font-semibold mt-1 tracking-tight leading-tight">
            {prompt.label}
          </h2>
        )}
        {prompt && (
          <p className="text-sm text-neutral-500 mt-1">
            {prompt.rosterSize} players to choose from
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitName(guess);
          }}
          className="mt-5 flex gap-2"
        >
          <input
            autoFocus
            value={guess}
            onChange={(e) => setGuess(e.target.value)}
            placeholder="Name a player…"
            disabled={!prompt || result?.valid}
            className="flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 outline-none placeholder:text-neutral-600 focus:border-[var(--accent)]/60 focus:bg-white/[0.07] transition disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !prompt || result?.valid}
            className="rounded-xl bg-[var(--accent)] text-black font-semibold hover:brightness-110 active:scale-[0.98] px-5 py-2.5 transition disabled:opacity-40 disabled:brightness-100"
          >
            {loading ? "…" : "Guess"}
          </button>
        </form>

        {!result?.valid && (
          <p className="mt-2 text-xs text-neutral-600">
            Last name, first name or nickname all work.
          </p>
        )}

        {result && !result.valid && result.suggestion && (
          <p className="mt-3 text-sm text-neutral-400">
            Did you mean{" "}
            <button
              onClick={() => {
                setGuess(result.suggestion!);
                submitName(result.suggestion!);
              }}
              className="font-medium text-[var(--accent)] underline underline-offset-2 hover:brightness-110"
            >
              {result.suggestion}
            </button>
            ?
          </p>
        )}
        {result && !result.valid && !result.suggestion && (
          <p className="mt-3 text-sm text-red-400/90">{result.message}</p>
        )}

        {result?.valid && result.breakdown && <Reveal result={result} />}
      </div>

      <div className="mt-4 flex items-center justify-between text-sm">
        {result?.valid ? (
          <button
            onClick={nextAfterReveal}
            className="w-full rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 py-2.5 font-medium transition"
          >
            {answers.length + 1 >= ROUNDS_PER_GAME ? "See results →" : "Next round →"}
          </button>
        ) : (
          <button
            onClick={giveUp}
            className="text-neutral-500 hover:text-neutral-300 transition"
          >
            Skip round (0 pts)
          </button>
        )}
      </div>

      {answers.length > 0 && (
        <p className="mt-3 text-center text-xs text-neutral-600">
          Average so far{" "}
          <span className="text-neutral-400 font-medium tabular-nums">
            {avg.toFixed(1)}
          </span>
        </p>
      )}
    </div>
  );
}

function Reveal({ result }: { result: GuessResult }) {
  const b = result.breakdown!;
  return (
    <div className="mt-5 border-t border-white/10 pt-4">
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-medium text-[var(--accent)]">{result.player}</span>
        <span className="text-4xl font-bold tabular-nums">{b.total}</span>
      </div>
      <p className="text-sm text-neutral-500 mt-0.5">
        No. {result.rank} most obscure of {result.rosterSize} who played here
      </p>

      <div className="mt-4 space-y-2.5">
        <ScoreBar label="Unknown today" value={b.fame} />
        <ScoreBar label="Undecorated here" value={b.notability} />
        <ScoreBar label="Few games here" value={b.career} />
        <ScoreBar label="Low output here" value={b.production} />
      </div>

      {result.ranked && (
        <details className="mt-4 group">
          <summary className="cursor-pointer text-sm text-neutral-500 hover:text-neutral-300 list-none">
            <span className="group-open:hidden">Show full ranking ›</span>
            <span className="hidden group-open:inline">Hide ranking ⌄</span>
          </summary>
          <ol className="mt-2 max-h-56 overflow-y-auto text-sm space-y-1 pr-1">
            {result.ranked.map((r, i) => (
              <li
                key={r.name}
                className={`flex justify-between ${
                  r.name === result.player
                    ? "text-[var(--accent)] font-medium"
                    : "text-neutral-500"
                }`}
              >
                <span className="tabular-nums">
                  {i + 1}. {r.name}
                </span>
                <span className="tabular-nums">{r.score}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

function Results({
  mode,
  avg,
  rounds,
  isHigh,
  onPlayAgain,
}: {
  mode: ModeKey;
  avg: number;
  rounds: PlayedRound[];
  isHigh: boolean;
  onPlayAgain: () => void;
}) {
  const tier = tierFor(avg);
  return (
    <div className="w-full max-w-md rise">
      <div className="rounded-[1.6rem] border border-[var(--hairline)] bg-[var(--card)] backdrop-blur p-7 shadow-2xl shadow-black/40 text-center">
        <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">
          {MODES[mode].label} · {rounds.length} rounds
        </p>
        {isHigh && (
          <p className="mt-2 inline-block rounded-full bg-[var(--accent)]/15 px-3 py-1 text-xs font-medium text-[var(--accent)]">
            New personal best
          </p>
        )}
        <p className="mt-3 text-6xl font-bold tabular-nums tracking-tight">{avg}</p>
        <p className="text-xs uppercase tracking-[0.15em] text-neutral-500 mt-1">
          average score
        </p>
        <h2 className={`mt-4 text-2xl font-semibold tracking-tight ${tier.accent}`}>
          {tier.name}
        </h2>
        <p className="text-sm text-neutral-500 mt-1">avg {tier.blurb}</p>

        <ul className="mt-6 space-y-2 text-left">
          {rounds.map((r, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 rounded-xl bg-white/[0.03] border border-white/5 px-3 py-2"
            >
              <div className="min-w-0">
                <p className="text-sm truncate">{r.player}</p>
                <p className="text-xs text-neutral-500 truncate">{r.label}</p>
              </div>
              <span className="text-lg font-semibold tabular-nums shrink-0">
                {r.score}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 flex gap-2">
        <button
          onClick={onPlayAgain}
          className="flex-1 rounded-xl bg-[var(--accent)] text-black hover:brightness-110 active:scale-[0.98] py-2.5 font-semibold transition"
        >
          Play again
        </button>
        <Link
          href="/"
          className="flex-1 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 py-2.5 font-medium transition text-center"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
