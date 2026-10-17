import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, afterEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { AuthProvider } from "@/contexts/AuthContext";
import { BrandProvider } from "@/components/layout/BrandProvider";
import { ResultsOverviewPage } from "./ResultsOverviewPage";
import { permissionsForRole } from "@exam/authz";

const { apiGet } = vi.hoisted(() => ({
  apiGet: vi.fn().mockResolvedValue({
    items: [
      {
        id: "exam-open",
        title: "未结束考试",
        status: "published",
        openAt: new Date().toISOString(),
        closeAt: new Date(Date.now() + 3600000).toISOString(),
        passingScore: 60,
        totalScore: 100,
        gradedAttemptCount: 2,
        canViewScores: false,
        scoreViewDisabledReason: "考试尚未结束，暂不能查看成绩",
      },
      {
        id: "exam-empty",
        title: "暂无成绩考试",
        status: "closed",
        openAt: new Date(Date.now() - 86400000).toISOString(),
        closeAt: new Date(Date.now() - 3600000).toISOString(),
        passingScore: 60,
        totalScore: 100,
        gradedAttemptCount: 0,
        canViewScores: false,
        scoreViewDisabledReason: "暂无成绩数据",
      },
      {
        id: "exam-graded",
        title: "已出分考试",
        status: "closed",
        openAt: new Date(Date.now() - 86400000).toISOString(),
        closeAt: new Date(Date.now() - 3600000).toISOString(),
        passingScore: 60,
        totalScore: 100,
        gradedAttemptCount: 3,
        canViewScores: true,
        scoreViewDisabledReason: null,
      },
    ],
  }),
}));

vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {
    readonly status: number;
    readonly message: string;
    readonly code?: string;
    readonly details?: unknown;
    readonly requestId?: string;
    readonly serverMessage?: string;
    constructor(
      status: number,
      message: string,
      code?: string,
      details?: unknown,
      requestId?: string,
      serverMessage?: string,
    ) {
      super(message);
      this.name = "ApiError";
      this.status = status;
      this.message = message;
      this.code = code;
      this.details = details;
      this.requestId = requestId;
      this.serverMessage = serverMessage ?? message;
    }
  },
  api: {
    get: (...args: unknown[]) => apiGet(...args),
  },
  setNavigate: () => {},
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/admin/results"]}>
      <AuthProvider
        initialUser={{
          id: "1",
          username: "admin",
          name: "Admin",
          role: "Admin",
          organizationId: "org1",
          capabilities: [...permissionsForRole("Admin")],
        }}
      >
        <BrandProvider>
          <Routes>
            <Route path="/admin/results" element={<ResultsOverviewPage />} />
          </Routes>
        </BrandProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe("ResultsOverviewPage", () => {
  it("disables score viewing for ineligible exams and keeps graded exams clickable", async () => {
    renderPage();

    expect(await screen.findByText("成绩查询")).toBeInTheDocument();

    // Row actions render twice by design (desktop table + mobile cards);
    // scope to the desktop table representation.
    const table = await screen.findByRole("table");
    const buttons = await within(table).findAllByRole("button", {
      name: "查看成绩",
    });
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toBeDisabled();
    expect(buttons[1]).toBeDisabled();
    expect(buttons[2]).toBeEnabled();
  });
});

/**
 * #785 BDD acceptance — L2 (component level; mocked API with the REAL
 * paginated response shape). Scenario source:
 * docs/design/admin-list-pagination-bdd.md (B04/B05).
 */
