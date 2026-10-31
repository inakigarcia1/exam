import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Route, Routes, useLocation } from "react-router";
import { AuthProvider } from "@/contexts/AuthContext";
import { BrandProvider } from "@/components/layout/BrandProvider";
import { QuestionPage, QUESTION_VIEW_PREFS_KEY } from "./QuestionPage";
import { permissionsForRole } from "@exam/authz";

interface Question {
  id: string;
  type: string;
  content: string;
  difficulty: number;
  tags: string[];
  createdAt: string;
  options?: Array<{ id: string; content: string }>;
  standardAnswer?: unknown;
}

const { apiGet, apiDelete } = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiDelete: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {},
  api: {
    get: (...args: unknown[]) => apiGet(...args),
    delete: (...args: unknown[]) => apiDelete(...args),
  },
  setNavigate: () => {},
}));

const LONG_CONTENT =
  "Un enunciado muy largo que antes se cortaba en la tabla y ahora tiene que verse entero, con todas sus palabras, hasta el final del texto.";

function question(overrides: Partial<Question> & { id: string }): Question {
  return {
    type: "single_choice",
    content: `Pregunta ${overrides.id}`,
    difficulty: 1,
    tags: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

const BANK: Question[] = [
  question({
    id: "q1",
    content: LONG_CONTENT,
    tags: ["Álgebra", "Geometría"],
    createdAt: "2026-01-02T00:00:00.000Z",
    options: [
      { id: "a", content: "Opción buena" },
      { id: "b", content: "Opción mala" },
    ],
    standardAnswer: "a",
  }),
  question({
    id: "q2",
    type: "text_response",
    content: "Explicá el teorema",
    tags: ["Geometría"],
    difficulty: 3,
  }),
  question({ id: "q3", type: "true_false", content: "Sin tags" }),
];

/** Serves `items` from the list endpoint in pages of the requested size. */
function serveBank(items: Question[]) {
  apiGet.mockImplementation((path: string) => {
    if (path === "/api/questions/tags") {
      return Promise.resolve({ tags: ["Álgebra", "Geometría"] });
    }
    const params = new URL(path, "http://test").searchParams;
    const page = Number(params.get("page"));
    const pageSize = Number(params.get("pageSize"));
    const tags = params.get("tags")?.split(",") ?? [];
    const matching = items.filter((item) =>
      tags.every((tag) => item.tags.includes(tag)),
    );
    return Promise.resolve({
      items: matching.slice((page - 1) * pageSize, page * pageSize),
      total: matching.length,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(matching.length / pageSize)),
    });
  });
}

const listCalls = () =>
  apiGet.mock.calls
    .map((call) => call[0] as string)
    .filter((path) => path.startsWith("/api/questions?"));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{location.search}</div>;
}

function renderPage(entry = "/admin/questions") {
  return render(
    <MemoryRouter initialEntries={[entry]}>
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
            <Route
              path="/admin/questions"
              element={
                <>
                  <QuestionPage />
                  <LocationProbe />
                </>
              }
            />
            <Route
              path="/admin/questions/:id/edit"
              element={<div>Editor de pregunta</div>}
            />
          </Routes>
        </BrandProvider>
      </AuthProvider>
    </MemoryRouter>,
  );
}

function group(key: string): HTMLElement {
  return screen.getByTestId(`question-group-${key}`);
}

beforeEach(() => {
  apiGet.mockReset();
  apiDelete.mockReset().mockResolvedValue(undefined);
  localStorage.clear();
  serveBank(BANK);
});

