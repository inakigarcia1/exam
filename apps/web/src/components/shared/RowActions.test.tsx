import {
  render,
  screen,
  waitFor,
  fireEvent,
  act,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Pencil, Trash2, KeyRound } from "lucide-react";
import { RowActions, type RowActionDeclaration } from "./RowActions";

type Row = { id: string };

function decl(
  overrides: Partial<RowActionDeclaration<Row>> & { id: string; label: string },
): RowActionDeclaration<Row> {
  return { icon: Pencil, onSelect: vi.fn(), ...overrides };
}

function renderActions(
  actions: RowActionDeclaration<Row>[],
  row: Row = { id: "r1" },
) {
  return render(<RowActions actions={actions} row={row} />);
}

describe("RowActions representation contract", () => {
  it("renders every action inline when N ≤ 2 (icon-only, aria-label)", () => {
    const onSelect = vi.fn();
    renderActions([
      decl({ id: "edit", label: "Editar", onSelect }),
      decl({ id: "delete", label: "Eliminar", icon: Trash2 }),
    ]);
    const group = screen.getByRole("group");
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Eliminar" })).toBeInTheDocument();
    // Inline vocabulary is icon-only: no button carries visible text.
    const buttons = group.querySelectorAll("button");
    expect(buttons).toHaveLength(2);
    buttons.forEach((b) => expect(b.textContent).toBe(""));
    // No kebab menu trigger exists.
    expect(
      screen.queryByRole("button", { name: "Más acciones" }),
    ).not.toBeInTheDocument();
  });

  it("renders primary inline + kebab(rest) when N > 2", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    renderActions([
      decl({ id: "edit", label: "Editar" }),
      decl({
        id: "reset",
        label: "Restablecer contraseña",
        icon: KeyRound,
        onSelect: onReset,
      }),
      decl({
        id: "disable",
        label: "Desactivar",
        tone: "destructive",
        confirm: { title: "禁用用户", description: "确定禁用该用户吗？" },
      }),
    ]);

    // Primary (first declared) stays inline; the only other inline control is
    // the kebab icon button.
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
    const group = screen.getByRole("group");
    expect(group.querySelectorAll("button")).toHaveLength(2);

    await user.click(screen.getByRole("button", { name: "Más acciones" }));
    expect(
      await screen.findByRole("menuitem", { name: "Restablecer contraseña" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Desactivar" })).toHaveAttribute(
      "data-variant",
      "destructive",
    );
    expect(
      screen.queryByRole("menuitem", { name: "Editar" }),
    ).not.toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Restablecer contraseña" }));
    await waitFor(() => expect(onReset).toHaveBeenCalledWith({ id: "r1" }));
  });

  it("honors an explicit primary declaration", async () => {
    const user = userEvent.setup();
    renderActions([
      decl({ id: "a", label: "甲" }),
      decl({ id: "b", label: "乙", primary: true }),
      decl({ id: "c", label: "丙" }),
    ]);
    expect(screen.getByRole("button", { name: "乙" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "甲" }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Más acciones" }));
    expect(
      await screen.findByRole("menuitem", { name: "甲" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "丙" })).toBeInTheDocument();
  });

  it("keeps capability transitions stable: [A] → [A][B] → [A▾(B,C)]", async () => {
    const user = userEvent.setup();
    const base = [
      decl({ id: "a", label: "甲" }),
      decl({ id: "b", label: "乙" }),
      decl({ id: "c", label: "丙" }),
    ];
    const { rerender } = renderActions(base.slice(0, 1));
    expect(screen.getAllByRole("button")).toHaveLength(1);

    rerender(<RowActions actions={base.slice(0, 2)} row={{ id: "r1" }} />);
    expect(screen.getAllByRole("button")).toHaveLength(2);
    expect(
      screen.queryByRole("button", { name: "Más acciones" }),
    ).not.toBeInTheDocument();

    rerender(<RowActions actions={base} row={{ id: "r1" }} />);
    // A stays inline in the same position; B and C move into the kebab.
    const group = screen.getByRole("group");
    const [first] = group.querySelectorAll("button");
    expect(first).toHaveAttribute("data-action-id", "a");
    expect(
      screen.getByRole("button", { name: "Más acciones" }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Más acciones" }));
    const items = await screen.findAllByRole("menuitem");
    expect(items.map((i) => i.getAttribute("data-action-id"))).toEqual([
      "b",
      "c",
    ]);
  });

  it("keeps declaration-count geometry when an action is disabled", async () => {
    // N is the declaration count: disabling must not collapse the kebab back
    // to three inline buttons (the geometry invariant the actions column
    // width is derived from).
    const user = userEvent.setup();
    renderActions([
      decl({ id: "edit", label: "Editar" }),
      decl({ id: "reset", label: "Restablecer contraseña", icon: KeyRound }),
      decl({ id: "disable", label: "Desactivar", disabled: true }),
    ]);
    const group = screen.getByRole("group");
    expect(group.querySelectorAll("button")).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Más acciones" }));
    const disableItem = await screen.findByRole("menuitem", { name: "Desactivar" });
    expect(disableItem).toHaveAttribute("aria-disabled", "true");
    expect(disableItem).toHaveAttribute("data-action-id", "disable");
  });

  it.each([3, 4, 8])(
    "keeps exactly two inline controls for N=%i (primary + kebab trigger)",
    async (n) => {
      const user = userEvent.setup();
      const actions = Array.from({ length: n }, (_, i) =>
        decl({ id: `a${i}`, label: `动作${i}` }),
      );
      renderActions(actions);
      const group = screen.getByRole("group");
      // The inline control count is bounded by the representation, not by N:
      // exactly the primary action and the overflow trigger.
      expect(group.querySelectorAll("button")).toHaveLength(2);
      expect(screen.getByRole("button", { name: "动作0" })).toBeInTheDocument();
      expect(
        screen.queryByRole("button", { name: "动作1" }),
      ).not.toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Más acciones" }),
      ).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Más acciones" }));
      // Every non-primary action is reachable in the kebab.
      const items = await screen.findAllByRole("menuitem");
      expect(items).toHaveLength(n - 1);
    },
  );

  it("surfaces a disabled reason as a focusable tooltip anchor", async () => {
    vi.useFakeTimers();
    try {
      renderActions([
        decl({
          id: "view",
          label: "Ver",
          disabled: { reason: "考试未结束，暂不可查看" },
        }),
      ]);
      const anchor = screen
        .getByRole("group")
        .querySelector("span[tabindex]") as HTMLElement | null;
      expect(anchor).toHaveAttribute("aria-label", "Ver");
      expect(anchor?.getAttribute("tabIndex")).toBe("0");
      expect(screen.getByRole("button", { name: "Ver" })).toBeDisabled();
      // The reason is reachable from the keyboard: focusing the anchor opens
      // the tooltip that carries the authoritative text (Radix also renders a
      // visually-hidden sr-only copy, so scope to the visible content slot).
      act(() => {
        anchor?.focus();
      });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2000);
      });
      expect(
        screen.getByText("考试未结束，暂不可查看", {
          selector: '[data-slot="tooltip-content"]',
        }),
      ).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("RowActions disabled reason accessibility", () => {
  it("exposes a disabled reason inside the overflow menu", async () => {
    const user = userEvent.setup();
    const onReset = vi.fn();
    const reason = "考试未结束，暂不可重置";
    renderActions([
      decl({ id: "edit", label: "Editar" }),
      decl({
        id: "reset",
        label: "Restablecer contraseña",
        icon: KeyRound,
        disabled: { reason },
        onSelect: onReset,
      }),
      decl({ id: "view", label: "Ver" }),
    ]);

    // Open the kebab with the keyboard.
    screen.getByRole("button", { name: "Más acciones" }).focus();
    await user.keyboard("{Enter}");

    // The disabled action is present in the menu and cannot be activated.
    const item = await screen.findByRole("menuitem", { name: /Restablecer contraseña/ });
    expect(item).toHaveAttribute("aria-disabled", "true");
    fireEvent.click(item);
    expect(onReset).not.toHaveBeenCalled();

    // The reason is perceivable as rendered text (not an HTML title) and is
    // tied to the item as its accessible description.
    expect(screen.getByText(reason)).toBeVisible();
    expect(item.getAttribute("title")).toBeNull();
    const describedBy = item.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy!)).toHaveTextContent(reason);
  });

  it("preserves label, disabled state, reason and non-activation across representations", async () => {
    const user = userEvent.setup();
    const onView = vi.fn();
    const reason = "考试未结束，暂不可查看";
    const viewAction = decl({
      id: "view",
      label: "Ver calificación",
      disabled: { reason },
      onSelect: onView,
    });
    const editAction = decl({ id: "edit", label: "Editar" });

    // N=2 → inline: same declaration renders as a disabled icon button whose
    // reason stays reachable through the focusable tooltip anchor.
    const { rerender } = renderActions([viewAction, editAction]);
    expect(screen.getByRole("button", { name: "Ver calificación" })).toBeDisabled();
    expect(
      screen.getByRole("group").querySelector("span[tabindex]"),
    ).toHaveAttribute("aria-label", "Ver calificación");

    // N=3 → overflow: label, disabled state and reason survive the move into
    // the kebab, and the action still cannot be activated. The non-disabled
    // edit action is first declared, so it is primary and view moves into the
    // overflow.
    rerender(
      <RowActions
        actions={[
          editAction,
          viewAction,
          decl({ id: "reset", label: "Restablecer contraseña", icon: KeyRound }),
        ]}
        row={{ id: "r1" }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Más acciones" }));
    const item = await screen.findByRole("menuitem", { name: /Ver calificación/ });
    expect(item).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByText(reason)).toBeVisible();
    fireEvent.click(item);
    expect(onView).not.toHaveBeenCalled();
  });
});

describe("RowActions confirmation semantics", () => {
  it("routes inline confirm actions through ConfirmDialog", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderActions([
      decl({
        id: "delete",
        label: "Eliminar",
        icon: Trash2,
        tone: "destructive",
        confirm: {
          title: "Eliminar comisión",
          description: "确定删除该课程吗？",
          destructive: true,
        },
        onSelect: onDelete,
      }),
    ]);
    await user.click(screen.getByRole("button", { name: "Eliminar" }));
    expect(await screen.findByText("Eliminar comisión")).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith({ id: "r1" }));
  });

  it("opens ConfirmDialog from a kebab item with confirm", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();
    renderActions([
      decl({ id: "edit", label: "Editar" }),
      decl({ id: "reset", label: "Restablecer contraseña", icon: KeyRound }),
      decl({
        id: "delete",
        label: "Eliminar",
        icon: Trash2,
        tone: "destructive",
        confirm: { title: "Eliminar campo", description: "确定删除该字段吗？" },
        onSelect: onDelete,
      }),
    ]);
    await user.click(screen.getByRole("button", { name: "Más acciones" }));
    await user.click(await screen.findByRole("menuitem", { name: "Eliminar" }));
    expect(await screen.findByText("Eliminar campo")).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(onDelete).toHaveBeenCalledWith({ id: "r1" }));
  });
});

describe("RowActions contract violations (dev)", () => {
  it("rejects more than one explicit primary", () => {
    expect(() =>
      renderActions([
        decl({ id: "a", label: "甲", primary: true }),
        decl({ id: "b", label: "乙", primary: true }),
      ]),
    ).toThrow(/at most one primary/);
  });

  it("rejects destructive tone without confirm", () => {
    expect(() =>
      renderActions([decl({ id: "a", label: "甲", tone: "destructive" })]),
    ).toThrow(/must declare confirm/);
  });
});
