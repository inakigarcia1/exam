import { useCallback, useEffect, useRef, useState } from "react";
import type { GradingQueueListResponse } from "@exam/contracts";
import type { RecoveryQueueResponse } from "@exam/contracts";

/**
 * The honest count a todo card may display.
 *
 * - `exact`: a number proven by the source (grading queue's authoritative
 *   `total`, or a recovery page whose `nextCursor === null` proves the listed
 *   rows are ALL rows).
 * - `bounded`: the source only proves a lower bound (recovery page with a
 *   non-null cursor: at least pageLimit+1 rows exist). Rendering must never
 *   present `min` itself as the total.
 */
export type AdminTodoCount =
  | { readonly kind: "exact"; readonly value: number }
  | { readonly kind: "bounded"; readonly min: number };

/**
 * Per-card fetch state machine. The invariant `0 IS PROVEN BY SUCCESS` is
 * structural: `value: 0` can only be reached through a fulfilled source call —
 * failures land on `unknown` (no previous value) or `stale` (previous value
 * kept, marked expired), never on a zero.
 *
 * Transition table (rows = event, columns = current state):
 *
 * | event          | loading | ready(c)            | stale(c)            | unknown |
 * | -------------- | ------- | ------------------- | ------------------- | ------- |
 * | request starts | loading | ready(c, refreshing)| stale(c, refreshing)| loading |
 * | request ok(n)  | ready(n)| ready(n)            | ready(n)            | ready(n)|
 * | request failed | unknown | stale(c)            | stale(c)            | unknown |
 *
 * `refreshing` is therefore only ever true on top of an existing value; the
 * initial in-flight state is `loading` (nothing to keep visible yet).
 */
export type AdminTodoState =
  | { readonly kind: "loading" }
  | {
      readonly kind: "ready";
      readonly count: AdminTodoCount;
      readonly refreshing: boolean;
    }
  | { readonly kind: "unknown" }
  | {
      readonly kind: "stale";
      readonly count: AdminTodoCount;
      readonly refreshing: boolean;
    };

/** Grading queue adapter: the response `total` IS the exact workset count
 * (`count(DISTINCT attempt_id)` server-side) — the card consumes it directly. */
export function gradingQueueTotalCount(
  response: GradingQueueListResponse,
): AdminTodoCount {
  return { kind: "exact", value: response.total };
}

/**
 * Recovery queue adapter — honest three-branch protocol over the keyset page
 * (`limit+1` over-fetch server-side):
 *
 * 1. `nextCursor !== null` → a next page exists → at least `pageLimit + 1`
 *    unresolved rows → bounded lower bound, never an exact figure;
 * 2. `nextCursor === null` → this page holds ALL matching rows →
 *    `items.length` is exact (0 items = proven zero).
 *
 * The recovery response has no `total` field and the card must not invent one
 * by client-side scan, so `>pageLimit` is the only truthful over-limit display.
 */
export function unresolvedIncidentCount(
  response: RecoveryQueueResponse,
  pageLimit: number,
): AdminTodoCount {
  if (response.nextCursor !== null) return { kind: "bounded", min: pageLimit };
  return { kind: "exact", value: response.items.length };
}

export interface AdminTodoSource {
  (signal: AbortSignal): Promise<AdminTodoCount>;
}

/**
 * One-shot load + manual refresh state machine for a single dashboard todo
 * card (no polling: the dashboard is a projection at load time, per the B2
 * contract — polling stays a Recovery-queue-page semantic).
 *
 * Superseded responses can never commit: each load captures a generation
 * number and only the latest may write state, so a slow older response losing
 * a race against a newer refresh is dropped (and its aborted network work is
 * cancelled via the signal). The source callback is read through a ref, so a
 * caller passing an inline arrow cannot retrigger the mount effect.
 */
export function useAdminTodoCount(source: AdminTodoSource) {
  const [state, setState] = useState<AdminTodoState>({ kind: "loading" });
  const sourceRef = useRef(source);
  sourceRef.current = source;
  const generation = useRef(0);
  const inFlight = useRef<AbortController | null>(null);

  const load = useCallback(() => {
    const gen = ++generation.current;
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;
    setState((prev) => {
      switch (prev.kind) {
        case "ready":
          return { kind: "ready", count: prev.count, refreshing: true };
        case "stale":
          return { kind: "stale", count: prev.count, refreshing: true };
        default:
          return { kind: "loading" };
      }
    });
    sourceRef.current(controller.signal).then(
      (count) => {
        if (gen !== generation.current) return;
        setState({ kind: "ready", count, refreshing: false });
      },
      () => {
        if (gen !== generation.current) return;
        setState((prev) =>
          prev.kind === "ready" || prev.kind === "stale"
            ? { kind: "stale", count: prev.count, refreshing: false }
            : { kind: "unknown" },
        );
      },
    );
  }, []);

  useEffect(() => {
    load();
    return () => {
      // Invalidate in-flight commits and cancel the network work on unmount.
      generation.current += 1;
      inFlight.current?.abort();
    };
  }, [load]);

  return { state, refresh: load };
}
