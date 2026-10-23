#!/usr/bin/env node
/**
 * Canonical Playwright runtime identity for CI.
 *
 * apps/e2e/package.json is the only version authority. The existing Build
 * job exports the resolved image to both browser consumers; no independent
 * Docker tag pins, image installs, or browser download/cache paths.
 *
 * Usage:
 *   node scripts/ci/playwright-runtime.mjs image
 *   node scripts/ci/playwright-runtime.mjs github-output
 *   node scripts/ci/playwright-runtime.mjs verify
 */
import { appendFileSync, existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";

const manifestUrl = new URL("../../apps/e2e/package.json", import.meta.url);
const manifest = JSON.parse(readFileSync(manifestUrl, "utf8"));
const version = manifest.devDependencies?.["@playwright/test"];

const exactVersion = /^[0-9]+[.][0-9]+[.][0-9]+$/;
if (typeof version !== "string" || !exactVersion.test(version)) {
  throw new Error("Exact @playwright/test version required");
}

const image = `mcr.microsoft.com/playwright:v${version}-noble`;
const command = process.argv[2];

switch (command) {
  case "image": {
    process.stdout.write(`${image}\n`);
    break;
  }
  case "github-output": {
    if (!process.env.GITHUB_OUTPUT) {
      throw new Error("GITHUB_OUTPUT is required to export the Playwright image");
    }
    appendFileSync(process.env.GITHUB_OUTPUT, `image=${image}\n`);
    process.stdout.write(`Playwright runtime: ${image}\n`);
    break;
  }
  case "verify": {
    const requireFromE2e = createRequire(manifestUrl);
    const installed = requireFromE2e("@playwright/test/package.json").version;
    if (installed !== version) {
      throw new Error(`Installed Playwright ${installed} != manifest ${version}`);
    }
    const { chromium } = requireFromE2e("@playwright/test");
    const browser = chromium.executablePath();
    if (!browser.startsWith("/ms-playwright/") || !existsSync(browser)) {
      throw new Error(`Missing image Chromium for ${image}: ${browser}`);
    }
    process.stdout.write(`Verified Playwright ${version} and ${browser}\n`);
    break;
  }
  default:
    throw new Error("Usage: playwright-runtime.mjs image|github-output|verify");
}
