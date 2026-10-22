import {
  STANDARD_PRODUCT_CONFIGURATION,
  resolveDeploymentProductConfiguration,
} from "@exam/domain";

/**
 * Canonical server composition root (#678 Phase 1).
 *
 * One validated Standard instance for the entire process; no deployment
 * overrides or runtime disabling until Phase 2's authoritative write guards.
 * Product availability is not actor authorization, and does not interpret
 * ExamPolicyProfile or persisted Exam/Attempt/Result facts.
 */
const resolvedProduct = resolveDeploymentProductConfiguration(
  STANDARD_PRODUCT_CONFIGURATION,
);

export function getResolvedProductConfiguration() {
  return resolvedProduct;
}

/**
 * Candidate/Admin-safe read projection, intentionally free of permissions,
 * secrets, dynamic host settings and per-Exam policy. A read adapter may
 * expose it later without creating another capability definition.
 */
export function getProductCapabilityProjection() {
  return {
    revision: resolvedProduct.revision,
    presentation: resolvedProduct.presentation,
    enabled: [...resolvedProduct.enabled],
  };
}
