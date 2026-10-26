import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "sonner";
import { permissionsForRole } from "@exam/authz";
import { AuthProvider } from "@/contexts/AuthContext";
import { BrandProvider } from "@/components/layout/BrandProvider";
import { ApiError, api } from "@/lib/api";
import type { RecoveryAggregateResponse as RecoveryIncidentAggregateResponse } from "@exam/contracts";
import { RecoveryIncidentDetailPage } from "./RecoveryIncidentDetailPage";

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>();
  return {
    ...actual,
    api: {
      get: vi.fn(),
      post: vi.fn(),
    },
  };
});

const getMock = vi.mocked(api.get);
const postMock = vi.mocked(api.post);

const mockAggregate: RecoveryIncidentAggregateResponse = {
  incident: {
    id: "incident-1",
    examId: "exam-1",
    attemptId: null,
    candidateId: null,
    type: "network_interruption",
    severity: "major",
    status: "investigating",
    occurredAt: null,
    description: "detail page test incident",
    resolutionSummary: null,
    resolvedAt: null,
    resolvedBy: null,
    reportedBy: "admin-1",
    version: 2,
    createdAt: "2025-01-15T10:00:00Z",
    updatedAt: "2025-01-15T10:00:00Z",
  },
  examSummary: {
    id: "exam-1",
    title: "网络恢复考试",
    status: "open",
    closeAt: "2025-01-15T12:00:00Z",
  },
  events: [
    {
      id: "evt-1",
      eventSequence: 1,
      eventType: "investigated",
      commandType: "startIncidentInvestigation",
      operationId: "op-1",
      actorId: "admin-1",
      beforeVersion: 1,
      afterVersion: 2,
      payload: { reasonCode: "network", note: "Iniciar investigación" },
      createdAt: "2025-01-15T10:05:00Z",
    },
  ],
  notes: [
    {
      operationId: "op-2",
      actorId: "admin-1",
      body: "已联系考生",
      createdAt: "2025-01-15T10:10:00Z",
    },
  ],
  actions: [
    {
      id: "act-1",
      actionType: "time_grant",
      actionId: "adj-1",
      attemptId: "attempt-1",
      actorId: "admin-1",
      operationId: "op-3",
      linkedAt: "2025-01-15T10:15:00Z",
    },
  ],
  attemptMemberships: [
    {
      id: "mem-1",
      attemptId: "attempt-1",
      relationshipType: "affected",
      linkedAt: "2025-01-15T10:01:00Z",
      linkedBy: "admin-1",
      operationId: "op-4",
    },
  ],
  interruptionLinks: [
    {
      id: "il-1",
      attemptId: "attempt-1",
      interruptionId: "interruption-1",
      linkedAt: "2025-01-15T10:02:00Z",
      linkedBy: "admin-1",
      operationId: "op-5",
    },
  ],
  candidateSummaries: [{ id: "cand-1", displayName: "考生张三" }],
  attemptSummaries: [
    {
      id: "attempt-1",
      candidateId: "cand-1",
      status: "disrupted",
      effectiveDeadlineAt: "2025-01-15T11:00:00Z",
      score: 88.5,
    },
  ],
  timeAdjustmentSummaries: [
    {
      id: "adj-1",
      attemptId: "attempt-1",
      policy: "operator_incident",
      source: "operator",
      beforeDeadline: "2025-01-15T11:00:00Z",
      afterDeadline: "2025-01-15T12:00:00Z",
      addedSeconds: 3600,
      eligibleSeconds: null,
      reasonCode: "network",
      reasonText: "网络故障补偿",
      actorId: "admin-1",
      operationId: "op-3",
      createdAt: "2025-01-15T10:15:00Z",
    },
  ],
  auditReferences: [
    {
      id: "aud-1",
      action: "incident.investigated",
      actorId: "admin-1",
      actorName: "Administrador",
      createdAt: "2025-01-15T10:05:00Z",
    },
  ],
  allowedActions: ["investigate", "resolve"],
  snapshotAt: "2025-01-15T10:05:00Z",
};

