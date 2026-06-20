"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { MODES, type ModeKey } from "@/lib/modes";
import { useDuel } from "@/lib/duel/useDuel";
import { PlayerSearchInput } from "@/components/PlayerSearchInput";

const BEST_OF = [3, 5, 7];

export default function DuelPage() {
  const { view, queue, submit, leave } = useDuel();
  const [name, setName] = useState("");
  const [mode, setMode] = useState<ModeKey>("modern");
  const [bestOf, setBestOf] = useState(5);
  const [guess, setGuess] = useState("");

  const you = view.duel?.players.find((p) => p.id === view.you);
  const opp = view.duel?.players.find((p) => p.id !== view.you);

  const start = () => queue(name.trim() || "You", mode, bestOf);

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rise">
        {view.status === "idle" && (
          <Entry
            name={name}
            setName={setName}
            mode={mode}
            setMode={setMode}
            bestOf={bestOf}
            setBestOf={setBestOf}
            onStart={start}
          />
        )}

        {(view.status === "connecting" || view.status === "queued") && (
          <Centered>
            <p className="text-lg font-medium">Finding an opponent…</p>
            <p className="text-sm text-neutral-500 mt-1">
              {MODES[mode].label} · best of {bestOf}
            </p>
            <button onClick={leave} className="btn-ghost mt-6 rounded-xl px-5 py-2.5 text-sm">
              Cancel
            </button>
          </Centered>
        )}

        {(view.status === "round" || view.status === "round_result") && you && opp && (
          <div>
            <Scoreline you={you} opp={opp} bestOf={bestOf} onLeave={leave} />

            {view.status === "round" && view.round && (
              <RoundCard
                label={view.round.label}
                rosterSize={view.round.rosterSize}
                deadline={view.round.deadline}
                youSubmitted={view.youSubmitted}
                opponentSubmitted={view.opponentSubmitted}
                guess={guess}
                setGuess={setGuess}
                onSubmit={(n) => {
                  submit(n);
                  setGuess("");
                }}
                roundKey={view.round.index}
              />
            )}

            {view.status === "round_result" && view.result && (
              <ResultCard
                youId={view.you!}
                result={view.result}
              />
            )}
          </div>
        )}

        {view.status === "finished" && (
          <Finished
            outcome={
              view.winnerId == null ? "draw" : view.winnerId === view.you ? "win" : "loss"
            }
            you={you}
            opp={opp}
            onAgain={start}
          />
        )}

        {view.status === "opponent_left" && (
          <Centered>
            <p className="text-lg font-medium">Opponent left.</p>
            <p className="text-sm text-neutral-500 mt-1">You take the match.</p>
            <Actions onAgain={start} />
          </Centered>
        )}

        {view.status === "error" && (
          <Centered>
            <p className="text-lg font-medium text-red-400/90">Couldn’t connect</p>
            <p className="text-sm text-neutral-500 mt-1">
              {view.error ?? "The duel server isn’t reachable."}
            </p>
            <Actions onAgain={() => leave()} againLabel="Back" />
          </Centered>
        )}
      </div>
    </main>
  );
}

// --- pieces -----------------------------------------------------------------

