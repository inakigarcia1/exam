import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { QuestionRenderer } from "./QuestionRenderer";

/**
 * P3-MOD-P0-2 — text_response rendering.
 *
 * QuestionRenderer must dispatch a `text_response` question to a textarea
 * (TextResponseInput). Newlines must be preserved on change.
 */

const baseQuestion = {
  originalQuestionId: "q-text",
  content: "请阐述你的观点",
  contentDocument: null,
  answerMode: "plain" as const,
  image: null,
  scale: null,
  options: [],
  score: 20,
  order: 0,
};

describe("QuestionRenderer — text_response", () => {
  it("preserves newlines in the rendered value and reports changes verbatim", async () => {
    const onChange = vi.fn();
    render(
      <QuestionRenderer
        question={{ ...baseQuestion, type: "text_response" }}
        answer={"line one\nline two\nline three"}
        onChange={onChange}
      />,
    );

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    // Restore: newlines present in the value prop are preserved verbatim —
    // no normalization, no trimming, no collapse.
    expect(textarea.value).toBe("line one\nline two\nline three");

    // Save: typing a normal character appends to the existing multiline
    // value and reports the full string through onChange.
    const user = userEvent.setup();
    await user.type(textarea, "x");
    expect(onChange).toHaveBeenLastCalledWith(
      "line one\nline two\nline threex",
    );
  });

  it("renders the textarea read-only when disabled (post-submit lock)", () => {
    render(
      <QuestionRenderer
        question={{ ...baseQuestion, type: "text_response" }}
        answer={"submitted answer"}
        onChange={() => {}}
        disabled
      />,
    );

    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea).toHaveAttribute("readonly");
    // The submitted value is rendered verbatim — no transformation.
    expect(textarea.value).toBe("submitted answer");
  });

  it("does not use dangerouslySetInnerHTML (XSS-safe pure text content)", () => {
    const { container } = render(
      <QuestionRenderer
        question={{ ...baseQuestion, type: "text_response" }}
        answer={"<script>alert(1)</script>"}
        onChange={() => {}}
      />,
    );

    // No script element is injected.
    expect(container.querySelector("script")).toBeNull();
    // The literal string is rendered as text, not HTML.
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument();
  });
});

describe("QuestionRenderer — rich text_response (issue 301)", () => {
  it("mounts the lazy rich editor when answerMode is rich and emits nothing until a real edit", async () => {
    const onChange = vi.fn();
    render(
      <QuestionRenderer
        question={{
          ...baseQuestion,
          type: "text_response",
          answerMode: "rich",
        }}
        answer={undefined}
        onChange={onChange}
      />,
    );
    // Lazy chunk resolves and Tiptap mounts its editable surface.
    const editor = await screen.findByRole("textbox", {}, { timeout: 5000 });
    expect(editor).toBeInTheDocument();

    // #697: mounting (and its editability sync) is not a document change —
    // no onChange may fire, so no phantom save can be scheduled. Every real
    // emission's canonical shape is owned by
    // richContentEditor.editableSync.test.tsx (real-edit driven).
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(onChange).not.toHaveBeenCalled();
  }, 15000);

  it("keeps the plain textarea when answerMode is plain", () => {
    render(
      <QuestionRenderer
        question={{
          ...baseQuestion,
          type: "text_response",
          answerMode: "plain",
        }}
        answer={undefined}
        onChange={() => {}}
      />,
    );
    const textarea = screen.getByRole("textbox") as HTMLTextAreaElement;
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea.getAttribute("contenteditable")).toBeNull();
  });
});

describe("QuestionRenderer — mount isolation (issue 301)", () => {
  it("never mounts an editor surface for objective questions, even with rich options", () => {
    render(
      <QuestionRenderer
        question={
          {
            ...baseQuestion,
            type: "single_choice",
            options: [
              { id: "a", content: "A", contentDocument: null },
              { id: "b", content: "B", contentDocument: null },
            ],
          } as never
        }
        answer={undefined}
        onChange={() => {}}
      />,
    );
    expect(screen.getAllByRole("radio")).toHaveLength(2);
    expect(document.querySelector(".ProseMirror")).toBeNull();
  });

  it("never mounts an editor for a rich PROMPT (READ path renders statically)", async () => {
    const { ContentDocumentRenderer } =
      await import("@/components/shared/content/ContentDocumentRenderer");
    expect(ContentDocumentRenderer).toBeDefined();
    render(
      <QuestionRenderer
        question={
          {
            ...baseQuestion,
            type: "text_response",
            contentDocument: {
              docVersion: 1,
              type: "doc",
              content: [
                {
                  type: "paragraph",
                  content: [{ type: "text", text: "rich prompt" }],
                },
              ],
            },
          } as never
        }
        answer={undefined}
        onChange={() => {}}
      />,
    );
    // The prompt itself is not rendered by QuestionRenderer (owned by the
    // page), so no editor may appear for prompt display either.
    expect(document.querySelector(".ProseMirror")).toBeNull();
  });
});

describe("QuestionRenderer � likert and ranking", () => {
  const rows = [
    { id: "A", content: "Statement A", contentDocument: null },
    { id: "B", content: "Statement B", contentDocument: null },
  ];

  it("likert reports the whole row ? column record on each pick", async () => {
    const onChange = vi.fn();
    render(
      <QuestionRenderer
        question={{
          ...baseQuestion,
          type: "likert",
          options: rows,
          scale: ["No", "Maybe", "Yes"],
        }}
        answer={{ A: 0 }}
        onChange={onChange}
      />,
    );

    const radios = screen.getAllByRole("radio");
    expect(radios).toHaveLength(6);
    expect(radios[0]).toBeChecked();
    await userEvent.setup().click(radios[5]!);
    expect(onChange).toHaveBeenLastCalledWith({ A: 0, B: 2 });
  });

  it("ranking shows the presented order until moved, then reports the full order", async () => {
    const onChange = vi.fn();
    render(
      <QuestionRenderer
        question={{ ...baseQuestion, type: "ranking", options: rows }}
        answer={null}
        onChange={onChange}
      />,
    );

    const items = screen.getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Statement A");
    const [firstUp, firstDown] = screen.getAllByRole("button");
    expect(firstUp).toBeDisabled();
    await userEvent.setup().click(firstDown!);
    expect(onChange).toHaveBeenLastCalledWith(["B", "A"]);
  });
});
