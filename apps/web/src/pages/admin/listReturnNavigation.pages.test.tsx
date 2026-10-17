import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { AuthProvider } from "@/contexts/AuthContext";
import { BrandProvider } from "@/components/layout/BrandProvider";
import { ExamDetailPage } from "./ExamDetailPage";
import { QuestionEditPage } from "./QuestionEditPage";
import { permissionsForRole } from "@exam/authz";

/**
 * #784 stage A — A05 / C2 at component level: the internal return points must
 * restore the list query they were entered from, and must NEVER navigate to a
 * target outside their own list route.
 *
 * The full malformed-input matrix is pinned by the resolver's unit tests
 * (listReturnNavigation.test.ts); here the REAL pages are exercised, because a
 * correct resolver wired to a hardcoded path — or wired to the wrong list —
 * would still pass the unit tests.
 */

const { apiGet } = vi.hoisted(() => ({ apiGet: vi.fn() }));

vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {
    readonly status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = "ApiError";
      this.status = status;
    }
  },
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    post: vi.fn(),
    delete: vi.fn(),
  },
  setNavigate: () => {},
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

const examFixture = {
  id: "exam-1",
  title: "期末能力测评",
  description: "",
  courseId: "course-1",
  status: "draft",
  timingMode: "timed_window",
  durationMinutes: 60,
  openAt: new Date().toISOString(),
  closeAt: new Date(Date.now() + 86_400_000).toISOString(),
  passingScore: 60,
  totalScore: 100,
  questionIds: ["q1", "q2"],
  controlFlags: {},
  retakePolicy: "no-retake",
  scoreStrategy: "best",
  maxAttempts: 1,
  stats: { participantCount: 0, completedCount: 0, passedCount: 0 },
  participants: [],
};

/**
 * The detail page fetches its roster in parallel with the exam itself, so the
 * fixture has to answer both shapes — a single object for the exam, a list for
 * the enrollments — or the page never reaches its header actions.
 */
function mockExamDetailApi() {
  apiGet.mockImplementation((path: string) =>
    path.includes("/enrollments")
      ? Promise.resolve([])
      : Promise.resolve(examFixture),
  );
}

function LocationProbe() {
  const location = useLocation();
  return (
    <div data-testid="location">
      {location.pathname}
      {location.search}
    </div>
  );
}

function renderAt(
  entry: { pathname: string; state?: unknown },
  element: React.ReactNode,
  routePath: string,
) {
  return render(
    <MemoryRouter initialEntries={[entry]}>
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
            <Route path={routePath} element={element} />
          </Routes>
          <LocationProbe />
        </BrandProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function locationText(): string {
  return screen.getByTestId("location").textContent ?? "";
}

describe("internal return restores the list query (#784 A05 / C2)", () => {
  it("the exam detail back action returns to the filtered, paged list URL", async () => {
    mockExamDetailApi();
    const user = userEvent.setup();
    renderAt(
      {
        pathname: "/admin/exams/exam-1",
        state: { from: "/admin/exams?status=published&page=3" },
      },
      <ExamDetailPage />,
      "/admin/exams/:id",
    );

    await user.click(await screen.findByRole("button", { name: "返回列表" }));
    expect(locationText()).toBe("/admin/exams?status=published&page=3");
  });

  it("the exam detail back action falls back to the bare list for a hostile target", async () => {
    mockExamDetailApi();
    const user = userEvent.setup();
    const hostile = [
      "//evil.example/admin/exams",
      "/\\evil.example",
      "/\t/evil.example",
      "/admin/questions?page=2",
      "/admin/exams/../questions",
      "",
      "admin/exams",
    ];
    for (const from of hostile) {
      const view = renderAt(
        { pathname: "/admin/exams/exam-1", state: { from } },
        <ExamDetailPage />,
        "/admin/exams/:id",
      );
      await user.click(await screen.findByRole("button", { name: "返回列表" }));
      expect(locationText()).toBe("/admin/exams");
      view.unmount();
    }
  });

  it("the question editor cancel returns to the filtered list URL", async () => {
    apiGet.mockResolvedValue({
      items: [{ id: "course-1", name: "课程一", code: "C1" }],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
    const user = userEvent.setup();
    renderAt(
      {
        pathname: "/admin/questions/new",
        state: { from: "/admin/questions?courseId=course-1&page=2" },
      },
      <QuestionEditPage />,
      "/admin/questions/new",
    );

    await user.click(await screen.findByRole("button", { name: "取消" }));
    expect(locationText()).toBe("/admin/questions?courseId=course-1&page=2");
  });

  it("the question editor cancel falls back to the bare list for a hostile target", async () => {
    apiGet.mockResolvedValue({
      items: [{ id: "course-1", name: "课程一", code: "C1" }],
      total: 1,
      page: 1,
      pageSize: 20,
      totalPages: 1,
    });
    const user = userEvent.setup();
    renderAt(
      {
        pathname: "/admin/questions/new",
        state: { from: "/admin/exams?status=open" },
      },
      <QuestionEditPage />,
      "/admin/questions/new",
    );

    await user.click(await screen.findByRole("button", { name: "取消" }));
    // The other list's route is not an acceptable target for this exit.
    expect(locationText()).toBe("/admin/questions");
  });

  it("a detail page opened without a carried target returns to the bare list", async () => {
    mockExamDetailApi();
    const user = userEvent.setup();
    renderAt(
      { pathname: "/admin/exams/exam-1" },
      <ExamDetailPage />,
      "/admin/exams/:id",
    );

    await user.click(await screen.findByRole("button", { name: "返回列表" }));
    expect(locationText()).toBe("/admin/exams");
  });

  it("never lands outside the app origin or on a non-list route", async () => {
    mockExamDetailApi();
    const user = userEvent.setup();
    renderAt(
      {
        pathname: "/admin/exams/exam-1",
        state: { from: "https://evil.example/admin/exams" },
      },
      <ExamDetailPage />,
      "/admin/exams/:id",
    );

    await user.click(await screen.findByRole("button", { name: "返回列表" }));
    await waitFor(() => expect(locationText()).toBe("/admin/exams"));
  });
});
