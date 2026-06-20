"use client";

import { useCallback, useEffect, useState } from "react";
import { DailyHeader, Panel, ResultActions, ComeBack } from "@/components/daily/ui";
import { getGameState, recordResult, resultForToday } from "@/lib/daily/storage";
import { shareConnect, dailyUrl, CONNECT_COLORS } from "@/lib/daily/share";

const MAX_MISTAKES = 4;
// On-screen group tints, aligned with CONNECT_COLORS share emojis (violet/sky/emerald/amber).
const TINTS = [
  "border-violet-400/40 bg-violet-400/15 text-violet-100",
  "border-sky-400/40 bg-sky-400/15 text-sky-100",
  "border-emerald-400/40 bg-emerald-400/15 text-emerald-100",
  "border-amber-400/40 bg-amber-400/15 text-amber-100",
];

interface SolvedGroup {
  label: string;
  members: string[];
  groupIndex: number;
}
interface Summary {
  date: string;
  groups: { label: string; members: string[] }[]; // full solution, index order
  guesses: string[][];
  solved: number;
  won: boolean;
}

export default function ConnectPage() {
  const [puz, setPuz] = useState<{ date: string; tiles: string[] } | null>(null);
  const [tiles, setTiles] = useState<string[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [solved, setSolved] = useState<SolvedGroup[]>([]);
  const [mistakes, setMistakes] = useState(0);
  const [guesses, setGuesses] = useState<string[][]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    fetch("/api/daily?game=connect")
      .then((r) => r.json())
      .then((p) => {
        setPuz(p);
        setTiles(p.tiles);
        const done = resultForToday<Summary>("connect", p.date);
        if (done) setSummary(done.summary);
        setStreak(getGameState("connect").streak);
      });
  }, []);

  const finish = useCallback(
    async (date: string, solvedGroups: SolvedGroup[], allGuesses: string[][], won: boolean) => {
      const rev = await fetch("/api/daily/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reveal: true }),
      })
        .then((r) => r.json())
        .catch(() => ({ groups: [] }));
      const groups: { label: string; members: string[] }[] = rev.groups ?? [];
      const s: Summary = { date, groups, guesses: allGuesses, solved: solvedGroups.length, won };
      setSummary(s);
      setStreak(recordResult("connect", date, s).streak);
    },
    [],
  );

  function toggle(tile: string) {
    if (summary || loading) return;
    setNote(null);
    setSelected((sel) =>
      sel.includes(tile) ? sel.filter((t) => t !== tile) : sel.length < 4 ? [...sel, tile] : sel,
    );
  }

  async function submit() {
    if (!puz || summary || loading || selected.length !== 4) return;
    setLoading(true);
    const r = await fetch("/api/daily/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names: selected }),
    }).then((res) => res.json());
    setLoading(false);

    const nextGuesses = [...guesses, [...selected]];
    setGuesses(nextGuesses);

    if (r.correct) {
      const group: SolvedGroup = { label: r.label, members: r.members, groupIndex: r.groupIndex };
      const nextSolved = [...solved, group];
      setSolved(nextSolved);
      setTiles((t) => t.filter((x) => !selected.includes(x)));
      setSelected([]);
      setNote(null);
      if (nextSolved.length === 4) finish(puz.date, nextSolved, nextGuesses, true);
    } else {
      const m = mistakes + 1;
      setMistakes(m);
      setNote(r.oneAway ? "One away…" : "Not a group.");
      if (m >= MAX_MISTAKES) finish(puz.date, solved, nextGuesses, false);
    }
  }

  return (
    <main className="min-h-dvh flex flex-col items-center justify-center px-4 py-8">
      <div className="w-full max-w-md rise">
        <DailyHeader title="Connect" date={puz?.date} streak={streak} />

        {summary ? (
          <Result summary={summary} />
        ) : !puz ? (
          <Panel>
            <div className="h-8 w-2/3 rounded-lg bg-white/5 animate-pulse" />
          </Panel>
        ) : (
          <Panel>
            <p className="text-sm text-neutral-400">
              Make four groups of teammates — same franchise & era.
            </p>

            {/* solved groups */}
            <div className="mt-4 space-y-2">
              {solved.map((g) => (
                <div key={g.groupIndex} className={`rounded-xl border px-3 py-2 ${TINTS[g.groupIndex]}`}>
                  <p className="text-[11px] uppercase tracking-widest opacity-80">{g.label}</p>
                  <p className="text-sm font-medium">{g.members.join(" · ")}</p>
                </div>
              ))}
            </div>

            {/* tile grid */}
            {tiles.length > 0 && (
              <div className="mt-3 grid grid-cols-2 gap-2">
                {tiles.map((t) => {
                  const on = selected.includes(t);
                  return (
                    <button
                      key={t}
                      onClick={() => toggle(t)}
                      className={`rounded-xl border px-2.5 py-3 text-sm text-center leading-tight min-h-[3rem] transition ${
                        on
                          ? "border-[var(--accent)]/70 bg-[var(--accent)]/20 text-white"
                          : "border-white/10 bg-white/5 text-neutral-200 hover:bg-white/10"
                      }`}
                    >
                      {t}
                    </button>
                  );
                })}
              </div>
            )}

            {/* mistakes */}
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
              onClick={submit}
              disabled={selected.length !== 4 || loading}
              className="btn-accent mt-4 w-full rounded-xl py-2.5"
            >
              {loading ? "…" : "Submit group"}
            </button>
          </Panel>
        )}
      </div>
    </main>
  );
}

function Result({ summary }: { summary: Summary }) {
  // map each tile name -> its true group index, to colour past guesses
  const groupOf = new Map<string, number>();
  summary.groups.forEach((g, i) => g.members.forEach((m) => groupOf.set(m, i)));
  const rows = summary.guesses.map((names) => names.map((n) => groupOf.get(n) ?? -1));
  const share = shareConnect(summary.date, rows, summary.solved, dailyUrl("connect"));

  return (
    <Panel className="text-center">
      <h2 className={`text-2xl font-bold tracking-tight ${summary.won ? "text-emerald-300" : "text-neutral-300"}`}>
        {summary.won ? "Solved it" : "Out of guesses"}
      </h2>
      <p className="text-sm text-neutral-500 mt-1">{summary.solved}/4 groups</p>

      {/* the solution */}
      <div className="mt-4 space-y-2 text-left">
        {summary.groups.map((g, i) => (
          <div key={i} className={`rounded-xl border px-3 py-2 ${TINTS[i]}`}>
            <p className="text-[11px] uppercase tracking-widest opacity-80">{g.label}</p>
            <p className="text-sm font-medium">{g.members.join(" · ")}</p>
          </div>
        ))}
      </div>

      {/* guess grid */}
      <div className="mt-4 text-xl leading-relaxed">
        {rows.map((row, i) => (
          <div key={i}>{row.map((g) => (g < 0 ? "⬛" : CONNECT_COLORS[g])).join("")}</div>
        ))}
      </div>

      <ResultActions shareText={share} />
      <ComeBack />
    </Panel>
  );
}
