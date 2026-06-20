"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ModeKey } from "../modes";
import type {
  PlayerId,
  PublicDuel,
  PublicRound,
  PublicRoundResult,
  ServerMessage,
} from "./types";

const WS_URL = process.env.NEXT_PUBLIC_DUEL_WS_URL ?? "ws://localhost:8787";

export type DuelStatus =
  | "idle"
  | "connecting"
  | "queued"
  | "round"
  | "round_result"
  | "finished"
  | "opponent_left"
  | "error";

export interface DuelView {
  status: DuelStatus;
  you: PlayerId | null;
  duel: PublicDuel | null;
  round: PublicRound | null;
  result: PublicRoundResult | null;
  opponentSubmitted: boolean;
  youSubmitted: boolean;
  winnerId: PlayerId | null | undefined;
  error?: string;
}

const INITIAL: DuelView = {
  status: "idle",
  you: null,
  duel: null,
  round: null,
  result: null,
  opponentSubmitted: false,
  youSubmitted: false,
  winnerId: undefined,
};

/**
 * Client hook for a duel session. Opens a WebSocket to the duel server, maps
 * incoming ServerMessages into a view model, and exposes actions. The realtime
 * transport is the only browser-side dependency; everything authoritative lives
 * on the server.
 */
export function useDuel() {
  const [view, setView] = useState<DuelView>(INITIAL);
  const wsRef = useRef<WebSocket | null>(null);

  const cleanup = useCallback(() => {
    const ws = wsRef.current;
    if (ws) {
      // Detach handlers first so a deliberate close doesn't trip "Connection lost".
      ws.onopen = ws.onmessage = ws.onerror = ws.onclose = null;
      ws.close();
    }
    wsRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const send = useCallback((msg: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }, []);

  const queue = useCallback(
    (name: string, mode: ModeKey, bestOf: number) => {
      cleanup();
      setView({ ...INITIAL, status: "connecting" });

      let ws: WebSocket;
      try {
        ws = new WebSocket(WS_URL);
      } catch {
        setView({ ...INITIAL, status: "error", error: "Couldn't reach the duel server." });
        return;
      }
      wsRef.current = ws;

      ws.onopen = () => {
        setView((v) => ({ ...v, status: "queued" }));
        ws.send(JSON.stringify({ t: "queue", name, mode, bestOf }));
      };
      ws.onerror = () => {
        setView((v) =>
          v.status === "connecting" || v.status === "queued"
            ? { ...v, status: "error", error: "Couldn't reach the duel server." }
            : v,
        );
      };
      ws.onclose = () => {
        setView((v) =>
          v.status === "finished" || v.status === "opponent_left" || v.status === "error"
            ? v
            : { ...v, status: "error", error: "Connection lost." },
        );
      };
      ws.onmessage = (e) => {
        let msg: ServerMessage;
        try {
          msg = JSON.parse(e.data);
        } catch {
          return;
        }
        setView((v) => reduce(v, msg));
      };
    },
    [cleanup],
  );

  const submit = useCallback(
    (guess: string) => {
      send({ t: "submit", guess });
      setView((v) => ({ ...v, youSubmitted: true }));
    },
    [send],
  );

  const leave = useCallback(() => {
    send({ t: "leave" });
    cleanup();
    setView(INITIAL);
  }, [send, cleanup]);

  return { view, queue, submit, leave };
}

function reduce(v: DuelView, msg: ServerMessage): DuelView {
  switch (msg.t) {
    case "queued":
      return { ...v, status: "queued" };
    case "matched":
      return { ...v, you: msg.you, duel: msg.duel, winnerId: undefined };
    case "round_start":
      return {
        ...v,
        status: "round",
        round: msg.round,
        result: null,
        opponentSubmitted: false,
        youSubmitted: false,
      };
    case "opponent_submitted":
      return { ...v, opponentSubmitted: true };
    case "round_result":
      return {
        ...v,
        status: "round_result",
        result: msg.result,
        duel: v.duel ? { ...v.duel, players: msg.result.players } : v.duel,
      };
    case "match_over":
      return { ...v, status: "finished", duel: msg.duel, winnerId: msg.winnerId };
    case "opponent_left":
      return { ...v, status: "opponent_left" };
    case "error":
      return { ...v, status: "error", error: msg.message };
    default:
      return v;
  }
}
