import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import { AuthProvider } from "@/contexts/AuthContext";
import { BrandProvider } from "@/components/layout/BrandProvider";
import { QuestionPage } from "./QuestionPage";
import { ApiError } from "@/lib/api";
import { permissionsForRole } from "@exam/authz";

/**
 * #784 stage A — QuestionPage URL query-state oracles (A01, A02, A07-L2, A08,
 * A09, A09b, A10, A12, A14, A16, A17-L2, A18) plus the C1 course-probe
 * negative paths.
 *
 * Every assertion is bound to THREE facts at once — the URL, the query that was
 * actually issued, and what the user can see (rows, control values, empty
 * states) — because any one of them alone can be satisfied by a wrong
 * implementation.
 */

type QuestionListPayload = {
  items: Array<{
    id: string;
    courseId: string;
    type: string;
    content: string;
    score: number;
    difficulty: number;
    tags: string[];
  }>;
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

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
    delete: vi.fn().mockResolvedValue(undefined),
  },
  setNavigate: () => {},
}));

function questionRow(id: string, content: string) {
  return {
    id,
    courseId: "course-1",
    type: "true_false",
    content,
    score: 2,
    difficulty: 1,
    tags: ["tag1"],
  };
}

/** Rows for `page` out of a collection of `total`, 20 per page. */
function pagePayload(
  page: number,
  total: number,
  prefix = "第",
): QuestionListPayload {
  const size = 20;
  const start = (page - 1) * size;
  const count = Math.max(0, Math.min(size, total - start));
  return {
    items: Array.from({ length: count }, (_, i) =>
      questionRow(`q${start + i + 1}`, `${prefix}${start + i + 1}题`),
    ),
    total,
    page,
    pageSize: size,
    totalPages: Math.max(1, Math.ceil(total / size)),
  };
}

/** Serves the paginated list from a real (page, total) model. */
function mockPaginated(total: number, prefix = "第") {
  apiGet.mockImplementation(async (url: string) => {
    if (url.startsWith("/api/questions/tags")) {
      return { tags: ["代数", "几何"] };
    }
    if (/^\/api\/courses\/[^/?]+$/.test(url)) {
      // A listed course must never be probed, but a deep-linked one is; answer
      // both so the fixture cannot mask the request under test.
      const id = url.slice("/api/courses/".length);
      return { id, name: `课程${id}`, code: id.toUpperCase() };
    }
    if (url.startsWith("/api/courses")) {
      return {
        items: [
          { id: "course-1", name: "课程一", code: "C1" },
          { id: "course-2", name: "课程二", code: "C2" },
        ],
        total: 2,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      };
    }
    const params = new URLSearchParams(url.split("?")[1] ?? "");
    return pagePayload(Number(params.get("page") ?? "1"), total, prefix);
  });
}

const questionsCalls = () =>
  apiGet.mock.calls
    .filter(
      (call) =>
        typeof call[0] === "string" &&
        (call[0] as string).startsWith("/api/questions?"),
    )
    .map((call) => decodeURIComponent(call[0] as string));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-search">{location.search}</div>;
}

/** Real history navigation through the router (Back/Forward), not a URL write. */
function HistoryNav() {
  const navigate = useNavigate();
  return (
    <div>
      <button type="button" onClick={() => void navigate(-1)}>
        后退
      </button>
      <button type="button" onClick={() => void navigate(1)}>
        前进
      </button>
    </div>
  );
}

