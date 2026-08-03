import { describe, it, expect } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";

/**
 * Validates that every page imported via dynamic import in src/App.tsx
 * actually exists on disk and has a default export. Catches typos /
 * deletions that would only surface as a runtime chunk-load error.
 */
describe("Dynamic imports in App.tsx", () => {
  const appPath = resolve(__dirname, "../../App.tsx");
  const content = readFileSync(appPath, "utf-8");

  // Match `import("./pages/Foo")` or `import("@/components/Bar")`
  const importRegex = /import\(["'](\.\/pages\/[^"']+|@\/[^"']+)["']\)/g;
  const matches = Array.from(content.matchAll(importRegex)).map((m) => m[1]);

  it("finds at least all expected pages", () => {
    expect(matches.length).toBeGreaterThan(10);
    expect(matches).toContain("./pages/Login");
    expect(matches).toContain("./pages/MyAgendamentos");
  });

  it.each(Array.from(new Set(matches)))(
    "page exists on disk and has default export: %s",
    (importPath) => {
      const relative = importPath.startsWith("@/")
        ? importPath.replace("@/", "")
        : importPath.replace(/^\.\//, "");
      const base = resolve(__dirname, "../../", relative);
      const candidates = [
        `${base}.tsx`,
        `${base}.ts`,
        `${base}/index.tsx`,
        `${base}/index.ts`,
      ];
      const found = candidates.find((p) => existsSync(p));
      expect(found, `Missing module for ${importPath}`).toBeTruthy();
      const src = readFileSync(found!, "utf-8");
      expect(
        /export\s+default\s/.test(src),
        `${importPath} has no default export`,
      ).toBe(true);
    },
  );
});
