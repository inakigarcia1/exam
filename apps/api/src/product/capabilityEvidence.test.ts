import { describe, expect, it } from "vitest";
import {
  QuestionType,
  STANDARD_PRODUCT_CONFIGURATION,
  SUPPORTED_PRODUCT_CAPABILITIES,
  isManualGradedQuestion,
  requiresManualGrading,
  resolveDeploymentProductConfiguration,
  type QuestionSnapshot,
} from "@exam/domain";
import { CreateQuestionRequestSchema, QuestionSchema } from "@exam/contracts";
import { Permission } from "@exam/authz";
import {
  getProductCapabilityProjection,
  getResolvedProductConfiguration,
} from "./compositionRoot.js";

const RICH_DOC = {
  docVersion: 1,
  type: "doc",
  content: [
    {
      type: "paragraph",
      content: [{ type: "text", text: "Prove the identity." }],
    },
  ],
};

const CREATE_BASE = {
  courseId: "11111111-1111-4111-8111-111111111111",
  score: 10,
};

/**
 * Oracle input is deliberately a `readonly string[]`, not the frozen catalog
 * type: a drift counterexample must be able to add a name the compiler would
 * reject in the real catalog.
 */
function questionTypesInCatalog(capabilities: readonly string[]): string[] {
  return capabilities
    .filter((capability) => capability.startsWith("question."))
    .map((capability) => capability.slice("question.".length))
    .sort();
}

function snapshot(type: QuestionType): QuestionSnapshot {
  return {
    originalQuestionId: "question-1",
    type,
    content: "prompt",
    contentDocument: null,
    answerMode: null,
    attachments: [],
    options: [],
    standardAnswer: null,
    score: 1,
    gradingRule: {
      multiSelectScoring: "all_correct_full",
      fillBlankMatchMode: "exact",
    },
    order: 0,
    rubric: null,
  };
}

describe("product catalog evidence oracles (#678 Phase 1)", () => {
  describe("question types", () => {
    it("matches the domain QuestionType authority", () => {
      expect(questionTypesInCatalog(SUPPORTED_PRODUCT_CAPABILITIES)).toEqual(
        Object.values(QuestionType).sort(),
      );
    });

    it("matches the wire QuestionType enum used by question contracts", () => {
      expect(questionTypesInCatalog(SUPPORTED_PRODUCT_CAPABILITIES)).toEqual(
        [...QuestionSchema.shape.type.options].sort(),
      );
    });

    it("fails on a synthetic catalog drift", () => {
      expect(
        questionTypesInCatalog([
          ...SUPPORTED_PRODUCT_CAPABILITIES,
          "question.essay",
        ]),
      ).not.toEqual(Object.values(QuestionType).sort());
    });
  });

  describe("Rich slots", () => {
    it("keeps prompt, option and answer Rich as separately supported slots", () => {
      expect(SUPPORTED_PRODUCT_CAPABILITIES).toEqual(
        expect.arrayContaining([
          "content.prompt.rich",
          "content.option.rich",
          "answer.text.rich",
        ]),
      );
      // Rich is a content representation, not a QuestionType.
      expect(Object.values(QuestionType)).not.toContain("rich");
    });

    it("accepts rich prompt and rich options through the create contract", () => {
      const parsed = CreateQuestionRequestSchema.safeParse({
        ...CREATE_BASE,
        type: "single_choice",
        contentDocument: RICH_DOC,
        options: [
          { id: "A", contentDocument: RICH_DOC, isCorrect: true },
          { id: "B", contentDocument: RICH_DOC, isCorrect: false },
        ],
        standardAnswer: "A",
      });

      expect(parsed.success).toBe(true);
    });

    it("accepts rich text_response answers only through answerMode", () => {
      const richAnswer = CreateQuestionRequestSchema.safeParse({
        ...CREATE_BASE,
        type: "text_response",
        contentDocument: RICH_DOC,
        answerMode: "rich",
        standardAnswer: null,
        rubric: "完整证明",
      });
      expect(richAnswer.success).toBe(true);

      const richAnswerOnObjective = CreateQuestionRequestSchema.safeParse({
        ...CREATE_BASE,
        type: "single_choice",
        contentDocument: RICH_DOC,
        answerMode: "rich",
        options: [
          { id: "A", content: "3" },
          { id: "B", content: "4" },
        ],
        standardAnswer: "B",
      });
      expect(richAnswerOnObjective.success).toBe(false);
    });

    it("keeps the documented fill_blank rich-content negative", () => {
      const parsed = CreateQuestionRequestSchema.safeParse({
        ...CREATE_BASE,
        type: "fill_blank",
        contentDocument: RICH_DOC,
        standardAnswer: "1",
      });

      expect(parsed.success).toBe(false);
    });
  });

  describe("manual grading", () => {
    it("binds question.text_response to the canonical manual-grading predicates", () => {
      expect(SUPPORTED_PRODUCT_CAPABILITIES).toContain(
        "question.text_response",
      );
      expect(SUPPORTED_PRODUCT_CAPABILITIES).toContain("grading.manual");

      for (const type of Object.values(QuestionType)) {
        const expectedManual = type === QuestionType.TextResponse;
        expect(isManualGradedQuestion({ type })).toBe(expectedManual);
        expect(requiresManualGrading([snapshot(type)])).toBe(expectedManual);
      }
    });
  });

  describe("authority separation", () => {
    it("does not reuse actor Permission values as product capability names", () => {
      const permissionValues = new Set<string>(Object.values(Permission));
      for (const capability of SUPPORTED_PRODUCT_CAPABILITIES) {
        expect(permissionValues.has(capability)).toBe(false);
      }
    });

    it("keeps deployment availability distinct from exam policy and current obligations", () => {
      const projection = getProductCapabilityProjection();
      expect(Object.keys(projection).sort()).toEqual([
        "enabled",
        "presentation",
        "revision",
      ]);

      const resolved = getResolvedProductConfiguration();
      expect(resolved.allows("admission.queue")).toBe(true);
      expect(resolved.allows("grading.manual")).toBe(true);

      // The current obligation is derived from the frozen question type, not
      // from the deployment capability.
      expect(isManualGradedQuestion({ type: QuestionType.SingleChoice })).toBe(
        false,
      );
      expect(isManualGradedQuestion({ type: QuestionType.TextResponse })).toBe(
        true,
      );
      expect(projection).not.toHaveProperty("requireQueue");
      expect(projection).not.toHaveProperty("permissions");
    });

    it("keeps the projection and catalog independent of runtime preset branching", () => {
      // Reordering the input never changes the resolved set, and resolution
      // returns the same catalog-ordered list as the Standard default.
      const reordered = resolveDeploymentProductConfiguration({
        ...STANDARD_PRODUCT_CONFIGURATION,
        enabled: [...SUPPORTED_PRODUCT_CAPABILITIES].reverse(),
      });
      expect(reordered.enabled).toEqual(SUPPORTED_PRODUCT_CAPABILITIES);
      expect(reordered.allows("operator.monitoring")).toBe(true);
    });
  });
});