function renderPage(initialEntry: string | string[] = "/admin/questions") {
  return render(
    <MemoryRouter
      initialEntries={
        Array.isArray(initialEntry) ? initialEntry : [initialEntry]
      }
    >
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
            <Route path="/admin/questions" element={<QuestionPage />} />
            <Route
              path="/admin/questions/:id/edit"
              element={<div>编辑页</div>}
            />
          </Routes>
          <LocationProbe />
          <HistoryNav />
        </BrandProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

/** The desktop table region (rows also render in the mobile card list). */
function desktopShell(): HTMLElement {
  return document.querySelector(
    '[data-slot="admin-table-shell"]',
  ) as HTMLElement;
}

function urlSearch(): string {
  return screen.getByTestId("location-search").textContent ?? "";
}

/**
 * The course filter control. It carries no aria-label (the shared Select uses
 * its placeholder as the name), so a selected value would change its
 * accessible name — address it by its fixed toolbar position instead.
 */
function courseTrigger(): HTMLElement {
  return screen.getAllByRole("combobox")[0] as HTMLElement;
}

describe("QuestionPage URL query state (#784 A3)", () => {
  // ── A01 — a deep link restores the filters AND the controls display them ──
  it("A01: a deep link restores filter, page, controls and rows together", async () => {
    mockPaginated(61);
    renderPage(
      "/admin/questions?courseId=course-2&type=fill_blank&difficulty=3&page=3",
    );

    await screen.findByText("题目管理");
    // The request is exactly what the parameter table derives.
    await waitFor(() => {
      const last = questionsCalls().at(-1) ?? "";
      expect(last).toContain(
        "/api/questions?page=3&pageSize=20&courseId=course-2&type=fill_blank&difficulty=3",
      );
    });
    // The CONTROLS show the applied filters (a request-only implementation
    // would still render the defaults here).
    await waitFor(() =>
      expect(within(desktopShell()).getByText("第41题")).toBeInTheDocument(),
    );
    expect(courseTrigger()).toHaveTextContent("课程二");
    expect(
      screen.getByRole("combobox", { name: "按题型筛选" }),
    ).toHaveTextContent("填空题");
    expect(
      screen.getByRole("combobox", { name: "按难度筛选" }),
    ).toHaveTextContent("难度 3");
    // ...and the URL still carries them.
    expect(urlSearch()).toContain("page=3");
    expect(urlSearch()).toContain("courseId=course-2");
  });

  // ── A02 — multi-tag AND + search + page together ──
  it("A02: tags, search and page combine; tags are canonicalized (sorted, de-duplicated)", async () => {
    mockPaginated(61);
    renderPage(
      "/admin/questions?tags=%E5%87%A0%E4%BD%95,%E4%BB%A3%E6%95%B0,%E4%BB%A3%E6%95%B0&search=%E5%AF%BC%E8%88%AA&page=2",
    );

    await screen.findByText("题目管理");
    await waitFor(() => {
      const last = questionsCalls().at(-1) ?? "";
      expect(last).toContain("page=2");
      expect(last).toContain("search=导航");
      // Sorted by code unit (代数 < 几何) and de-duplicated, not left as typed.
      expect(last).toContain("tags=代数,几何");
      expect(last).not.toContain("几何,代数");
    });
    // The canonical form is also what the URL holds afterwards.
    await waitFor(() => {
      expect(urlSearch()).toContain(
        "tags=%E4%BB%A3%E6%95%B0%2C%E5%87%A0%E4%BD%95",
      );
    });
    // The search box reflects the committed term.
    expect(screen.getByLabelText("搜索题目")).toHaveValue("导航");
  });

  // ── A07 (L2) — illegal and repeated parameters never reach the API ──
  it("A07: an illegal page renders the list normally and is normalized away", async () => {
    mockPaginated(61);
    renderPage("/admin/questions?page=abc");

    await screen.findByText("题目管理");
    await waitFor(() => {
      expect(within(desktopShell()).getByText("第1题")).toBeInTheDocument();
    });
    const last = questionsCalls().at(-1) ?? "";
    expect(last).toContain("page=1&pageSize=20");
    expect(last).not.toContain("NaN");
    // The URL is corrected, not merely ignored.
    await waitFor(() => expect(urlSearch()).not.toContain("page="));
  });

  it("A07: an unknown enum value is dropped and the list renders unfiltered", async () => {
    mockPaginated(61);
    renderPage("/admin/questions?type=bogus_type&difficulty=9");

    await screen.findByText("题目管理");
    await waitFor(() => {
      const last = questionsCalls().at(-1) ?? "";
      expect(last).toContain("/api/questions?page=1&pageSize=20");
    });
    await waitFor(() => {
      expect(urlSearch()).not.toContain("type=");
      expect(urlSearch()).not.toContain("difficulty=");
    });
  });

  // ── A17 (L2) — repeated parameters keep the FIRST value; defaults omitted ──
  it("A17: a repeated page keeps its first value and the default is never written", async () => {
    mockPaginated(61);
    renderPage("/admin/questions?page=0&page=2");

    await screen.findByText("题目管理");
    // Taking the LAST value would query page 2 and keep `page=2` in the URL.
    await waitFor(() => {
      const last = questionsCalls().at(-1) ?? "";
      expect(last).toContain("page=1&pageSize=20");
    });
    await waitFor(() => expect(urlSearch()).not.toContain("page="));
  });

  it("A17: page=1 is removed from the URL", async () => {
    mockPaginated(61);
    renderPage("/admin/questions?page=1&type=fill_blank");

    await screen.findByText("题目管理");
    await waitFor(() => expect(urlSearch()).not.toContain("page="));
    expect(urlSearch()).toContain("type=fill_blank");
  });

  // ── A08 — the newest request wins, including for a page turn ──
  it("A08: a late out-of-order response for another page never renders", async () => {
    type Deferred = { url: string; resolve: (v: QuestionListPayload) => void };
    const pending: Deferred[] = [];
    apiGet.mockImplementation((url: string) => {
      if (url.startsWith("/api/questions?")) {
        return new Promise<QuestionListPayload>((resolve) => {
          pending.push({ url, resolve });
        });
      }
      if (url.startsWith("/api/questions/tags"))
        return Promise.resolve({ tags: [] });
      return Promise.resolve({
        items: [
          { id: "course-1", name: "课程一", code: "C1" },
          { id: "course-2", name: "课程二", code: "C2" },
        ],
        total: 2,
        page: 1,
        pageSize: 20,
        totalPages: 1,
      });
    });

    renderPage();
    await waitFor(() => expect(pending).toHaveLength(1));
    await act(async () => {
      pending[0]!.resolve(pagePayload(1, 60));
    });
    await waitFor(() =>
      expect(within(desktopShell()).getByText("第1题")).toBeInTheDocument(),
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "下一页" }));
    await user.click(screen.getByRole("button", { name: "下一页" }));
    await waitFor(() => expect(pending).toHaveLength(3));
    const page2 = pending[1]!;
    const page3 = pending[2]!;
    expect(decodeURIComponent(page2.url)).toContain("page=2");
    expect(decodeURIComponent(page3.url)).toContain("page=3");

    // The NEWER request (page 3) lands first; the page-2 response arrives last.
    await act(async () => {
      page3.resolve(pagePayload(3, 60));
    });
    await waitFor(() =>
      expect(within(desktopShell()).getByText("第41题")).toBeInTheDocument(),
    );
    await act(async () => {
      page2.resolve(pagePayload(2, 60));
    });
    expect(
      within(desktopShell()).queryByText("第21题"),
    ).not.toBeInTheDocument();
    expect(within(desktopShell()).getByText("第41题")).toBeInTheDocument();
  });

  // ── A09 — a cross-identity pending window shows neither old rows nor an
  //    empty state, in EITHER representation ──
  it("A09: while a new filter is in flight the old identity's rows are gone from the whole document", async () => {
    let resolveFiltered!: (v: QuestionListPayload) => void;
    const filtered = new Promise<QuestionListPayload>((resolve) => {
      resolveFiltered = resolve;
    });
    apiGet.mockImplementation((url: string) => {
      if (url.startsWith("/api/questions/tags"))
        return Promise.resolve({ tags: [] });
      if (/^\/api\/courses\/[^/?]+$/.test(url)) {
        return Promise.resolve({ id: "course-2", name: "课程二", code: "C2" });
      }
      if (url.startsWith("/api/courses")) {
        return Promise.resolve({
          items: [
            { id: "course-1", name: "课程一", code: "C1" },
            { id: "course-2", name: "课程二", code: "C2" },
          ],
          total: 2,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        });
      }
      if (decodeURIComponent(url).includes("courseId=course-2")) {
        return filtered;
      }
      return Promise.resolve(pagePayload(1, 21));
    });

    renderPage();
    await waitFor(() =>
      expect(within(desktopShell()).getByText("第1题")).toBeInTheDocument(),
    );

    const user = userEvent.setup();
    await user.click(courseTrigger());
    await user.click(await screen.findByRole("option", { name: "课程二" }));

    // The new identity is in flight: no old row anywhere in the document, no
    // empty state, no actionable row control, and no stale row action.
    expect(screen.queryByText("第1题")).not.toBeInTheDocument();
    expect(screen.queryByText("暂无题目")).not.toBeInTheDocument();
    expect(screen.queryByText("未找到匹配的题目")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "编辑题目" }),
    ).not.toBeInTheDocument();

    await act(async () => {
      resolveFiltered(pagePayload(1, 3, "筛选后"));
    });
    await waitFor(() =>
      expect(within(desktopShell()).getByText("筛选后1题")).toBeInTheDocument(),
    );
  });

  // ── A09b — the same-identity page-turn window stays bounded ──
  it("A09b: a page turn keeps the previous slice with an in-flight signal and never shows an empty state", async () => {
    let resolvePage2!: (v: QuestionListPayload) => void;
    const page2Response = new Promise<QuestionListPayload>((resolve) => {
      resolvePage2 = resolve;
    });
    apiGet.mockImplementation((url: string) => {
      if (url.startsWith("/api/questions/tags"))
        return Promise.resolve({ tags: [] });
      if (url.startsWith("/api/courses")) {
        return Promise.resolve({
          items: [{ id: "course-1", name: "课程一", code: "C1" }],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        });
      }
      const page = Number(new URLSearchParams(url.split("?")[1]).get("page"));
      if (page === 2) return page2Response;
      return Promise.resolve(pagePayload(1, 41));
    });

    renderPage();
    await waitFor(() =>
      expect(within(desktopShell()).getByText("第1题")).toBeInTheDocument(),
    );

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "下一页" }));

    // Page turn: the previous slice stays, with the in-flight signal, and no
    // empty state — the shell must NOT be replaced by a loading placeholder.
    expect(within(desktopShell()).getByText("第1题")).toBeInTheDocument();
    expect(
      desktopShell().querySelector('[aria-busy="true"]'),
    ).toBeInTheDocument();
    expect(screen.queryByText("暂无题目")).not.toBeInTheDocument();
    expect(screen.queryByText("未找到匹配的题目")).not.toBeInTheDocument();

    await act(async () => {
      resolvePage2(pagePayload(2, 41));
    });
    // page≥2 must land: a render key mixed with a request key would leave the
    // gate pending forever here.
    await waitFor(() =>
      expect(within(desktopShell()).getByText("第21题")).toBeInTheDocument(),
    );
    expect(
      desktopShell().querySelector('[aria-busy="true"]'),
    ).not.toBeInTheDocument();
  });

  // ── A10 — out-of-range recovery is a single jump with no fake empty state ──
  it("A10: an out-of-range page recovers in one jump and never renders a fake empty state", async () => {
    const calls: string[] = [];
    apiGet.mockImplementation((url: string) => {
      if (url.startsWith("/api/questions/tags"))
        return Promise.resolve({ tags: [] });
      if (url.startsWith("/api/courses")) {
        return Promise.resolve({
          items: [{ id: "course-1", name: "课程一", code: "C1" }],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        });
      }
      calls.push(decodeURIComponent(url));
      const page = Number(new URLSearchParams(url.split("?")[1]).get("page"));
      // 21 records ⇒ two real pages, so page 3 answers empty.
      if (page > 2)
        return Promise.resolve({ ...pagePayload(1, 21), page, items: [] });
      return Promise.resolve(pagePayload(page, 21));
    });

    renderPage("/admin/questions?page=3");

    await waitFor(() =>
      expect(within(desktopShell()).getByText("第21题")).toBeInTheDocument(),
    );
    // Exactly two requests: the out-of-range page and the single jump back —
    // no step-by-step walk.
    expect(calls.map((c) => c.match(/page=(\d+)/)?.[1])).toEqual(["3", "2"]);
    // The URL now names the page that is actually rendered.
    expect(urlSearch()).toContain("page=2");
    expect(screen.queryByText("未找到匹配的题目")).not.toBeInTheDocument();
    expect(screen.queryByText("暂无题目")).not.toBeInTheDocument();
  });

  it("A10: an out-of-range page with no records at all recovers to page 1", async () => {
    apiGet.mockImplementation((url: string) => {
      if (url.startsWith("/api/questions/tags"))
        return Promise.resolve({ tags: [] });
      if (url.startsWith("/api/courses")) {
        return Promise.resolve({
          items: [],
          total: 0,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        });
      }
      const page = Number(new URLSearchParams(url.split("?")[1]).get("page"));
      if (page > 1) {
        return Promise.resolve({ ...pagePayload(1, 0), page, items: [] });
      }
      return Promise.resolve(pagePayload(1, 0));
    });

    renderPage("/admin/questions?page=4");
    await waitFor(() => expect(urlSearch()).not.toContain("page="));
    await waitFor(() =>
      expect(within(desktopShell()).getByText("暂无题目")).toBeInTheDocument(),
    );
  });

  it("A10: a NON-EMPTY page is never discarded even when total says otherwise", async () => {
    apiGet.mockImplementation((url: string) => {
      if (url.startsWith("/api/questions/tags"))
        return Promise.resolve({ tags: [] });
      if (url.startsWith("/api/courses")) {
        return Promise.resolve({
          items: [],
          total: 0,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        });
      }
      const page = Number(new URLSearchParams(url.split("?")[1]).get("page"));
      if (page === 4) {
        // Concurrent delete between the paged SELECT and the COUNT: rows exist
        // but the total is too small for this page.
        return Promise.resolve({
          items: [questionRow("q-real", "并发删除后的真实数据")],
          total: 20,
          page: 4,
          pageSize: 20,
          totalPages: 1,
        });
      }
      return Promise.resolve(pagePayload(page, 20));
    });

    renderPage("/admin/questions?page=4");
    await waitFor(() =>
      expect(
        within(desktopShell()).getByText("并发删除后的真实数据"),
      ).toBeInTheDocument(),
    );
    expect(urlSearch()).toContain("page=4");
  });

  // ── A12 — atomic writes, and an external navigation cancels a draft ──
  it("A12(a): a debounced search commit and an immediate filter write both survive one task", async () => {
    mockPaginated(61);
    vi.useFakeTimers({ shouldAdvanceTime: false });
    try {
      renderPage();
      await act(async () => {});

      fireEvent.change(screen.getByLabelText("搜索题目"), {
        target: { value: "导航" },
      });
      // One advance past the debounce deadline, then an IMMEDIATE write in the
      // same act: if the second write started from render-time params it would
      // drop the just-committed search.
      await act(async () => {
        await vi.advanceTimersByTimeAsync(300);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "下一页" }));
      });

      expect(urlSearch()).toContain("search=");
      expect(urlSearch()).toContain("page=2");
      const last = questionsCalls().at(-1) ?? "";
      expect(last).toContain("search=导航");
      expect(last).toContain("page=2");
    } finally {
      vi.useRealTimers();
    }
  });

  it("A12(c): an external Back cancels an unlanded debounce commit", async () => {
    mockPaginated(61);
    const user = userEvent.setup();
    // Entry 1 is the bare list; entry 2 (current) carries the committed search.
    renderPage(["/admin/questions", "/admin/questions?search=abc"]);
    await waitFor(() =>
      expect(within(desktopShell()).getByText("第1题")).toBeInTheDocument(),
    );
    expect(screen.getByLabelText("搜索题目")).toHaveValue("abc");

    // Type, then navigate away BEFORE the debounce deadline. The draft belongs
    // to an entry the user has left, so it must neither land nor survive.
    fireEvent.change(screen.getByLabelText("搜索题目"), {
      target: { value: "abcd" },
    });
    await act(async () => {
      await user.click(screen.getByRole("button", { name: "后退" }));
    });
    // Past the debounce deadline: a stale draft landing here would write
    // search=abcd into the entry the user just navigated to.
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
    expect(urlSearch()).not.toContain("search=");
    expect(screen.getByLabelText("搜索题目")).toHaveValue("");
  });

  it("A12(d): a page-authored write does NOT cancel the draft the user typed", async () => {
    mockPaginated(61);
    const user = userEvent.setup();
    renderPage("/admin/questions?search=abc");
    await waitFor(() =>
      expect(within(desktopShell()).getByText("第1题")).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText("搜索题目"), {
      target: { value: "abcd" },
    });
    // An immediate write this page makes (a page turn) must not be mistaken
    // for an external navigation: the draft has to survive and land.
    await user.click(screen.getByRole("button", { name: "下一页" }));
    await waitFor(() => expect(urlSearch()).toContain("page=2"));
    expect(screen.getByLabelText("搜索题目")).toHaveValue("abcd");
    await waitFor(() =>
      expect(questionsCalls().at(-1) ?? "").toContain("search=abcd"),
    );
  });

  // ── A14 + C1 — an applied course filter must be displayable or dropped ──
  it("A14: a deep-linked course id outside the loaded options is resolved and displayed", async () => {
    const probes: string[] = [];
    apiGet.mockImplementation((url: string) => {
      if (/^\/api\/courses\/[^/?]+$/.test(url)) {
        probes.push(url);
        return Promise.resolve({
          id: "course-9",
          name: "第九课程",
          code: "C9",
        });
      }
      if (url.startsWith("/api/courses")) {
        return Promise.resolve({
          items: [{ id: "course-1", name: "课程一", code: "C1" }],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        });
      }
      if (url.startsWith("/api/questions/tags"))
        return Promise.resolve({ tags: [] });
      return Promise.resolve(pagePayload(1, 3));
    });

    renderPage("/admin/questions?courseId=course-9");

    await waitFor(() => expect(courseTrigger()).toHaveTextContent("第九课程"));
    expect(probes).toEqual(["/api/courses/course-9"]);
    // The list request carries the resolved id and is issued AFTER the probe.
    const last = questionsCalls().at(-1) ?? "";
    expect(last).toContain("courseId=course-9");
  });

  it("A14/C1: a course id already in the options is used without a probe", async () => {
    const probes: string[] = [];
    apiGet.mockImplementation((url: string) => {
      if (/^\/api\/courses\/[^/?]+$/.test(url)) {
        probes.push(url);
        return Promise.reject(new Error("must not probe a listed course"));
      }
      if (url.startsWith("/api/courses")) {
        return Promise.resolve({
          items: [{ id: "course-1", name: "课程一", code: "C1" }],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        });
      }
      if (url.startsWith("/api/questions/tags"))
        return Promise.resolve({ tags: [] });
      return Promise.resolve(pagePayload(1, 3));
    });

    renderPage("/admin/questions?courseId=course-1");
    await waitFor(() =>
      expect(questionsCalls().at(-1) ?? "").toContain("courseId=course-1"),
    );
    expect(probes).toEqual([]);
  });

  it("C1: a deterministic 404 drops the course filter and normalizes the URL", async () => {
    apiGet.mockImplementation((url: string) => {
      if (/^\/api\/courses\/[^/?]+$/.test(url)) {
        return Promise.reject(new ApiError(404, "not found"));
      }
      if (url.startsWith("/api/courses")) {
        return Promise.resolve({
          items: [{ id: "course-1", name: "课程一", code: "C1" }],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        });
      }
      if (url.startsWith("/api/questions/tags"))
        return Promise.resolve({ tags: [] });
      return Promise.resolve(pagePayload(1, 3));
    });

    renderPage("/admin/questions?courseId=ghost-course&page=2");

    await waitFor(() => expect(urlSearch()).not.toContain("courseId="));
    await waitFor(() =>
      expect(questionsCalls().at(-1) ?? "").not.toContain("courseId="),
    );
    // Page 2 is preserved: only the undisplayable filter is dropped.
    expect(urlSearch()).toContain("page=2");
  });

  it("C1: a transient probe failure keeps the filter and offers retry instead of dropping it", async () => {
    let failProbe = true;
    apiGet.mockImplementation((url: string) => {
      if (/^\/api\/courses\/[^/?]+$/.test(url)) {
        if (failProbe) return Promise.reject(new Error("network down"));
        return Promise.resolve({
          id: "course-9",
          name: "第九课程",
          code: "C9",
        });
      }
      if (url.startsWith("/api/courses")) {
        return Promise.resolve({
          items: [{ id: "course-1", name: "课程一", code: "C1" }],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        });
      }
      if (url.startsWith("/api/questions/tags"))
        return Promise.resolve({ tags: [] });
      return Promise.resolve(pagePayload(1, 3));
    });

    renderPage("/admin/questions?courseId=course-9");

    // The user's intent is preserved: the parameter is still in the URL and the
    // page offers a retry rather than pretending the course does not exist.
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(urlSearch()).toContain("courseId=course-9");
    // No list request was issued for an identity that is not yet established.
    expect(questionsCalls()).toHaveLength(0);

    failProbe = false;
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "重试" }));
    await waitFor(() => expect(courseTrigger()).toHaveTextContent("第九课程"));
    expect(questionsCalls().at(-1) ?? "").toContain("courseId=course-9");
  });

  it("C1: a course id is encoded before it is probed", async () => {
    const probes: string[] = [];
    apiGet.mockImplementation((url: string) => {
      if (/^\/api\/courses\//.test(url)) {
        probes.push(url);
        return Promise.reject(new ApiError(404, "not found"));
      }
      if (url.startsWith("/api/questions/tags"))
        return Promise.resolve({ tags: [] });
      return Promise.resolve(pagePayload(1, 0));
    });

    renderPage("/admin/questions?courseId=..%2Fquestions%2Ftags");

    await waitFor(() => expect(probes).toHaveLength(1));
    // The path is escaped, so the probe cannot address a DIFFERENT endpoint.
    expect(probes[0]).toBe("/api/courses/..%2Fquestions%2Ftags");
    expect(probes[0]).not.toContain("/api/questions/tags");
  });

  // ── A16 — the four failure classes ──
  it("A16: a first-load failure is a page-level error, not a permanent loader", async () => {
    apiGet.mockImplementation((url: string) => {
      if (url.startsWith("/api/questions/tags"))
        return Promise.resolve({ tags: [] });
      if (url.startsWith("/api/courses")) {
        return Promise.resolve({
          items: [],
          total: 0,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        });
      }
      return Promise.reject(new Error("boom"));
    });

    renderPage();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("加载考生列表失败");
    expect(screen.queryByText("加载中...")).not.toBeInTheDocument();
  });

  it("A16: a cross-identity failure takes over the page and drops the old rows", async () => {
    apiGet.mockImplementation((url: string) => {
      if (url.startsWith("/api/questions/tags"))
        return Promise.resolve({ tags: [] });
      if (url.startsWith("/api/courses")) {
        return Promise.resolve({
          items: [
            { id: "course-1", name: "课程一", code: "C1" },
            { id: "course-2", name: "课程二", code: "C2" },
          ],
          total: 2,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        });
      }
      if (decodeURIComponent(url).includes("courseId=course-2")) {
        return Promise.reject(new Error("boom"));
      }
      return Promise.resolve(pagePayload(1, 21));
    });

    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(within(desktopShell()).getByText("第1题")).toBeInTheDocument(),
    );

    await user.click(courseTrigger());
    await user.click(await screen.findByRole("option", { name: "课程二" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("加载考生列表失败");
    // The old identity's rows are not shown next to the error, and the shell
    // that could keep them is gone.
    expect(screen.queryByText("第1题")).not.toBeInTheDocument();
    expect(screen.queryByRole("toolbar")).not.toBeInTheDocument();
  });

  it("A16: moving on after a failure shows the new query, not the old error", async () => {
    apiGet.mockImplementation((url: string) => {
      if (url.startsWith("/api/questions/tags"))
        return Promise.resolve({ tags: [] });
      if (/^\/api\/courses\/[^/?]+$/.test(url)) {
        // Resolvable (so the filter survives normalization) but the LIST
        // request for it fails — the failure under test.
        const id = url.slice("/api/courses/".length);
        return Promise.resolve({ id, name: `课程${id}`, code: "G" });
      }
      if (url.startsWith("/api/courses")) {
        return Promise.resolve({
          items: [],
          total: 0,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        });
      }
      if (decodeURIComponent(url).includes("courseId=ghost")) {
        return Promise.reject(new Error("boom"));
      }
      return Promise.resolve(pagePayload(1, 21));
    });

    const user = userEvent.setup();
    // Entry 1 is the bare list; entry 2 (current) is the failing query.
    renderPage(["/admin/questions", "/admin/questions?courseId=ghost"]);
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("加载考生列表失败");

    await user.click(screen.getByRole("button", { name: "后退" }));
    await waitFor(() =>
      expect(within(desktopShell()).getByText("第1题")).toBeInTheDocument(),
    );
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("A16: a same-identity page-turn failure keeps the shell and renders the body error row", async () => {
    apiGet.mockImplementation((url: string) => {
      if (url.startsWith("/api/questions/tags"))
        return Promise.resolve({ tags: [] });
      if (url.startsWith("/api/courses")) {
        return Promise.resolve({
          items: [],
          total: 0,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        });
      }
      const page = Number(new URLSearchParams(url.split("?")[1]).get("page"));
      if (page === 2) return Promise.reject(new Error("boom"));
      return Promise.resolve(pagePayload(1, 41));
    });

    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(within(desktopShell()).getByText("第1题")).toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "下一页" }));
    // The shell survives (no page-level takeover) and the body states the
    // failure — the page-level error path would unmount the toolbar.
    await waitFor(() =>
      expect(
        within(desktopShell()).getByText("加载考生列表失败"),
      ).toBeInTheDocument(),
    );
    expect(screen.getByRole("toolbar")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("A16: a same-identity page-turn failure does not persist into the next page turn", async () => {
    apiGet.mockImplementation((url: string) => {
      if (url.startsWith("/api/questions/tags"))
        return Promise.resolve({ tags: [] });
      if (url.startsWith("/api/courses")) {
        return Promise.resolve({
          items: [],
          total: 0,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        });
      }
      const page = Number(new URLSearchParams(url.split("?")[1]).get("page"));
      if (page === 2) return Promise.reject(new Error("boom"));
      return Promise.resolve(pagePayload(page, 61));
    });

    const user = userEvent.setup();
    renderPage();
    await waitFor(() =>
      expect(within(desktopShell()).getByText("第1题")).toBeInTheDocument(),
    );
    await user.click(screen.getByRole("button", { name: "下一页" }));
    await waitFor(() =>
      expect(
        within(desktopShell()).getByText("加载考生列表失败"),
      ).toBeInTheDocument(),
    );

    // The next page turn is a different request: the previous failure must not
    // keep occupying the body while the new slice is in flight.
    await user.click(screen.getByRole("button", { name: "下一页" }));
    await waitFor(() =>
      expect(within(desktopShell()).getByText("第41题")).toBeInTheDocument(),
    );
    expect(
      within(desktopShell()).queryByText("加载考生列表失败"),
    ).not.toBeInTheDocument();
  });

  it("A16: a clamp refetch that fails leaves the pending state and reports it", async () => {
    apiGet.mockImplementation((url: string) => {
      if (url.startsWith("/api/questions/tags"))
        return Promise.resolve({ tags: [] });
      if (url.startsWith("/api/courses")) {
        return Promise.resolve({
          items: [],
          total: 0,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        });
      }
      const page = Number(new URLSearchParams(url.split("?")[1]).get("page"));
      // 21 records ⇒ page 3 is out of range, so the recovery refetch happens.
      if (page > 2) {
        return Promise.resolve({ ...pagePayload(1, 21), page, items: [] });
      }
      return Promise.reject(new Error("boom"));
    });

    renderPage("/admin/questions?page=3");
    // The recovery refetch fails: the page must leave the pending state and
    // state the failure rather than loading forever.
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("加载考生列表失败");
    expect(screen.queryByText("加载中...")).not.toBeInTheDocument();
  });

  // ── A18 — a selected tag outside the vocabulary stays observable ──
  it("A18: a selected tag the vocabulary does not offer is listed and can be removed", async () => {
    apiGet.mockImplementation((url: string) => {
      if (url.startsWith("/api/questions/tags")) {
        return Promise.resolve({ tags: ["代数", "几何"] });
      }
      if (url.startsWith("/api/courses")) {
        return Promise.resolve({
          items: [{ id: "course-1", name: "课程一", code: "C1" }],
          total: 1,
          page: 1,
          pageSize: 20,
          totalPages: 1,
        });
      }
      return Promise.resolve(pagePayload(1, 2));
    });

    const user = userEvent.setup();
    renderPage(
      "/admin/questions?tags=%E4%BB%A3%E6%95%B0,%E9%99%88%E6%97%A7%E6%A0%87%E7%AD%BE",
    );
    await screen.findByText("题目管理");
    expect(screen.getByRole("button", { name: "标签筛选" })).toHaveTextContent(
      "代数 +1",
    );

    await user.click(screen.getByRole("button", { name: "标签筛选" }));
    // The non-vocabulary tag is listed as a checked option...
    const stale = await screen.findByRole("checkbox", { name: "陈旧标签" });
    expect(stale).toBeChecked();
    // ...and can be removed on its own, without touching the other tag.
    await user.click(stale);
    await waitFor(() => {
      const last = questionsCalls().at(-1) ?? "";
      expect(last).toContain("tags=代数");
      expect(last).not.toContain("陈旧标签");
    });
    expect(urlSearch()).not.toContain("%E9%99%88%E6%97%A7");
  });

  // ── Internal navigation carries the list query ──
  it("carries the current list query into an edit navigation", async () => {
    mockPaginated(61);
    const user = userEvent.setup();
    renderPage("/admin/questions?courseId=course-1&page=2");
    await waitFor(() =>
      expect(within(desktopShell()).getByText("第21题")).toBeInTheDocument(),
    );

    await user.click(
      within(desktopShell()).getAllByRole("button", { name: "编辑题目" })[0]!,
    );
    expect(await screen.findByText("编辑页")).toBeInTheDocument();
  });
});
