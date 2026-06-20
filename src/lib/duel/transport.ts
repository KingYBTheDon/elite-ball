// Realtime transport abstraction. The duel manager only needs to push a
// ServerMessage to a given player (or both), so it depends on this interface
// rather than any specific provider. Swap implementations at deploy time:
//
//   - InMemoryTransport  — tests / single-process dev (records messages).
//   - (later) a Pusher/Ably/Supabase adapter that publishes to a per-player or
//     per-duel channel; the browser subscribes to that channel.
//
// See README.md for the recommended production wiring.

import type { PlayerId, ServerMessage } from "./types";

export interface DuelTransport {
  /** Deliver a message to one player. */
  send(playerId: PlayerId, msg: ServerMessage): void | Promise<void>;
  /** Deliver the same message to several players. */
  broadcast(playerIds: PlayerId[], msg: ServerMessage): void | Promise<void>;
}

/** In-memory transport for tests and local dev: just records what was sent. */
export class InMemoryTransport implements DuelTransport {
  readonly outbox = new Map<PlayerId, ServerMessage[]>();

  send(playerId: PlayerId, msg: ServerMessage): void {
    const list = this.outbox.get(playerId) ?? [];
    list.push(msg);
    this.outbox.set(playerId, list);
  }

  broadcast(playerIds: PlayerId[], msg: ServerMessage): void {
    for (const id of playerIds) this.send(id, msg);
  }

  /** Messages sent to a player so far (handy in tests). */
  messagesFor(playerId: PlayerId): ServerMessage[] {
    return this.outbox.get(playerId) ?? [];
  }

  /** Latest message of a given type sent to a player. */
  lastOfType<T extends ServerMessage["t"]>(
    playerId: PlayerId,
    t: T,
  ): Extract<ServerMessage, { t: T }> | undefined {
    const list = this.messagesFor(playerId);
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].t === t) return list[i] as Extract<ServerMessage, { t: T }>;
    }
    return undefined;
  }

  clear(): void {
    this.outbox.clear();
  }
}
