"use client";

import { useCallback, useEffect, useState } from "react";
import { PlayerSearchInput } from "@/components/PlayerSearchInput";
import { DailyHeader, Panel, ResultActions, ComeBack } from "@/components/daily/ui";
import { getGameState, recordResult, resultForToday } from "@/lib/daily/storage";
import { shareLink, dailyUrl } from "@/lib/daily/share";

interface Puz {
  date: string;
  a: string;
  b: string;
  par: number;
}
interface Summary {
  date: string;
  a: string;
  b: string;
  par: number;
  bridges: number;
  solved: boolean;
  path: string[]; // full path a..b (yours if solved, else a revealed one)
}

export default function LinkPage() {
  const [puz, setPuz] = useState<Puz | null>(null);
  const [bridges, setBridges] = useState<string[]>([]);
  const [guess, setGuess] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    fetch("/api/daily?game=link")
      .then((r) => r.json())
      .then((p) => {
        setPuz(p);
        const done = resultForToday<Summary>("link", p.date);
        if (done) setSummary(done.summary);
        setStreak(getGameState("link").streak);
      });
  }, []);

  const finish = useCallback(
    async (p: Puz, finalBridges: string[], solved: boolean) => {
      let path = [p.a, ...finalBridges, p.b];
      if (!solved) {
        const rev = await fetch("/api/daily/link", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reveal: true }),
        })
          .then((r) => r.json())
          .catch(() => ({ path: [] }));
        if (rev.path?.length) path = rev.path;
      }
      const s: Summary = {
        date: p.date,
        a: p.a,
        b: p.b,
        par: p.par,
        bridges: finalBridges.length,
        solved,
        path,
      };
      setSummary(s);
      setStreak(recordResult("link", p.date, s).streak);
    },
    [],
  );

  async function add(name: string) {
    if (!puz || summary || loading) return;
    const prev = bridges.length ? bridges[bridges.length - 1] : puz.a;
    if (name === puz.a || name === puz.b || bridges.includes(name)) {
      setNote("Already in the chain.");
      return;
    }
    setLoading(true);
    const r = await fetch("/api/daily/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chain: [prev, name, puz.b] }),
    }).then((res) => res.json());
    setLoading(false);

    const linkedToPrev = r.links?.[0];
    const linkedToB = r.links?.[1];
    if (!linkedToPrev) {
      setNote(`${name} and ${prev} were never teammates.`);
      return;
    }
    const next = [...bridges, name];
    setBridges(next);
    setGuess("");
    setNote(null);
    if (linkedToB) finish(puz, next, true);
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rise">
        <DailyHeader title="Link Up" date={puz?.date} streak={streak} />

        {summary ? (
          <Result summary={summary} />
        ) : !puz ? (
          <Panel>
            <div className="h-8 w-2/3 rounded-lg bg-white/5 animate-pulse" />
          </Panel>
        ) : (
          <Panel>
            <p className="text-sm text-neutral-400">
              Link these two through teammates. Each name must have played with the one before it.
            </p>

            <div className="mt-4 space-y-1">
              <Node name={puz.a} tone="end" />
              {bridges.map((bspan, i) => (
                <div key={i}>
                  <Connector ok />
                  <Node name={bspan} tone="bridge" />
                </div>
              ))}
              <Connector ok={false} />
              <Node name={puz.b} tone="target" />
            </div>

            <div className="mt-4">
              <PlayerSearchInput
                value={guess}
                onValueChange={setGuess}
                onSubmit={(n) => n.trim() && add(n)}
                loading={loading}
                submitLabel="Add"
                placeholder={`Teammate of ${bridges.length ? bridges[bridges.length - 1] : puz.a}…`}
              />
            </div>

            {note && <p className="mt-2 text-sm text-amber-300/90">{note}</p>}

            <div className="mt-4 flex items-center justify-between text-sm text-neutral-500">
              <span>
                Bridges: <span className="tabular-nums text-neutral-300">{bridges.length}</span>{" "}
                <span className="text-neutral-600">(par {puz.par})</span>
              </span>
              <button onClick={() => finish(puz, bridges, false)} className="hover:text-neutral-300 transition">
                Give up
              </button>
            </div>
          </Panel>
        )}
      </div>
    </main>
  );
}

function Node({ name, tone }: { name: string; tone: "end" | "bridge" | "target" }) {
  const cls =
    tone === "end"
      ? "border-sky-300/40 bg-sky-300/15 text-sky-100 font-semibold"
      : tone === "target"
        ? "border-white/15 bg-white/[0.04] text-neutral-300 font-semibold"
        : "border-emerald-300/30 bg-emerald-300/10 text-emerald-100";
  return <div className={`rounded-xl border px-3 py-2 text-sm ${cls}`}>{name}</div>;
}

function Connector({ ok }: { ok: boolean }) {
  return (
    <div className="flex justify-center py-0.5 text-sm">
      {ok ? <span className="text-emerald-400">↓</span> : <span className="text-neutral-600">↓</span>}
    </div>
  );
}

function Result({ summary }: { summary: Summary }) {
  const share = shareLink(summary.date, summary.bridges, summary.par, summary.solved, dailyUrl("link"));
  return (
    <Panel className="text-center">
      <h2 className={`text-2xl font-bold tracking-tight ${summary.solved ? "text-sky-300" : "text-neutral-300"}`}>
        {summary.solved ? "Linked up" : "Couldn’t connect"}
      </h2>
      <p className="text-sm text-neutral-500 mt-1">
        {summary.solved
          ? `${summary.bridges} bridge${summary.bridges === 1 ? "" : "s"} · par ${summary.par}`
          : "Here’s one path that works"}
      </p>

      <div className="mt-4 space-y-1 text-left">
        {summary.path.map((name, i) => (
          <div key={i}>
            {i > 0 && <div className="flex justify-center py-0.5 text-emerald-400 text-sm">↓</div>}
            <div
              className={`rounded-xl border px-3 py-2 text-sm ${
                i === 0 || i === summary.path.length - 1
                  ? "border-sky-300/40 bg-sky-300/15 text-sky-100 font-semibold"
                  : "border-white/10 bg-white/[0.03]"
              }`}
            >
              {name}
            </div>
          </div>
        ))}
      </div>

      <ResultActions shareText={share} />
      <ComeBack />
    </Panel>
  );
}
