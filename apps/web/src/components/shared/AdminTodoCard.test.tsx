import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { describe, expect, it, vi } from "vitest";
import { ListChecks } from "lucide-react";
import { AdminTodoCard, type AdminTodoCardCopy } from "./AdminTodoCard";
import type { AdminTodoState } from "@/hooks/useAdminTodoCount";

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.pathname}</div>;
}

const copy: AdminTodoCardCopy = {
  label: "待人工评分",
  unit: "份答卷",
  zeroCaption: "暂无待评分答卷",
  unknownValue: "无法获取",
  staleCaption: "数据可能已过期",
  refreshingCaption: "刷新中…",
  retryLabel: "重试",
  refreshLabel: "刷新",
  cta: "前往评分队列",
};

function renderCard(state: AdminTodoState, onRefresh = vi.fn()) {
  const refresh = vi.fn(onRefresh);
  render(
    <MemoryRouter initialEntries={["/admin/dashboard"]}>
      <LocationProbe />
      <Routes>
        <Route
          path="/admin/dashboard"
          element={
            <AdminTodoCard
              icon={ListChecks}
              href="/admin/grading-queue"
              state={state}
              copy={copy}
              onRefresh={refresh}
            />
          }
        />
        <Route path="/admin/grading-queue" element={<div>queue page</div>} />
      </Routes>
    </MemoryRouter>,
  );
  return { refresh };
}

/** The card marks itself with data-slot (repo convention), not a test id. */
function getCard(): HTMLElement {
  const card = document.querySelector<HTMLElement>(
    "[data-slot='admin-todo-card']",
  );
  if (!card) throw new Error("admin todo card not rendered");
  return card;
}

const ready = (value: number): AdminTodoState => ({
  kind: "ready",
  count: { kind: "exact", value },
  refreshing: false,
});

describe("AdminTodoCard", () => {
  it("loading renders skeletons and no numeric value", () => {
    renderCard({ kind: "loading" });
    expect(
      document.querySelector("[data-slot='skeleton']"),
    ).toBeInTheDocument();
    expect(
      screen.queryByTestId("admin-todo-card-value"),
    ).not.toBeInTheDocument();
  });

  it("verified zero renders 0 with the zero caption (0 proven by success)", () => {
    renderCard(ready(0));
    const card = getCard();
    expect(card).toHaveAttribute("data-state", "ready");
    expect(within(card).getByText("0")).toBeInTheDocument();
    expect(within(card).getByText("暂无待评分答卷")).toBeInTheDocument();
    expect(within(card).queryByText("无法获取")).not.toBeInTheDocument();
  });

  it("verified nonzero renders the exact number with its unit", () => {
    renderCard(ready(25));
    const card = getCard();
    expect(within(card).getByText("25")).toBeInTheDocument();
    expect(within(card).getByText("份答卷")).toBeInTheDocument();
    expect(within(card).queryByText("暂无待评分答卷")).not.toBeInTheDocument();
  });

  it("bounded count renders the >min lower bound, never min as an exact total", () => {
    renderCard({
      kind: "ready",
      count: { kind: "bounded", min: 20 },
      refreshing: false,
    });
    const card = getCard();
    expect(within(card).getByText(">20")).toBeInTheDocument();
    expect(within(card).getByText("份答卷")).toBeInTheDocument();
  });

  it("unknown renders 无法获取 plus a retry Button and never a zero (B05)", () => {
    renderCard({ kind: "unknown" });
    const card = getCard();
    expect(card).toHaveAttribute("data-state", "unknown");
    expect(within(card).getByText("无法获取")).toBeInTheDocument();
    expect(within(card).getByText("重试")).toBeInTheDocument();
    // The failure state must not read as an empty workset.
    expect(within(card).queryByText("0")).not.toBeInTheDocument();
    expect(
      within(card).queryByTestId("admin-todo-card-value"),
    ).not.toBeInTheDocument();
  });

  it("stale keeps the old value under the expiry caption with a refresh Button (B07)", () => {
    renderCard({
      kind: "stale",
      count: { kind: "exact", value: 5 },
      refreshing: false,
    });
    const card = getCard();
    expect(card).toHaveAttribute("data-state", "stale");
    expect(within(card).getByText("5")).toBeInTheDocument();
    expect(within(card).getByText("数据可能已过期")).toBeInTheDocument();
    expect(within(card).getByText("刷新")).toBeInTheDocument();
  });

  it("refreshing over a value shows the refresh caption", () => {
    renderCard({ kind: "ready", count: ready(7).count, refreshing: true });
    const card = getCard();
    expect(within(card).getByText("7")).toBeInTheDocument();
    expect(within(card).getByText("刷新中…")).toBeInTheDocument();
  });

  it("the retry Button and the navigation Link are siblings — no interactive nesting", () => {
    renderCard({ kind: "unknown" });
    const link = screen.getByRole("link", { name: /待人工评分/ });
    expect(within(link).queryByRole("button")).not.toBeInTheDocument();
    // Both actions live in the same card.
    const card = getCard();
    expect(
      card.contains(link) && card.contains(screen.getByRole("button")),
    ).toBe(true);
  });

  it("the Link navigates natively to the queue route", async () => {
    renderCard(ready(3));
    const user = userEvent.setup();
    await user.click(screen.getByRole("link", { name: /待人工评分/ }));
    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "/admin/grading-queue",
      ),
    );
  });

  it("the retry Button fires onRefresh without navigating", async () => {
    const { refresh } = renderCard({ kind: "unknown" });
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "重试" }));
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("location")).toHaveTextContent(
      "/admin/dashboard",
    );
  });
});
