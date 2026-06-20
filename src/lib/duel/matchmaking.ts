// Matchmaking queue. Players waiting for the same (mode, bestOf) get paired
// FIFO. This in-memory version is correct for a SINGLE process — fine for local
// dev and a single long-lived socket server. On Vercel's stateless serverless
// functions it must be backed by a shared store (see README: Upstash Redis or
// the realtime provider's presence). The Matchmaker interface stays the same so
// that swap is contained.

import type { ModeKey } from "../modes";
import type { PlayerId } from "./types";

export interface QueueTicket {
  playerId: PlayerId;
  name: string;
  mode: ModeKey;
  bestOf: number;
  since: number;
}

export interface Pairing {
  a: QueueTicket;
  b: QueueTicket;
}

const bucketKey = (mode: ModeKey, bestOf: number) => `${mode}:${bestOf}`;

export class Matchmaker {
  private buckets = new Map<string, QueueTicket[]>();
  private bucketOf = new Map<PlayerId, string>();

  /**
   * Add a player to the queue. If a compatible opponent is already waiting,
   * returns the pairing immediately (and removes both from the queue).
   */
  enqueue(ticket: QueueTicket): Pairing | null {
    const key = bucketKey(ticket.mode, ticket.bestOf);
    const bucket = this.buckets.get(key) ?? [];

    // Drop any stale ticket for this player first.
    this.dequeue(ticket.playerId);

    const opponent = bucket.find((t) => t.playerId !== ticket.playerId);
    if (opponent) {
      this.remove(key, opponent.playerId);
      return { a: opponent, b: ticket };
    }

    bucket.push(ticket);
    this.buckets.set(key, bucket);
    this.bucketOf.set(ticket.playerId, key);
    return null;
  }

  dequeue(playerId: PlayerId): void {
    const key = this.bucketOf.get(playerId);
    if (key) this.remove(key, playerId);
  }

  private remove(key: string, playerId: PlayerId): void {
    const bucket = this.buckets.get(key);
    if (bucket) {
      const next = bucket.filter((t) => t.playerId !== playerId);
      if (next.length) this.buckets.set(key, next);
      else this.buckets.delete(key);
    }
    this.bucketOf.delete(playerId);
  }

  /** Number of players currently waiting (optionally for one bucket). */
  size(mode?: ModeKey, bestOf?: number): number {
    if (mode && bestOf != null) return this.buckets.get(bucketKey(mode, bestOf))?.length ?? 0;
    let n = 0;
    for (const b of this.buckets.values()) n += b.length;
    return n;
  }
}
