"use client";

import { useEffect, useMemo, useState } from "react";
import { normalizeName } from "@/lib/match";

interface IndexEntry {
  name: string;
  terms: string[]; // normalized name + aliases, for matching
}

// The league-wide name list is the same everywhere, so fetch + normalize it
// once and keep it across remounts. Shared by single-player and duel modes.
let PLAYER_INDEX: IndexEntry[] | null = null;
const MAX_SUGGESTIONS = 8;

/** Up to 8 player names matching the query, best matches first. */
function suggestFrom(index: IndexEntry[], value: string): string[] {
  const q = normalizeName(value);
  if (q.length < 2 || index.length === 0) return [];
  const starts: string[] = []; // full name starts with query
  const wordStarts: string[] = []; // a name/alias word starts with query
  const contains: string[] = []; // appears anywhere
  for (const item of index) {
    let rank = 3;
    for (const t of item.terms) {
      if (t.startsWith(q)) { rank = 0; break; }
      if (rank > 1 && t.split(" ").some((w) => w.startsWith(q))) rank = 1;
      else if (rank > 2 && t.includes(q)) rank = 2;
    }
    if (rank === 0) starts.push(item.name);
    else if (rank === 1) wordStarts.push(item.name);
    else if (rank === 2) contains.push(item.name);
  }
  return [...starts, ...wordStarts, ...contains].slice(0, MAX_SUGGESTIONS);
}

interface Props {
  value: string;
  onValueChange: (v: string) => void;
  /** Fired on Enter (typed text) or when a suggestion is chosen. */
  onSubmit: (name: string) => void;
  disabled?: boolean;
  loading?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  submitLabel?: string;
}

/**
 * Text input with a league-wide player typeahead. It suggests from EVERY player
 * (not any one roster) so it only aids spelling/recall without revealing
 * answers. Controlled: the parent owns the value.
 */
export function PlayerSearchInput({
  value,
  onValueChange,
  onSubmit,
  disabled = false,
  loading = false,
  autoFocus = true,
  placeholder = "Name a player…",
  submitLabel = "Guess",
}: Props) {
  const [index, setIndex] = useState<IndexEntry[]>(PLAYER_INDEX ?? []);
  const [showSuggest, setShowSuggest] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  useEffect(() => {
    if (PLAYER_INDEX) return;
    let cancelled = false;
    fetch("/api/players")
      .then((r) => r.json())
      .then((list: { name: string; alt?: string[] }[]) => {
        PLAYER_INDEX = list.map((p) => ({
          name: p.name,
          terms: [normalizeName(p.name), ...(p.alt ?? []).map(normalizeName)],
        }));
        if (!cancelled) setIndex(PLAYER_INDEX);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const suggestions = useMemo(
    () => (showSuggest && !disabled ? suggestFrom(index, value) : []),
    [showSuggest, disabled, index, value],
  );

  function pick(name: string) {
    onValueChange(name);
    setShowSuggest(false);
    setActiveIdx(-1);
    onSubmit(name);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!showSuggest || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, -1));
    } else if (e.key === "Enter" && activeIdx >= 0) {
      e.preventDefault(); // pick the highlighted name instead of submitting raw text
      pick(suggestions[activeIdx]);
    } else if (e.key === "Escape") {
      setShowSuggest(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setShowSuggest(false);
        onSubmit(value);
      }}
      className="relative"
      autoComplete="off"
    >
      <div className="flex gap-2">
        <input
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => {
            onValueChange(e.target.value);
            setShowSuggest(true);
            setActiveIdx(-1);
          }}
          onFocus={() => setShowSuggest(true)}
          onBlur={() => setShowSuggest(false)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          role="combobox"
          aria-expanded={suggestions.length > 0}
          aria-autocomplete="list"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-xl bg-white/5 border border-white/10 px-4 py-2.5 outline-none placeholder:text-neutral-600 focus:border-[var(--accent)]/60 focus:bg-white/[0.07] transition disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={disabled || loading}
          className="btn-accent shrink-0 rounded-xl px-5 py-2.5"
        >
          {loading ? "…" : submitLabel}
        </button>
      </div>

      {suggestions.length > 0 && (
        <ul className="absolute z-20 left-0 right-0 top-full mt-2 max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-neutral-900/95 backdrop-blur shadow-2xl shadow-black/50 py-1">
          {suggestions.map((name, i) => (
            <li key={name}>
              <button
                type="button"
                // pointerdown fires before blur, so this keeps focus and registers the pick
                onPointerDown={(e) => {
                  e.preventDefault();
                  pick(name);
                }}
                onMouseEnter={() => setActiveIdx(i)}
                className={`w-full text-left px-4 py-2 text-sm transition ${
                  i === activeIdx
                    ? "bg-white/10 text-white"
                    : "text-neutral-300 hover:bg-white/5"
                }`}
              >
                {name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </form>
  );
}
