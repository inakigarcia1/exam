import "i18next";
import es from "./locales/es.js";

/**
 * Type augmentation: makes `t("status.exam.draft")` compile-time checked
 * against the es catalog. A typo'd key or a missing namespace is a
 * type error, not a runtime missing-translation.
 *
 * See react-i18next TypeScript docs (CustomTypeOptions).
 */
declare module "i18next" {
  interface CustomTypeOptions {
    defaultNS: "translation";
    resources: {
      translation: typeof es;
    };
  }
}