describe("ResultsOverviewPage #785 server status set and pagination (BDD L2)", () => {
  const hoistedDefault = apiGet.getMockImplementation();

  afterEach(() => {
    apiGet.mockReset();
    if (hoistedDefault) apiGet.mockImplementation(hoistedDefault);
  });

  const OVERVIEW_STATUSES = "published,open,closed,archived";

  function examRow(
    id: string,
    title: string,
    overrides: Record<string, unknown> = {},
  ) {
    return {
      id,
      title,
      status: "published",
      openAt: new Date().toISOString(),
      closeAt: new Date(Date.now() + 3_600_000).toISOString(),
      passingScore: 60,
      totalScore: 100,
      gradedAttemptCount: 0,
      canViewScores: false,
      scoreViewDisabledReasonCode: "EXAM_NOT_FINISHED",
      scoreViewDisabledReason: "考试尚未结束，暂不能查看成绩",
      ...overrides,
    };
  }

  it("B04: the overview queries the server-filtered status set with real pagination", async () => {
    const user = userEvent.setup();
    const overviewItems = [
      ...Array.from({ length: 20 }, (_, i) =>
        examRow(`e${i + 1}`, `已发布考试${i + 1}`, { status: "published" }),
      ),
      examRow("e21", "已归档考试21", {
        status: "archived",
        canViewScores: true,
        scoreViewDisabledReasonCode: null,
        scoreViewDisabledReason: null,
      }),
    ];
    apiGet.mockImplementation(async (url: string) => {
      if (url.startsWith("/api/exams")) {
        const params = new URLSearchParams(url.split("?")[1] ?? "");
        const page = Number(params.get("page") ?? "1");
        expect(params.get("statuses")).toBe(OVERVIEW_STATUSES);
        const start = (page - 1) * 20;
        const items = overviewItems.slice(start, start + 20);
        return {
          items,
          total: 21,
          page,
          pageSize: 20,
          totalPages: 2,
        };
      }
      throw new Error(`unexpected GET ${url}`);
    });

    renderPage();
    const table = await screen.findByRole("table");
    expect(within(table).getByText("已发布考试1")).toBeInTheDocument();
    expect(within(table).queryByText("已归档考试21")).not.toBeInTheDocument();
    // The total reflects the SERVER-filtered set, not a client filter.
    expect(screen.getByText(/共 21 条/)).toBeInTheDocument();
    {
      const [lastUrl] = apiGet.mock.lastCall!;
      const params = new URLSearchParams(String(lastUrl).split("?")[1]);
      expect(params.get("page")).toBe("1");
      expect(params.get("pageSize")).toBe("20");
      expect(params.get("statuses")).toBe(OVERVIEW_STATUSES);
    }

    await user.click(screen.getByRole("button", { name: "下一页" }));
    await waitFor(() => {
      const [lastUrl] = apiGet.mock.lastCall!;
      const params = new URLSearchParams(String(lastUrl).split("?")[1]);
      expect(params.get("page")).toBe("2");
      expect(params.get("statuses")).toBe(OVERVIEW_STATUSES);
    });
    expect(
      await within(await screen.findByRole("table")).findByText("已归档考试21"),
    ).toBeInTheDocument();
  });

  it("B05: status badges and score-view actions stay independent server facts", async () => {
    apiGet.mockImplementation(async (url: string) => {
      if (url.startsWith("/api/exams")) {
        return {
          items: [
            examRow("e1", "进行中考试", { status: "open" }),
            examRow("e2", "已关闭无成绩考试", {
              status: "closed",
              scoreViewDisabledReasonCode: "NO_GRADED_ATTEMPTS",
              scoreViewDisabledReason: "暂无成绩数据",
            }),
            examRow("e3", "已归档可查考试", {
              status: "archived",
              gradedAttemptCount: 5,
              canViewScores: true,
              scoreViewDisabledReasonCode: null,
              scoreViewDisabledReason: null,
            }),
          ],
          total: 3,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        };
      }
      throw new Error(`unexpected GET ${url}`);
    });

    renderPage();
    const table = await screen.findByRole("table");
    // Status labels render as server facts.
    expect(within(table).getAllByText("开放中").length).toBeGreaterThan(0);
    expect(within(table).getAllByText("已关闭").length).toBeGreaterThan(0);
    expect(within(table).getAllByText("已归档").length).toBeGreaterThan(0);
    // Score-view availability follows canViewScores, never status.
    const buttons = await within(table).findAllByRole("button", {
      name: "查看成绩",
    });
    expect(buttons).toHaveLength(3);
    expect(buttons[0]).toBeDisabled();
    expect(buttons[1]).toBeDisabled();
    expect(buttons[2]).toBeEnabled();
  });
});