function Entry({
  name,
  setName,
  mode,
  setMode,
  bestOf,
  setBestOf,
  onStart,
}: {
  name: string;
  setName: (v: string) => void;
  mode: ModeKey;
  setMode: (m: ModeKey) => void;
  bestOf: number;
  setBestOf: (n: number) => void;
  onStart: () => void;
}) {
  return (
    <div>
      <header className="text-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight">
          1<span className="text-[var(--accent)]">v</span>1 Duel
        </h1>
        <p className="text-[var(--muted)] mt-2 text-[15px]">
          Same matchup, head to head. The deeper cut wins the round.
        </p>
      </header>

      <div className="rounded-[1.6rem] border border-[var(--hairline)] bg-[var(--card)] backdrop-blur p-6 shadow-2xl shadow-black/40 space-y-5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your name"
          maxLength={24}
          className="w-full rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 outline-none placeholder:text-neutral-600 focus:border-[var(--accent)]/60 transition"
        />

        <Field label="Era">
          {(Object.keys(MODES) as ModeKey[]).map((k) => (
            <Toggle key={k} active={mode === k} onClick={() => setMode(k)}>
              {MODES[k].label}
            </Toggle>
          ))}
        </Field>

        <Field label="Length">
          {BEST_OF.map((n) => (
            <Toggle key={n} active={bestOf === n} onClick={() => setBestOf(n)}>
              Best of {n}
            </Toggle>
          ))}
        </Field>

        <button onClick={onStart} className="btn-accent w-full rounded-xl py-3 text-[15px]">
          Find opponent
        </button>
      </div>

      <Link
        href="/"
        className="mt-5 block text-center text-sm text-neutral-500 hover:text-neutral-300 transition"
      >
        ← Back home
      </Link>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-[0.18em] text-neutral-500 mb-2">{label}</p>
      <div className="flex gap-2">{children}</div>
    </div>
  );
}

