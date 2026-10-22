import { describe, expect, it } from "vitest";
import {
  SUPPORTED_PRODUCT_CAPABILITIES,
  STANDARD_PRODUCT_CONFIGURATION,
  resolveDeploymentProductConfiguration,
} from "./productCapabilities.js";

describe("ADR-022 Phase 1 — Standard product resolver", () => {
  it("enumerates the current Standard catalog without future promises", () => {
    expect(SUPPORTED_PRODUCT_CAPABILITIES).toEqual([
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
    ]);
    expect(SUPPORTED_PRODUCT_CAPABILITIES).not.toContain("admission.federated");
    expect(SUPPORTED_PRODUCT_CAPABILITIES).not.toContain("proctor.camera");
    expect(SUPPORTED_PRODUCT_CAPABILITIES).not.toContain("delivery.offline");
  });

  it("preserves Standard and Plain subjective/manual grading", () => {
    const resolved = resolveDeploymentProductConfiguration(
      STANDARD_PRODUCT_CONFIGURATION,
    );
    expect(resolved.revision).toBe(1);
    expect(resolved.presentation).toBe("standard");
    expect(resolved.enabled).toEqual(SUPPORTED_PRODUCT_CAPABILITIES);
    for (const capability of SUPPORTED_PRODUCT_CAPABILITIES) {
      expect(resolved.allows(capability)).toBe(true);
    }
    // Unknown/future names never enter the typed allows() seam. Rejection is
    // proven through the resolver's `unknown` boundary below.
    expect(resolved.allows("question.text_response")).toBe(true);
    expect(resolved.allows("grading.manual")).toBe(true);
  });

  it("normalizes ordering without changing the resolved capability set", () => {
    const reordered = resolveDeploymentProductConfiguration({
      ...STANDARD_PRODUCT_CONFIGURATION,
      enabled: [...SUPPORTED_PRODUCT_CAPABILITIES].reverse(),
    });
    expect(reordered.enabled).toEqual(SUPPORTED_PRODUCT_CAPABILITIES);
  });

  it("rejects unknown and future capabilities", () => {
    const futureNames = [
      "admission.federated",
      "proctor.camera",
      "delivery.offline",
    ];
    for (const invalid of futureNames) {
      expect(() =>
        resolveDeploymentProductConfiguration({
          ...STANDARD_PRODUCT_CONFIGURATION,
          enabled: [...SUPPORTED_PRODUCT_CAPABILITIES, invalid],
        }),
      ).toThrow("Unknown or future");
    }
  });

  it("rejects partial configuration before guarded writes exist", () => {
    expect(() =>
      resolveDeploymentProductConfiguration({
        ...STANDARD_PRODUCT_CONFIGURATION,
        enabled: SUPPORTED_PRODUCT_CAPABILITIES.filter(
          (capability) => capability !== "grading.manual",
        ),
      }),
    ).toThrow("authoritative write guards");
    expect(() =>
      resolveDeploymentProductConfiguration({
        ...STANDARD_PRODUCT_CONFIGURATION,
        enabled: [],
      }),
    ).toThrow("authoritative write guards");
  });

  it("refuses duplicate capabilities and invalid input structure", () => {
    expect(() =>
      resolveDeploymentProductConfiguration({
        ...STANDARD_PRODUCT_CONFIGURATION,
        enabled: [...SUPPORTED_PRODUCT_CAPABILITIES, "question.single_choice"],
      }),
    ).toThrow("Duplicate");
    expect(() => resolveDeploymentProductConfiguration(null)).toThrow();
    expect(() => resolveDeploymentProductConfiguration([])).toThrow();
    expect(() =>
      resolveDeploymentProductConfiguration({
        ...STANDARD_PRODUCT_CONFIGURATION,
        enabled: "question.single_choice",
      }),
    ).toThrow();
  });

  it("rejects unshipped presets, revisions and unknown fields", () => {
    for (const rejected of [
      { ...STANDARD_PRODUCT_CONFIGURATION, preset: "minimal" },
      { ...STANDARD_PRODUCT_CONFIGURATION, preset: "simple" },
      { ...STANDARD_PRODUCT_CONFIGURATION, revision: 2 },
      { ...STANDARD_PRODUCT_CONFIGURATION, presentation: "minimal" },
      { ...STANDARD_PRODUCT_CONFIGURATION, enableAll: true },
    ]) {
      expect(() => resolveDeploymentProductConfiguration(rejected)).toThrow();
    }
  });

  it("returns immutable resolved configuration", () => {
    const resolved = resolveDeploymentProductConfiguration(
      STANDARD_PRODUCT_CONFIGURATION,
    );
    expect(Object.isFrozen(resolved)).toBe(true);
    expect(Object.isFrozen(resolved.enabled)).toBe(true);
    expect(Object.keys(resolved).sort()).toEqual([
      "allows",
      "enabled",
      "presentation",
      "revision",
    ]);
  });
});