function renderPage(incidentId = "incident-1") {
  return render(
    <MemoryRouter initialEntries={[`/admin/recovery/incidents/${incidentId}`]}>
      <AuthProvider
        initialUser={{
          id: "admin-1",
          username: "admin",
          name: "Admin",
          role: "Admin",
          organizationId: "org1",
          capabilities: [...permissionsForRole("Admin")],
        }}
      >
        <BrandProvider>
          <Routes>
            <Route
              path="/admin/recovery/incidents/:incidentId"
              element={<RecoveryIncidentDetailPage />}
            />
            <Route path="*" element={<div data-testid="unmatched-route" />} />
          </Routes>
        </BrandProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("RecoveryIncidentDetailPage", () => {
  beforeEach(() => {
    getMock.mockReset();
    getMock.mockResolvedValue(mockAggregate);
    postMock.mockReset();
    postMock.mockResolvedValue({ outcome: "applied" });
    vi.mocked(toast.success).mockClear();
    vi.mocked(toast.error).mockClear();
    window.sessionStorage.clear();
  });

  it("renders the incident overview header", async () => {
    renderPage();
    expect(
      await screen.findByText("detail page test incident"),
    ).toBeInTheDocument();
    // Status renders through StatusBadge (incident domain keys).
    expect(screen.getByText("En investigación")).toBeInTheDocument();
    expect(screen.getByText("Crítico")).toBeInTheDocument();
    expect(screen.getByText("Corte de red")).toBeInTheDocument();
    expect(screen.getAllByText("admin-1").length).toBeGreaterThanOrEqual(1);
  });

  it("renders exam, candidates and attempt summaries with score", async () => {
    renderPage();
    expect(await screen.findByText("网络恢复考试")).toBeInTheDocument();
    expect(screen.getByText("考生张三")).toBeInTheDocument();
    const attemptsSection = screen
      .getByText("Intento")
      .closest("section") as HTMLElement;
    expect(within(attemptsSection).getByText(/88\.5/)).toBeInTheDocument();
    expect(within(attemptsSection).getByText("Desconectado")).toBeInTheDocument();
  });

  it("renders events, notes, actions, memberships and interruption links", async () => {
    renderPage();
    // "Iniciar investigación" appears both as an event-type label and the Operations
    // command button (J5-I1C1) — assert presence, not uniqueness.
    expect(
      (await screen.findAllByText("Iniciar investigación")).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("已联系考生")).toBeInTheDocument();
    expect(screen.getAllByText("Compensación de tiempo").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Afectado")).toBeInTheDocument();
    expect(screen.getByText("interruption-1")).toBeInTheDocument();
  });

  it("renders time adjustment facts (policy/source/deadlines)", async () => {
    renderPage();
    expect(await screen.findByText("Intervención manual")).toBeInTheDocument();
    expect(screen.getByText("Manual")).toBeInTheDocument();
    expect(screen.getByText("+3600s")).toBeInTheDocument();
    expect(screen.getByText(/Cierre anterior/)).toBeInTheDocument();
    expect(screen.getByText(/Cierre nuevo/)).toBeInTheDocument();
    expect(screen.getByText(/网络故障补偿/)).toBeInTheDocument();
  });

  it("renders audit references with actor names", async () => {
    renderPage();
    expect(
      await screen.findByText("incident.investigated"),
    ).toBeInTheDocument();
    expect(screen.getByText("Administrador")).toBeInTheDocument();
  });

  it("renders attempt-operation navigation links (cross-links, not multi-fetch)", async () => {
    renderPage();
    expect(
      (await screen.findAllByText("attempt-1")).length,
    ).toBeGreaterThanOrEqual(1);
    const links = screen
      .getAllByRole("link")
      .filter((l) =>
        l.getAttribute("href")?.includes("/admin/recovery/attempts/"),
      );
    expect(links.length).toBeGreaterThanOrEqual(3);
  });

  it("renders the Operations section with allowedActions-gated command buttons", async () => {
    renderPage();
    await screen.findByText("detail page test incident");
    // Server-computed allowedActions from the mock: investigate + resolve.
    expect(screen.getByText("Acciones")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Iniciar investigación" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Resolver incidente" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Agregar nota" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Descartar incidente" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the page read-only when allowedActions is empty (§6.2/§6.3 computed result)", async () => {
    getMock.mockResolvedValue({ ...mockAggregate, allowedActions: [] });
    renderPage();
    await screen.findByText("detail page test incident");
    expect(screen.queryByText("Acciones")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", {
        name: /Iniciar investigación|Agregar nota|Cambiar gravedad|Resolver incidente|Descartar incidente/,
      }),
    ).not.toBeInTheDocument();
  });

  it("investigates with operationId + expectedVersion and reloads", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Iniciar investigación" }));
    await user.click(screen.getByRole("button", { name: "Iniciar investigación" }));

    expect(postMock).toHaveBeenCalledTimes(1);
    const [url, body] = postMock.mock.calls[0]! as unknown as [
      string,
      { operationId: string; expectedVersion: number },
    ];
    expect(url).toBe("/api/admin/incidents/incident-1/investigate");
    expect(body.expectedVersion).toBe(2);
    // Confirmed success reloads the authoritative aggregate.
    expect(getMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("requires a resolution summary before resolving (terminal judgment)", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Resolver incidente" }));
    const confirm = screen.getByRole("button", { name: "Resolver incidente" });
    await user.click(confirm);
    expect(postMock).not.toHaveBeenCalled();
    expect(screen.getByText("Ingresa la resolución")).toBeInTheDocument();
  });

  it("resolves with the resolution summary + expectedVersion", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Resolver incidente" }));
    await user.type(
      screen.getByLabelText("Resolución"),
      "考生已恢复，网络已修复",
    );
    await user.click(screen.getByRole("button", { name: "Resolver incidente" }));

    expect(postMock).toHaveBeenCalledTimes(1);
    const [url, body] = postMock.mock.calls[0]! as unknown as [
      string,
      {
        operationId: string;
        expectedVersion: number;
        resolutionSummary: string;
      },
    ];
    expect(url).toBe("/api/admin/incidents/incident-1/resolve");
    expect(body.expectedVersion).toBe(2);
    expect(body.resolutionSummary).toBe("考生已恢复，网络已修复");
  });

  it("surfaces a version conflict with a reload-and-retry message", async () => {
    const user = userEvent.setup();
    postMock.mockRejectedValueOnce(
      new ApiError(409, "version conflict", "INCIDENT_VERSION_CONFLICT"),
    );
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Iniciar investigación" }));
    await user.click(screen.getByRole("button", { name: "Iniciar investigación" }));

    // Confirmed rejection — dialog closes; the dedicated version-conflict
    // toast is surfaced (reload and retry).
    expect(toast.error).toHaveBeenCalledWith(
      expect.stringContaining("版本冲突"),
    );
    expect(screen.queryByText("Reintentar")).not.toBeInTheDocument();
  });

  it("shows the snapshot timestamp and a stale warning for old snapshots", async () => {
    getMock.mockResolvedValue({
      ...mockAggregate,
      snapshotAt: "2025-01-01T00:00:00Z",
    });
    renderPage();
    expect(await screen.findByText(/快照时间：/)).toBeInTheDocument();
    expect(screen.getByText("La instantánea es antigua. Los datos pueden haber cambiado.")).toBeInTheDocument();
  });

  it("shows a fresh snapshot without a stale warning", async () => {
    getMock.mockResolvedValue({
      ...mockAggregate,
      snapshotAt: new Date().toISOString(),
    });
    renderPage();
    expect(await screen.findByText(/快照时间：/)).toBeInTheDocument();
    expect(
      screen.queryByText("La instantánea es antigua. Los datos pueden haber cambiado."),
    ).not.toBeInTheDocument();
  });

  it("shows not-found for 404 and retry works", async () => {
    getMock.mockRejectedValueOnce(new ApiError(404, "Not found"));
    renderPage();
    expect(await screen.findByText("No se encontró este incidente")).toBeInTheDocument();

    getMock.mockResolvedValue(mockAggregate);
    await userEvent.setup().click(screen.getByText("Reintentar"));
    expect(
      await screen.findByText("detail page test incident"),
    ).toBeInTheDocument();
  });

  it("shows the classified network error state on fetch failure", async () => {
    getMock.mockRejectedValueOnce(new ApiError(0, "Network request failed"));
    renderPage();
    // status 0 → network kind → networkError message (classifier authority).
    expect(await screen.findByText(/网络异常/)).toBeInTheDocument();
  });

  it("keeps the loaded page on screen with an inline warning when a background refresh fails", async () => {
    renderPage();
    await screen.findByText("detail page test incident");

    // Manual refresh fails while data is on screen (503 → unavailable).
    getMock.mockRejectedValueOnce(new ApiError(503, "unavailable"));
    await userEvent.setup().click(screen.getByRole("button", { name: "Actualizar" }));

    // Old data stays visible, the failure is an INLINE banner (not a
    // full-screen ErrorState — no retry button, no data swap).
    expect(
      await screen.findByText("Los datos de recuperación no están disponibles. Inténtalo más tarde."),
    ).toBeInTheDocument();
    expect(screen.getByText("detail page test incident")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Reintentar" }),
    ).not.toBeInTheDocument();
  });
});
