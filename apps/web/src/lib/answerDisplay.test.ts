import { describe, expect, it } from "vitest";
import {
  formatAnswerForDisplay,
  formatStandardAnswerForDisplay,
} from "./answerDisplay";

describe("formatAnswerForDisplay", () => {
  it("joins fill-blank answers stored as an object in blank order", () => {
    expect(formatAnswerForDisplay({ b1: "París", b2: "Roma" })).toBe(
      "París, Roma",
    );
  });

  it("never renders [object Object] for nested fill-blank values", () => {
    expect(formatAnswerForDisplay({ b1: { v: "x" } })).not.toContain(
      "[object Object]",
    );
  });

  it("shows accepted alternatives separated by | as 'a o b'", () => {
    expect(formatAnswerForDisplay("gato|felino")).toBe("gato o felino");
  });

  it("joins arrays", () => {
    expect(formatAnswerForDisplay(["a", "c"])).toBe("a, c");
  });

  it("marks empty answers as unanswered", () => {
    expect(formatAnswerForDisplay(null)).toBe("Sin responder");
    expect(formatAnswerForDisplay("")).toBe("Sin responder");
  });

  it("formats true/false answers", () => {
    expect(formatAnswerForDisplay(true)).toBe("Correcto");
    expect(formatAnswerForDisplay(false)).toBe("Incorrecto");
  });
});

describe("formatStandardAnswerForDisplay", () => {
  it("labels a text response without reference as open", () => {
    expect(formatStandardAnswerForDisplay(null, "text_response")).toBe(
      "Abierta",
    );
  });

  it("uses a dash for other types without reference", () => {
    expect(formatStandardAnswerForDisplay(null, "single_choice")).toBe("—");
  });
});