describe("QuestionPage", () => {
  it("groups cards by tag, repeating multi-tag questions and listing untagged last", async () => {
    renderPage();

    await screen.findByTestId("question-group-Álgebra");
    const groups = screen
      .getAllByTestId(/^question-group-/)
      .map((element) => element.getAttribute("data-testid"));
    expect(groups).toEqual([
      "question-group-Álgebra",
      "question-group-Geometría",
      "question-group-\u0000untagged",
    ]);
    expect(within(group("Álgebra")).getByText(LONG_CONTENT)).toBeVisible();
    expect(within(group("Geometría")).getByText(LONG_CONTENT)).toBeVisible();
    expect(
      within(group("Geometría")).getByText("Explicá el teorema"),
    ).toBeVisible();
    expect(
      within(group("\u0000untagged")).getByText("Sin etiqueta"),
    ).toBeVisible();
    expect(screen.getByText("Preguntas: 3")).toBeInTheDocument();
  });

  it("shows the full content and the full type label", async () => {
    renderPage();

    const card = (await screen.findAllByTestId("question-card-q2"))[0]!;
    expect(within(card).getByText("Explicá el teorema")).toBeVisible();
    expect(within(card).getByText("Respuesta de texto")).toBeVisible();
    expect(within(card).getByText("Dificultad 3")).toBeVisible();
  });

  it("reads every page of the filtered bank", async () => {
    const big = Array.from({ length: 150 }, (_, index) =>
      question({ id: `b${index}`, tags: ["Álgebra"] }),
    );
    serveBank(big);
    renderPage();

    await screen.findByText("Preguntas: 150");
    expect(listCalls()).toEqual([
      "/api/questions?page=1&pageSize=100",
      "/api/questions?page=2&pageSize=100",
    ]);
  });

  it("only shows the filtered tags as groups and sends the filter to the API", async () => {
    renderPage("/admin/questions?tags=Geometría");

    await screen.findByTestId("question-group-Geometría");
    expect(screen.getAllByTestId(/^question-group-/)).toHaveLength(1);
    expect(listCalls()[0]).toContain(`tags=${encodeURIComponent("Geometría")}`);
  });

  it("drops the retired page parameter from the URL", async () => {
    renderPage("/admin/questions?page=3&type=true_false");

    await waitFor(() =>
      expect(screen.getByTestId("location")).toHaveTextContent(
        "?type=true_false",
      ),
    );
    expect(listCalls().every((path) => path.includes("page=1&"))).toBe(true);
  });

  it("regroups, shows answers and remembers the choice", async () => {
    const user = userEvent.setup();
    const { unmount } = renderPage();
    await screen.findByTestId("question-group-Álgebra");

    await user.click(screen.getByRole("combobox", { name: "Agrupar por" }));
    await user.click(
      await screen.findByRole("option", { name: "Agrupar por tipo" }),
    );
    expect(
      within(group("single_choice")).getByText("Opción única", {
        selector: "h2",
      }),
    ).toBeVisible();
    expect(screen.queryByTestId("question-group-Álgebra")).toBeNull();

    expect(screen.queryByText("Opción buena")).toBeNull();
    await user.click(
      screen.getByRole("switch", { name: "Mostrar opciones y respuestas" }),
    );
    const correct = screen.getByText("Opción buena").closest("li")!;
    expect(
      within(correct).getByRole("img", { name: "Opción correcta" }),
    ).toBeInTheDocument();
    expect(
      within(screen.getByText("Opción mala").closest("li")!).queryByRole("img"),
    ).toBeNull();

    expect(
      JSON.parse(localStorage.getItem(QUESTION_VIEW_PREFS_KEY) ?? "{}"),
    ).toMatchObject({ groupBy: "type", showAnswers: true });
    unmount();

    renderPage();
    await screen.findByTestId("question-group-single_choice");
    expect(screen.getByText("Opción buena")).toBeVisible();
  });

  it("collapses a group", async () => {
    const user = userEvent.setup();
    renderPage();
    await screen.findByTestId("question-group-Álgebra");

    const header = within(group("Álgebra")).getByRole("button", {
      name: /Álgebra/,
    });
    await user.click(header);
    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(within(group("Álgebra")).queryByText(LONG_CONTENT)).toBeNull();
  });

  it("opens the editor when the statement is clicked", async () => {
    const user = userEvent.setup();
    renderPage();

    const card = (await screen.findAllByTestId("question-card-q2"))[0]!;
    await user.click(within(card).getByText("Explicá el teorema"));
    expect(await screen.findByText("Editor de pregunta")).toBeInTheDocument();
  });

  it("deletes after confirmation and reloads the bank", async () => {
    const user = userEvent.setup();
    renderPage();

    const card = (await screen.findAllByTestId("question-card-q3"))[0]!;
    await user.click(
      within(card).getByRole("button", { name: "Eliminar pregunta" }),
    );
    expect(apiDelete).not.toHaveBeenCalled();
    const dialog = await screen.findByRole("alertdialog");
    await user.click(within(dialog).getByRole("button", { name: "Confirmar" }));

    await waitFor(() =>
      expect(apiDelete).toHaveBeenCalledWith("/api/questions/q3"),
    );
    await waitFor(() => expect(listCalls()).toHaveLength(2));
  });

  it("explains an empty filter result", async () => {
    serveBank([]);
    renderPage("/admin/questions?search=nada");

    expect(
      await screen.findByText("Ninguna pregunta coincide"),
    ).toBeInTheDocument();
  });
});
