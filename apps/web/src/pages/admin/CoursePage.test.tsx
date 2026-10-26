import { render, screen, within, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { MemoryRouter, Route, Routes } from "react-router";
import { AuthProvider } from "@/contexts/AuthContext";
import { BrandProvider } from "@/components/layout/BrandProvider";
import { CoursePage } from "./CoursePage";
import { permissionsForRole } from "@exam/authz";

const { apiGet, apiPost, apiPatch, apiDelete } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPatch: vi.fn(),
  apiDelete: vi.fn(),
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
    post: (...args: unknown[]) => apiPost(...args),
    patch: (...args: unknown[]) => apiPatch(...args),
    delete: (...args: unknown[]) => apiDelete(...args),
  },
  setNavigate: () => {},
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

function renderPage() {
  return render(
    <MemoryRouter initialEntries={["/admin/courses"]}>
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
            <Route path="/admin/courses" element={<CoursePage />} />
          </Routes>
        </BrandProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const mockCourses = [
  {
    id: "c1",
    name: "数学",
    code: "MATH101",
    description: "高等数学",
    createdAt: "2025-01-01",
    updatedAt: "2025-01-01",
  },
  {
    id: "c2",
    name: "英语",
    code: "ENG101",
    description: "大学英语",
    createdAt: "2025-01-02",
    updatedAt: "2025-01-02",
  },
];

describe("CoursePage", () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiPost.mockReset();
    apiPatch.mockReset();
    apiDelete.mockReset();
    // #785: the list is server-searched and server-paginated — the default
    // mock honors page/pageSize/search like the real route.
    apiGet.mockImplementation((path: string) => {
      if (!path.startsWith("/api/courses")) {
        return Promise.resolve({});
      }
      const params = new URLSearchParams(path.split("?")[1] ?? "");
      const page = Number(params.get("page") ?? "1");
      const pageSize = Number(params.get("pageSize") ?? "20");
      const search = (params.get("search") ?? "").trim().toLowerCase();
      const matched = search
        ? mockCourses.filter(
            (c) =>
              c.name.toLowerCase().includes(search) ||
              c.code.toLowerCase().includes(search),
          )
        : mockCourses;
      const start = (page - 1) * pageSize;
      return Promise.resolve({
        items: matched.slice(start, start + pageSize),
        total: matched.length,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(matched.length / pageSize)),
      });
    });
    apiPost.mockResolvedValue({ id: "c3" });
    apiPatch.mockResolvedValue(undefined);
    apiDelete.mockResolvedValue(undefined);
  });

  it("renders course list", async () => {
    renderPage();
    // Row content renders twice by design (desktop table + mobile cards);
    // scope to the desktop table representation.
    const table = await screen.findByRole("table");
    expect(within(table).getByText("数学")).toBeInTheDocument();
    expect(within(table).getByText("MATH101")).toBeInTheDocument();
    expect(within(table).getByText("英语")).toBeInTheDocument();
  });

  it("opens create dialog", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Nueva comisión" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Nombre/)).toHaveValue("");
    expect(within(dialog).getByLabelText(/Código/)).toHaveValue("");
  });

  it("exposes required state and hides the visual asterisk from AT", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Nueva comisión" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByLabelText(/Nombre/)).toBeRequired();
    expect(within(dialog).getByLabelText(/Código/)).toBeRequired();
    const nameLabel = within(dialog).getByText("Nombre").closest("label")!;
    const codeLabel = within(dialog).getByText("Código").closest("label")!;
    expect(within(nameLabel).getByText("*")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
    expect(within(codeLabel).getByText("*")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("shows validation errors for empty fields", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Nueva comisión" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.getByText("Ingresa el nombre de la comisión")).toBeInTheDocument();
    expect(screen.getByText("Ingresa el código de la comisión")).toBeInTheDocument();
  });

  it("creates a new course", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Nueva comisión" }));
    await user.type(screen.getByLabelText(/Nombre/), "物理");
    await user.type(screen.getByLabelText(/Código/), "PHY101");
    await user.type(screen.getByLabelText("Descripción"), "大学物理");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(apiPost).toHaveBeenCalledWith("/api/courses", {
      name: "物理",
      code: "PHY101",
      description: "大学物理",
    });
  });

  it("clears field error on input change", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Nueva comisión" }));
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.getByText("Ingresa el nombre de la comisión")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/Nombre/), "物理");
    expect(screen.queryByText("Ingresa el nombre de la comisión")).not.toBeInTheDocument();
  });

  it("opens edit dialog with course data", async () => {
    const user = userEvent.setup();
    renderPage();
    const editButtons = await screen.findAllByLabelText("Editar comisión");
    await user.click(editButtons[0]!);
    expect(screen.getByText("Editar comisión")).toBeInTheDocument();
    expect(screen.getByLabelText(/Nombre/)).toHaveValue("数学");
    expect(screen.getByLabelText(/Código/)).toHaveValue("MATH101");
  });

  it("saves edited course", async () => {
    const user = userEvent.setup();
    renderPage();
    const editButtons = await screen.findAllByLabelText("Editar comisión");
    await user.click(editButtons[0]!);
    const nameInput = screen.getByLabelText(/Nombre/);
    await user.clear(nameInput);
    await user.type(nameInput, "高等数学A");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(apiPatch).toHaveBeenCalledWith("/api/courses/c1", {
      name: "高等数学A",
      code: "MATH101",
      description: "高等数学",
    });
  });

  it("deletes a course after confirmation", async () => {
    const user = userEvent.setup();
    renderPage();
    const deleteButtons = await screen.findAllByLabelText("Eliminar comisión");
    await user.click(deleteButtons[0]!);
    const dialog = await screen.findByRole("alertdialog");
    const confirmBtn = within(dialog).getByRole("button", { name: "Confirmar" });
    await user.click(confirmBtn);
    expect(apiDelete).toHaveBeenCalledWith("/api/courses/c1");
  });

  it("searches courses by name", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("table");
    await user.type(screen.getByPlaceholderText("Buscar por nombre o código..."), "数");
    await waitFor(() => {
      const [lastUrl] = apiGet.mock.lastCall!;
      expect(
        new URLSearchParams(String(lastUrl).split("?")[1]).get("search"),
      ).toBe("数");
    });
    // Sync on the filtered render (英语 drops out) before asserting 数学.
    await waitFor(() => {
      expect(
        within(screen.getByRole("table")).queryByText("英语"),
      ).not.toBeInTheDocument();
    });
    expect(
      within(screen.getByRole("table")).getByText("数学"),
    ).toBeInTheDocument();
  });

  it("searches courses by code", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("table");
    await user.type(
      screen.getByPlaceholderText("Buscar por nombre o código..."),
      "ENG",
    );
    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith(
        "/api/courses?page=1&pageSize=20&search=ENG",
      );
    });
    await waitFor(() => {
      expect(
        within(screen.getByRole("table")).queryByText("数学"),
      ).not.toBeInTheDocument();
    });
    expect(
      within(screen.getByRole("table")).getByText("英语"),
    ).toBeInTheDocument();
  });

  it("shows empty search result state with clear action", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByRole("table");
    await user.type(
      screen.getByPlaceholderText("Buscar por nombre o código..."),
      "不存在",
    );
    expect(
      await screen.findByRole("heading", { name: "Ninguna comisión coincide" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Buscar comisiones")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Borrar búsqueda de comisiones" }));
    await waitFor(() => {
      expect(apiGet).toHaveBeenLastCalledWith(
        "/api/courses?page=1&pageSize=20",
      );
    });
    expect(
      await within(await screen.findByRole("table")).findByText("数学"),
    ).toBeInTheDocument();
    await user.type(screen.getByLabelText("Buscar comisiones"), "不存在");
    await waitFor(() => {
      const [lastUrl] = apiGet.mock.lastCall!;
      expect(
        new URLSearchParams(String(lastUrl).split("?")[1]).get("search"),
      ).toBe("不存在");
    });
    // The empty-state action only exists once the no-match response rendered.
    await user.click(await screen.findByRole("button", { name: "Borrar búsqueda" }));
    await waitFor(() => {
      expect(apiGet).toHaveBeenLastCalledWith(
        "/api/courses?page=1&pageSize=20",
      );
    });
    expect(
      await within(await screen.findByRole("table")).findByText("英语"),
    ).toBeInTheDocument();
  });

  it("shows error state when loading fails", async () => {
    apiGet.mockRejectedValue(new Error("fail"));
    renderPage();
    expect(await screen.findByText("No se pudo cargar la lista de comisiones")).toBeInTheDocument();
  });

  it("shows empty state when no courses", async () => {
    apiGet.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });
    renderPage();
    expect(
      await screen.findByRole("heading", { name: "No hay comisiones" }),
    ).toBeInTheDocument();
  });

  it("shows saving state during save", async () => {
    let resolveSave: (value: unknown) => void;
    apiPost.mockReturnValue(
      new Promise((resolve) => {
        resolveSave = resolve;
      }),
    );
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Nueva comisión" }));
    await user.type(screen.getByLabelText(/Nombre/), "物理");
    await user.type(screen.getByLabelText(/Código/), "PHY101");
    await user.click(screen.getByRole("button", { name: "Guardar" }));
    expect(screen.getByText("Guardando...")).toBeInTheDocument();
    resolveSave!({ id: "c3" });
    await waitFor(() => {
      expect(screen.queryByText("Guardando...")).not.toBeInTheDocument();
    });
  });

  it("closes dialog on cancel", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(await screen.findByRole("button", { name: "Nueva comisión" }));
    const dialog = screen.getByRole("dialog");
    const cancelBtn = within(dialog)
      .getAllByRole("button")
      .find((b) => b.textContent === "Cancelar")!;
    await user.click(cancelBtn);
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("does not show search when no courses exist", async () => {
    apiGet.mockResolvedValue({
      items: [],
      total: 0,
      page: 1,
      pageSize: 20,
      totalPages: 0,
    });
    renderPage();
    await screen.findByRole("heading", { name: "No hay comisiones" });
    expect(
      screen.queryByPlaceholderText("Buscar por nombre o código..."),
    ).not.toBeInTheDocument();
  });
});

