"use client";

import { useCallback, useEffect, useState } from "react";
import { DailyHeader, Panel, ResultActions, ComeBack } from "@/components/daily/ui";
import { getGameState, recordResult, resultForToday } from "@/lib/daily/storage";
import { shareChain, dailyUrl } from "@/lib/daily/share";

const MAX_MISTAKES = 4;

interface Summary {
  date: string;
  length: number;
  solved: boolean;
  tries: number;
  chain: string[]; // a valid solution order (yours if solved, else revealed)
}

export default function ChainPage() {
  const [puz, setPuz] = useState<{ date: string; tiles: string[]; length: number } | null>(null);
  const [order, setOrder] = useState<string[]>([]);
  const [links, setLinks] = useState<boolean[] | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    fetch("/api/daily?game=chain")
      .then((r) => r.json())
      .then((p) => {
        setPuz(p);
        const done = resultForToday<Summary>("chain", p.date);
        if (done) setSummary(done.summary);
        setStreak(getGameState("chain").streak);
      });
  }, []);

  const pool = puz ? puz.tiles.filter((t) => !order.includes(t)) : [];

  const finish = useCallback(
    async (date: string, length: number, solved: boolean, tries: number, yourOrder: string[]) => {
      let chain = yourOrder;
      if (!solved) {
        const rev = await fetch("/api/daily/chain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reveal: true }),
        })
          .then((r) => r.json())
          .catch(() => ({ solution: yourOrder }));
        chain = rev.solution ?? yourOrder;
      }
      const s: Summary = { date, length, solved, tries, chain };
      setSummary(s);
      setStreak(recordResult("chain", date, s).streak);
    },
    [],
  );

  function place(tile: string) {
    if (summary) return;
    setNote(null);
    setLinks(null);
    setOrder((o) => (o.includes(tile) ? o : [...o, tile]));
  }
  function remove(tile: string) {
    if (summary) return;
    setNote(null);
    setLinks(null);
    setOrder((o) => o.filter((t) => t !== tile));
  }

  async function check() {
    if (!puz || summary || loading || order.length !== puz.length) return;
    setLoading(true);
    const r = await fetch("/api/daily/chain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ order }),
    }).then((res) => res.json());
    setLoading(false);
    setLinks(r.links);

    const tries = mistakes + 1;
    if (r.solved) {
      finish(puz.date, puz.length, true, tries, order);
    } else {
      setMistakes(tries);
      const bad = r.links.filter((l: boolean) => !l).length;
      setNote(bad === 1 ? "One link is wrong." : `${bad} links are wrong.`);
      if (tries >= MAX_MISTAKES) finish(puz.date, puz.length, false, tries, order);
    }
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rise">
        <DailyHeader title="Chain" date={puz?.date} streak={streak} />

        {summary ? (
          <Result summary={summary} />
        ) : !puz ? (
          <Panel>
            <div className="h-8 w-2/3 rounded-lg bg-white/5 animate-pulse" />
          </Panel>
        ) : (
          <Panel>
            <p className="text-sm text-neutral-400">
              Order all {puz.length} so every neighbour was a teammate (same team, same era).
            </p>

            {/* chain so far */}
            <div className="mt-4 space-y-1">
              {order.map((t, i) => (
                <div key={t}>
                  <button
                    onClick={() => remove(t)}
                    className="w-full flex items-center justify-between rounded-xl border border-[var(--accent)]/40 bg-[var(--accent)]/15 px-3 py-2 text-sm"
                  >
                    <span className="truncate">
                      <span className="tabular-nums text-neutral-500">{i + 1}. </span>
                      {t}
                    </span>
                    <span className="text-neutral-500 text-xs shrink-0 pl-2">tap to remove</span>
                  </button>
                  {i < order.length - 1 && (
                    <div className="flex justify-center py-0.5 text-sm">
                      {links ? (links[i] ? <span className="text-emerald-400">✓</span> : <span className="text-red-400">✕</span>) : <span className="text-neutral-600">│</span>}
                    </div>
                  )}
                </div>
              ))}
              {order.length === 0 && (
                <p className="text-sm text-neutral-600 py-2">Tap players below to build the chain.</p>
              )}
            </div>

            {/* pool */}
            {pool.length > 0 && (
              <div className="mt-4 grid grid-cols-2 gap-2">
                {pool.map((t) => (
                  <button
                    key={t}
                    onClick={() => place(t)}
                    className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-3 text-sm text-center leading-tight min-h-[3rem] hover:bg-white/10 transition"
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center justify-center gap-2">
              <span className="text-xs text-neutral-500">Mistakes</span>
              {Array.from({ length: MAX_MISTAKES }).map((_, i) => (
                <span
                  key={i}
                  className={`h-2.5 w-2.5 rounded-full ${i < mistakes ? "bg-red-400" : "bg-white/15"}`}
                />
              ))}
            </div>

            {note && <p className="mt-3 text-center text-sm text-amber-300/90">{note}</p>}

            <button
              onClick={check}
              disabled={order.length !== puz.length || loading}
              className="btn-accent mt-4 w-full rounded-xl py-2.5"
            >
              {loading ? "…" : "Check chain"}
            </button>
          </Panel>
        )}
      </div>
    </main>
  );
}

function Result({ summary }: { summary: Summary }) {
  const share = shareChain(summary.date, summary.length, summary.tries, summary.solved, dailyUrl("chain"));
  return (
    <Panel className="text-center">
      <h2 className={`text-2xl font-bold tracking-tight ${summary.solved ? "text-emerald-300" : "text-neutral-300"}`}>
        {summary.solved ? "Chained it" : "Out of tries"}
      </h2>
      <p className="text-sm text-neutral-500 mt-1">
        {summary.solved
          ? `${summary.length}-player chain in ${summary.tries} ${summary.tries === 1 ? "try" : "tries"}`
          : "Here’s one that works"}
      </p>

      <ol className="mt-4 space-y-1 text-left">
        {summary.chain.map((name, i) => (
          <li key={i}>
            <div className="rounded-xl border border-violet-300/30 bg-violet-300/10 px-3 py-2 text-sm">
              <span className="tabular-nums text-neutral-500">{i + 1}. </span>
              {name}
            </div>
            {i < summary.chain.length - 1 && (
              <div className="flex justify-center py-0.5 text-emerald-400 text-sm">✓</div>
            )}
          </li>
        ))}
      </ol>

      <ResultActions shareText={share} />
      <ComeBack />
    </Panel>
  );
}
