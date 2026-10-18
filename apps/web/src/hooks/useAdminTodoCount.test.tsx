import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  gradingQueueTotalCount,
  unresolvedIncidentCount,
  useAdminTodoCount,
  type AdminTodoCount,
} from "./useAdminTodoCount";

/**
 * Controlled sources: every call is parked as a deferred so a test resolves or
 * rejects each request explicitly (no sleeps) and can hold an older response
 * back to prove the generation race contract.
 */
function makeSource() {
  const calls: {
    signal: AbortSignal;
    resolve: (v: AdminTodoCount) => void;
    reject: (e: unknown) => void;
  }[] = [];
  const source = (signal: AbortSignal) =>
    new Promise<AdminTodoCount>((resolve, reject) => {
      calls.push({ signal, resolve, reject });
    });
  return { source, calls };
}

async function flushMicros() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe("useAdminTodoCount", () => {
  it("a fulfilled zero lands on ready (0 is proven by success, not defaulted)", async () => {
    const { source, calls } = makeSource();
    const { result } = renderHook(() => useAdminTodoCount(source));
    await waitFor(() => expect(calls.length).toBe(1));
    expect(result.current.state.kind).toBe("loading");

    calls[0]!.resolve({ kind: "exact", value: 0 });
    await flushMicros();
    expect(result.current.state).toEqual({
      kind: "ready",
      count: { kind: "exact", value: 0 },
      refreshing: false,
    });
  });

  it("a failed initial load lands on unknown — never a zero", async () => {
    const { source, calls } = makeSource();
    const { result } = renderHook(() => useAdminTodoCount(source));
    await waitFor(() => expect(calls.length).toBe(1));

    calls[0]!.reject(new Error("500"));
    await flushMicros();
    expect(result.current.state).toEqual({ kind: "unknown" });
  });

  it("a failure after a success keeps the old value and marks it stale (B07)", async () => {
    const { source, calls } = makeSource();
    const { result } = renderHook(() => useAdminTodoCount(source));
    await waitFor(() => expect(calls.length).toBe(1));
    calls[0]!.resolve({ kind: "exact", value: 5 });
    await flushMicros();

    act(() => {
      result.current.refresh();
    });
    await waitFor(() => expect(calls.length).toBe(2));
    expect(result.current.state).toEqual({
      kind: "ready",
      count: { kind: "exact", value: 5 },
      refreshing: true,
    });

    calls[1]!.reject(new Error("network"));
    await flushMicros();
    expect(result.current.state).toEqual({
      kind: "stale",
      count: { kind: "exact", value: 5 },
      refreshing: false,
    });
  });

  it("a success after stale replaces the value and clears the stale mark (B07)", async () => {
    const { source, calls } = makeSource();
    const { result } = renderHook(() => useAdminTodoCount(source));
    await waitFor(() => expect(calls.length).toBe(1));
    calls[0]!.resolve({ kind: "exact", value: 5 });
    await flushMicros();
    act(() => {
      result.current.refresh();
    });
    await waitFor(() => expect(calls.length).toBe(2));
    calls[1]!.reject(new Error("network"));
    await flushMicros();

    // Refresh FROM stale: the old value stays visible under the in-flight
    // marker (stale + refreshing), and a second failure re-lands on stale.
    act(() => {
      result.current.refresh();
    });
    await waitFor(() => expect(calls.length).toBe(3));
    expect(result.current.state).toEqual({
      kind: "stale",
      count: { kind: "exact", value: 5 },
      refreshing: true,
    });
    calls[2]!.reject(new Error("network again"));
    await flushMicros();
    expect(result.current.state).toEqual({
      kind: "stale",
      count: { kind: "exact", value: 5 },
      refreshing: false,
    });

    act(() => {
      result.current.refresh();
    });
    await waitFor(() => expect(calls.length).toBe(4));
    calls[3]!.resolve({ kind: "exact", value: 3 });
    await flushMicros();
    expect(result.current.state).toEqual({
      kind: "ready",
      count: { kind: "exact", value: 3 },
      refreshing: false,
    });
  });

  it("retry from unknown goes back through loading and succeeds", async () => {
    const { source, calls } = makeSource();
    const { result } = renderHook(() => useAdminTodoCount(source));
    await waitFor(() => expect(calls.length).toBe(1));
    calls[0]!.reject(new Error("500"));
    await flushMicros();
    expect(result.current.state).toEqual({ kind: "unknown" });

    act(() => {
      result.current.refresh();
    });
    await waitFor(() => expect(calls.length).toBe(2));
    expect(result.current.state.kind).toBe("loading");
    calls[1]!.resolve({ kind: "bounded", min: 20 });
    await flushMicros();
    expect(result.current.state).toEqual({
      kind: "ready",
      count: { kind: "bounded", min: 20 },
      refreshing: false,
    });
  });

  it("an older response resolving late never overrides a newer refresh (race)", async () => {
    const { source, calls } = makeSource();
    const { result } = renderHook(() => useAdminTodoCount(source));
    await waitFor(() => expect(calls.length).toBe(1));

    act(() => {
      result.current.refresh();
    });
    await waitFor(() => expect(calls.length).toBe(2));
    // The NEWER request resolves first; the older one is still in flight.
    calls[1]!.resolve({ kind: "exact", value: 3 });
    await flushMicros();
    expect(result.current.state).toEqual({
      kind: "ready",
      count: { kind: "exact", value: 3 },
      refreshing: false,
    });

    // The stale request settles late: dropped, state untouched. Its signal is
    // aborted so the superseded network work is cancelled too.
    calls[0]!.resolve({ kind: "exact", value: 25 });
    await flushMicros();
    expect(result.current.state).toEqual({
      kind: "ready",
      count: { kind: "exact", value: 3 },
      refreshing: false,
    });
    expect(calls[0]!.signal.aborted).toBe(true);
  });

  it("an older FAILURE resolving late never clobbers a newer success", async () => {
    const { source, calls } = makeSource();
    const { result } = renderHook(() => useAdminTodoCount(source));
    await waitFor(() => expect(calls.length).toBe(1));
    act(() => {
      result.current.refresh();
    });
    await waitFor(() => expect(calls.length).toBe(2));
    calls[1]!.resolve({ kind: "exact", value: 7 });
    await flushMicros();
    calls[0]!.reject(new Error("late failure"));
    await flushMicros();
    expect(result.current.state).toEqual({
      kind: "ready",
      count: { kind: "exact", value: 7 },
      refreshing: false,
    });
  });
});

describe("todo count adapters", () => {
  it("grading queue total maps to an exact count", () => {
    expect(
      gradingQueueTotalCount({
        items: [],
        total: 25,
        page: 1,
        pageSize: 1,
      }),
    ).toEqual({ kind: "exact", value: 25 });
  });

  it("recovery page with a cursor is bounded at the page limit (never exact)", () => {
    expect(
      unresolvedIncidentCount(
        { items: [{}, {}, {}] as never[], nextCursor: "c", snapshotAt: "t" },
        20,
      ),
    ).toEqual({ kind: "bounded", min: 20 });
  });

  it("recovery page without a cursor is exact — including proven zero", () => {
    expect(
      unresolvedIncidentCount(
        { items: [], nextCursor: null, snapshotAt: "t" },
        20,
      ),
    ).toEqual({ kind: "exact", value: 0 });
    expect(
      unresolvedIncidentCount(
        { items: [{}, {}] as never[], nextCursor: null, snapshotAt: "t" },
        20,
      ),
    ).toEqual({ kind: "exact", value: 2 });
  });
});
