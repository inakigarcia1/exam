import { describe, expect, it } from "vitest";
import { SUPPORTED_PRODUCT_CAPABILITIES } from "@exam/domain";
import {
  getProductCapabilityProjection,
  getResolvedProductConfiguration,
} from "./compositionRoot.js";

describe("single server product composition root (#678 Phase 1)", () => {
  it("uses the same Standard instance on every read", () => {
    expect(getResolvedProductConfiguration()).toBe(
      getResolvedProductConfiguration(),
    );
    expect(getResolvedProductConfiguration().enabled).toEqual(
      SUPPORTED_PRODUCT_CAPABILITIES,
    );
  });

  it("projects only product availability (no RBAC, secrets or writable flags)", () => {
    const projection = getProductCapabilityProjection();
    expect(projection).toEqual({
      revision: 1,
      presentation: "standard",
      enabled: SUPPORTED_PRODUCT_CAPABILITIES,
    });
    expect(Object.keys(projection).sort()).toEqual([
      "enabled",
      "presentation",
      "revision",
    ]);
    projection.enabled.pop();
    expect(getProductCapabilityProjection().enabled).toEqual(
      SUPPORTED_PRODUCT_CAPABILITIES,
    );
  });
});