function Toggle({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-xl border px-3 py-2 text-sm transition ${
        active
          ? "border-[var(--accent)]/60 bg-[var(--accent)]/15 text-white"
          : "border-white/10 bg-white/5 text-neutral-400 hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

function Scoreline({
  you,
  opp,
  bestOf,
  onLeave,
}: {
  you: { name: string; wins: number; connected: boolean };
  opp: { name: string; wins: number; connected: boolean };
  bestOf: number;
  onLeave: () => void;
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={onLeave} className="text-sm text-neutral-500 hover:text-neutral-300 transition">
          ← Leave
        </button>
        <span className="text-xs text-neutral-500">best of {bestOf}</span>
      </div>
      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-3">
        <Side name={you.name} wins={you.wins} accent />
        <span className="text-xs text-neutral-600 uppercase tracking-widest">vs</span>
        <Side name={opp.name + (opp.connected ? "" : " (left)")} wins={opp.wins} alignRight />
      </div>
    </div>
  );
}

function Side({
  name,
  wins,
  accent,
  alignRight,
}: {
  name: string;
  wins: number;
  accent?: boolean;
  alignRight?: boolean;
}) {
  return (
    <div className={alignRight ? "text-right" : ""}>
      <p className={`text-sm font-medium truncate max-w-[9rem] ${accent ? "text-[var(--accent)]" : ""}`}>
        {name}
      </p>
      <p className="text-2xl font-bold tabular-nums leading-none mt-0.5">{wins}</p>
    </div>
  );
}

function RoundCard({
  label,
  rosterSize,
  deadline,
  youSubmitted,
  opponentSubmitted,
  guess,
  setGuess,
  onSubmit,
  roundKey,
}: {
  label: string;
  rosterSize: number;
  deadline: number;
  youSubmitted: boolean;
  opponentSubmitted: boolean;
  guess: string;
  setGuess: (v: string) => void;
  onSubmit: (n: string) => void;
  roundKey: number;
}) {
  const remaining = useCountdown(deadline);
  return (
    <div className="rounded-[1.6rem] border border-[var(--hairline)] bg-[var(--card)] backdrop-blur p-6 shadow-2xl shadow-black/40">
      <div className="flex items-center justify-between">
        <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Round</p>
        <span className="text-sm tabular-nums text-neutral-400">{remaining}s</span>
      </div>
      <h2 className="text-2xl font-semibold mt-1 tracking-tight leading-tight">{label}</h2>
      <p className="text-sm text-neutral-500 mt-1">{rosterSize} players to choose from</p>

      <div className="mt-5">
        {youSubmitted ? (
          <p className="text-center text-neutral-400 py-3">
            Locked in. Waiting for opponent…
          </p>
        ) : (
          <PlayerSearchInput
            key={roundKey}
            value={guess}
            onValueChange={setGuess}
            onSubmit={(n) => n.trim() && onSubmit(n)}
            submitLabel="Lock in"
          />
        )}
      </div>

      <div className="mt-4 flex items-center gap-2 text-xs text-neutral-500">
        <Dot on={youSubmitted} /> You
        <span className="mx-1" />
        <Dot on={opponentSubmitted} /> Opponent
      </div>
    </div>
  );
}

function ResultCard({
  youId,
  result,
}: {
  youId: string;
  result: import("@/lib/duel/types").PublicRoundResult;
}) {
  const yours = result.picks.find((p) => p.playerId === youId);
  const theirs = result.picks.find((p) => p.playerId !== youId);
  const verdict =
    result.winnerId == null ? "Tie round" : result.winnerId === youId ? "You won the round" : "Opponent won the round";

  return (
    <div className="rounded-[1.6rem] border border-[var(--hairline)] bg-[var(--card)] backdrop-blur p-6 shadow-2xl shadow-black/40">
      <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">{result.label}</p>
      <h2
        className={`text-xl font-semibold mt-1 ${
          result.winnerId === youId
            ? "text-[var(--accent)]"
            : result.winnerId == null
              ? "text-sky-300"
              : "text-neutral-300"
        }`}
      >
        {verdict}
      </h2>

      <div className="mt-4 space-y-2">
        <PickRow pick={yours} label="You" highlight={result.winnerId === youId} />
        <PickRow pick={theirs} label="Opponent" highlight={result.winnerId != null && result.winnerId !== youId} />
      </div>

      <p className="mt-4 text-center text-xs text-neutral-600">Next round starting…</p>
    </div>
  );
}

function PickRow({
  pick,
  label,
  highlight,
}: {
  pick?: import("@/lib/duel/types").RevealedPick;
  label: string;
  highlight: boolean;
}) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl border px-4 py-3 ${
        highlight ? "border-[var(--accent)]/40 bg-[var(--accent)]/10" : "border-white/5 bg-white/[0.03]"
      }`}
    >
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-widest text-neutral-500">{label}</p>
        <p className="text-sm font-medium truncate">
          {pick?.matched ? pick.player : pick?.guess ? `“${pick.guess}” — no match` : "— no pick"}
        </p>
      </div>
      <span className="text-xl font-bold tabular-nums shrink-0 pl-3">{pick?.obscurity ?? 0}</span>
    </div>
  );
}

function Finished({
  outcome,
  you,
  opp,
  onAgain,
}: {
  outcome: "win" | "loss" | "draw";
  you?: { name: string; wins: number };
  opp?: { name: string; wins: number };
  onAgain: () => void;
}) {
  const title = outcome === "win" ? "You win" : outcome === "loss" ? "You lost" : "Dead heat";
  const accent =
    outcome === "win" ? "text-[var(--accent)]" : outcome === "draw" ? "text-sky-300" : "text-neutral-300";
  return (
    <Centered>
      <p className="text-[11px] uppercase tracking-[0.2em] text-neutral-500">Match over</p>
      <h1 className={`text-4xl font-bold tracking-tight mt-2 ${accent}`}>{title}</h1>
      {you && opp && (
        <p className="mt-3 text-2xl font-semibold tabular-nums">
          {you.wins} <span className="text-neutral-600">–</span> {opp.wins}
        </p>
      )}
      <Actions onAgain={onAgain} />
    </Centered>
  );
}

function Actions({
  onAgain,
  againLabel = "Play again",
}: {
  onAgain: () => void;
  againLabel?: string;
}) {
  return (
    <div className="mt-6 flex gap-2 w-full">
      <button onClick={onAgain} className="btn-accent flex-1 rounded-xl py-2.5">
        {againLabel}
      </button>
      <Link href="/" className="btn-ghost flex-1 rounded-xl py-2.5 text-center font-medium">
        Home
      </Link>
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[1.6rem] border border-[var(--hairline)] bg-[var(--card)] backdrop-blur p-8 shadow-2xl shadow-black/40 text-center flex flex-col items-center">
      {children}
    </div>
  );
}

function Dot({ on }: { on: boolean }) {
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${on ? "bg-[var(--accent)]" : "bg-white/15"}`}
    />
  );
}

function useCountdown(deadline: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(t);
  }, []);
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}
