/**
 * #678 / ADR-022 Phase 1: the CLOSED catalog of capabilities supported by
 * today's Standard deployment. This is product availability, not actor RBAC.
 *
 * A capability in this list is not a new QuestionType, an ExamPolicyProfile,
 * or permission to act on a resource. Unknown/future capability names do not
 * become supported merely because they appear in a proposal.
 */
export const SUPPORTED_PRODUCT_CAPABILITIES = Object.freeze([
  "question.single_choice",
  "question.multiple_choice",
  "question.true_false",
  "question.fill_blank",
  "question.text_response",
  "content.prompt.rich",
  "content.option.rich",
  "answer.text.rich",
  "grading.manual",
  "admission.account",
  "admission.queue",
  "result.publication",
  "operator.monitoring",
] as const);

export type ProductCapabilityId =
  (typeof SUPPORTED_PRODUCT_CAPABILITIES)[number];

/**
 * Phase 1 deliberately admits only the shipped Standard configuration.
 * Minimal is an ACCEPTED design preset, not a selectable runtime until
 * Phase 2's server write guards and Phase 3's UI/obligation proof exist.
 */
export interface DeploymentProductConfiguration {
  readonly preset: string;
  readonly revision: number;
  readonly presentation: string;
  readonly enabled: readonly string[];
}

export interface ResolvedProductConfiguration {
  readonly revision: 1;
  readonly presentation: "standard";
  readonly enabled: readonly ProductCapabilityId[];
  /** Product availability only. Callers STILL need actor scope and policy. */
  allows(capability: ProductCapabilityId): boolean;
}

export const STANDARD_PRODUCT_CONFIGURATION = Object.freeze({
  preset: "standard",
  revision: 1,
  presentation: "standard",
  enabled: SUPPORTED_PRODUCT_CAPABILITIES,
} as const satisfies DeploymentProductConfiguration);

const supported = new Set<string>(SUPPORTED_PRODUCT_CAPABILITIES);
const configFields = new Set(["preset", "revision", "presentation", "enabled"]);

/**
 * Pure, deterministic, fail-closed resolver. It intentionally DOES NOT accept
 * a subset of Standard yet: without Phase 2's authoritative CRUD/import/
 * publish guards, treating a disabled capability as effective would be a lie.
 * No DB state, environment variables, permissions or UI flags enter here.
 */
export function resolveDeploymentProductConfiguration(
  input: unknown,
): ResolvedProductConfiguration {
  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    throw new Error("Invalid deployment product configuration");
  }
  const raw = input as Record<string, unknown>;
  const fields = Object.keys(raw);
  if (
    fields.length !== configFields.size ||
    fields.some((field) => !configFields.has(field))
  ) {
    throw new Error("Unknown or missing product configuration field");
  }
  if (
    raw.preset !== "standard" ||
    raw.revision !== 1 ||
    raw.presentation !== "standard"
  ) {
    throw new Error("Product preset, revision or presentation not supported");
  }
  if (!Array.isArray(raw.enabled)) {
    throw new Error("Product capability list must be an array");
  }

  const seen = new Set<string>();
  for (const value of raw.enabled) {
    if (typeof value !== "string" || !supported.has(value)) {
      throw new Error("Unknown or future product capability");
    }
    if (seen.has(value)) {
      throw new Error("Duplicate product capability");
    }
    seen.add(value);
  }
  if (seen.size !== supported.size) {
    throw new Error(
      "Partial product configurations require authoritative write guards",
    );
  }

  // Stable catalog order, independent of caller ordering; no exposed mutable
  // set, and no runtime branch on the preset name after resolution.
  const enabled = Object.freeze([...SUPPORTED_PRODUCT_CAPABILITIES]);
  const allowed = new Set<string>(enabled);
  return Object.freeze({
    revision: 1 as const,
    presentation: "standard" as const,
    enabled,
    allows(capability: ProductCapabilityId): boolean {
      return allowed.has(capability);
    },
  });
}