/**
 * #785 BDD acceptance — L2 (component level; mocked API with the REAL
 * paginated response shape). Scenario source:
 * docs/design/admin-list-pagination-bdd.md (B03).
 */
describe("CoursePage #785 server-side search and pagination (BDD L2)", () => {
  function courseRow(id: string, name: string, code: string) {
    return {
      id,
      name,
      code,
      description: "",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }

  /** Serves /api/courses with real pagination shapes, honoring page and search. */
  function mockCourseApi(all: ReturnType<typeof courseRow>[]) {
    apiGet.mockImplementation(async (url: string) => {
      if (!url.startsWith("/api/courses")) {
        throw new Error(`unexpected GET ${url}`);
      }
      const params = new URLSearchParams(url.split("?")[1] ?? "");
      const page = Number(params.get("page") ?? "1");
      const pageSize = Number(params.get("pageSize") ?? "20");
      const search = (params.get("search") ?? "").trim().toLowerCase();
      const matched = search
        ? all.filter(
            (c) =>
              c.name.toLowerCase().includes(search) ||
              c.code.toLowerCase().includes(search),
          )
        : all;
      const start = (page - 1) * pageSize;
      return {
        items: matched.slice(start, start + pageSize),
        total: matched.length,
        page,
        pageSize,
        totalPages: Math.max(1, Math.ceil(matched.length / pageSize)),
      };
    });
  }

  it("B03: courses beyond the first page are reachable and the total is real", async () => {
    const user = userEvent.setup();
    const all = Array.from({ length: 21 }, (_, i) =>
      courseRow(
        `co${i + 1}`,
        `Comisión${String(i + 1).padStart(2, "0")}`,
        `C${i + 1}`,
      ),
    );
    mockCourseApi(all);

    renderPage();
    const table = await screen.findByRole("table");
    expect(within(table).getByText("Comisión01")).toBeInTheDocument();
    expect(within(table).queryByText("Comisión21")).not.toBeInTheDocument();
    expect(screen.getByText(/共 21 条/)).toBeInTheDocument();
    expect(apiGet).toHaveBeenCalledWith("/api/courses?page=1&pageSize=20");

    await user.click(screen.getByRole("button", { name: "Página siguiente" }));
    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith("/api/courses?page=2&pageSize=20");
    });
    expect(
      await within(await screen.findByRole("table")).findByText("Comisión21"),
    ).toBeInTheDocument();
  });

  it("B03: search queries the server full set and survives page flips", async () => {
    const user = userEvent.setup();
    const all = [
      ...Array.from({ length: 25 }, (_, i) =>
        courseRow(`co${i + 1}`, `bulk785 Comisión${i + 1}`, `B785-${i + 1}`),
      ),
      ...Array.from({ length: 15 }, (_, i) =>
        courseRow(`ot${i + 1}`, `其他课程${i + 1}`, `OTH-${i + 1}`),
      ),
    ];
    mockCourseApi(all);

    renderPage();
    await screen.findByRole("table");
    await user.type(screen.getByLabelText("Buscar comisiones"), "bulk785");
    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith(
        "/api/courses?page=1&pageSize=20&search=bulk785",
      );
    });
    expect(await screen.findByText(/共 25 条/)).toBeInTheDocument();

    // Paging keeps the search condition.
    await user.click(screen.getByRole("button", { name: "Página siguiente" }));
    await waitFor(() => {
      expect(apiGet).toHaveBeenCalledWith(
        "/api/courses?page=2&pageSize=20&search=bulk785",
      );
    });

    // Clearing restores the unfiltered full set on page 1.
    await user.click(screen.getByRole("button", { name: "Borrar búsqueda de comisiones" }));
    await waitFor(() => {
      expect(apiGet).toHaveBeenLastCalledWith(
        "/api/courses?page=1&pageSize=20",
      );
    });
    expect(await screen.findByText(/共 40 条/)).toBeInTheDocument();
  });

  it("B07: deleting the only course on page 2 steps back to page 1", async () => {
    const user = userEvent.setup();
    let deleted = false;
    const page1 = Array.from({ length: 20 }, (_, i) =>
      courseRow(`co${i + 1}`, `Comisión${i + 1}`, `C${i + 1}`),
    );
    apiGet.mockImplementation(async (url: string) => {
      if (!url.startsWith("/api/courses")) {
        throw new Error(`unexpected GET ${url}`);
      }
      const params = new URLSearchParams(url.split("?")[1] ?? "");
      const page = Number(params.get("page") ?? "1");
      const total = deleted ? 20 : 21;
      return {
        items:
          page === 1
            ? page1
            : deleted
              ? []
              : [courseRow("co21", "待删除课程", "C21")],
        total,
        page,
        pageSize: 20,
        totalPages: Math.max(1, Math.ceil(total / 20)),
      };
    });
    apiDelete.mockImplementation(async () => {
      deleted = true;
    });

    renderPage();
    await screen.findByRole("table");
    await user.click(screen.getByRole("button", { name: "Página siguiente" }));
    expect(
      await within(await screen.findByRole("table")).findByText("待删除课程"),
    ).toBeInTheDocument();

    await user.click(
      within(await screen.findByRole("table")).getByRole("button", {
        name: "Eliminar comisión",
      }),
    );
    await user.click(await screen.findByRole("button", { name: "Confirmar" }));

    await waitFor(() => {
      expect(apiDelete).toHaveBeenCalledWith("/api/courses/co21");
    });
    await waitFor(() => {
      expect(apiGet).toHaveBeenLastCalledWith(
        "/api/courses?page=1&pageSize=20",
      );
    });
    expect(
      await within(await screen.findByRole("table")).findByText("Comisión1"),
    ).toBeInTheDocument();
  });
});
