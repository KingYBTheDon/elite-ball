"use client";

import { useState } from "react";
import Link from "next/link";
import { copyText } from "@/lib/daily/share";

export function DailyHeader({
  title,
  date,
  streak,
}: {
  title: string;
  date?: string;
  streak?: number;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <Link href="/daily" className="text-sm text-neutral-500 hover:text-neutral-300 transition">
        ← Daily
      </Link>
      <div className="text-center">
        <p className="text-sm font-medium leading-none">{title}</p>
        {date && <p className="text-[11px] text-neutral-600 mt-0.5">{date}</p>}
      </div>
      <span className="text-sm tabular-nums text-neutral-400 min-w-[3ch] text-right">
        {streak ? `🔥${streak}` : ""}
      </span>
    </div>
  );
}

export function Panel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[1.6rem] border border-[var(--hairline)] bg-[var(--card)] backdrop-blur p-6 shadow-2xl shadow-black/40 ${className}`}
    >
      {children}
    </div>
  );
}

export function ShareButton({ text, className = "" }: { text: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={async () => {
        const ok = await copyText(text);
        setCopied(ok);
        if (ok) setTimeout(() => setCopied(false), 1800);
      }}
      className={`btn-accent rounded-xl py-2.5 px-5 ${className}`}
    >
      {copied ? "Copied!" : "Share result"}
    </button>
  );
}

export function ResultActions({ shareText }: { shareText: string }) {
  return (
    <div className="mt-6 flex gap-2">
      <ShareButton text={shareText} className="flex-1" />
      <Link
        href="/daily"
        className="btn-ghost flex-1 rounded-xl py-2.5 text-center font-medium"
      >
        Daily hub
      </Link>
    </div>
  );
}

/** "Come back tomorrow" line shown under a finished puzzle. */
export function ComeBack() {
  return (
    <p className="mt-4 text-center text-xs text-neutral-600">
      New puzzles at midnight. Come back tomorrow.
    </p>
  );
}
