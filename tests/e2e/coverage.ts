import { test as base, type Page, type Request } from "@playwright/test";
import { browserCoverage } from "../../scripts/browser-coverage.mjs";

export { expect } from "@playwright/test";

const enabled = process.env.COVERAGE_BROWSER === "1";
const collectors = new WeakMap<Page, () => Promise<void>>();

/** Collect immediately before a reload or a second document navigation. V8 can discard old document hits. */
export async function collectCoverage(page: Page) {
  if (!enabled || page.url() === "about:blank") return;
  const collect = collectors.get(page);
  if (!collect) throw new Error("Coverage checkpoint requires the coverage page fixture");
  await collect();
}

export const test = base.extend({
  page: async ({ page, context, browserName }, use, testInfo) => {
    if (!enabled) return use(page);
    if (browserName !== "chromium") throw new Error("Native browser coverage requires Chromium");
    const unexpected: Page[] = [];
    const onPage = (opened: Page) => unexpected.push(opened);
    context.on("page", onPage);
    let needsCheckpoint = false;
    const missedNavigations: string[] = [];
    const onRequest = (request: Request) => {
      if (!request.isNavigationRequest() || request.frame() !== page.mainFrame() || request.redirectedFrom()) return;
      if (needsCheckpoint) missedNavigations.push(request.url());
      needsCheckpoint = true;
    };
    page.on("request", onRequest);
    const report = browserCoverage(testInfo.project.name);
    async function collect(restart = true) {
      if (page.isClosed()) throw new Error("Page closed before browser coverage collection");
      const entries = await page.coverage.stopJSCoverage();
      const mapped = [];
      for (const entry of entries) {
        if (!entry.url.startsWith("http")) continue;
        const path = new URL(entry.url).pathname;
        if (!(path.includes("/src/") && path.endsWith(".ts")) && !(path.includes("/assets/") && path.endsWith(".js")))
          continue;
        // Vite's generated preload helper has no original application source.
        if (/\/preload-helper-[^/]+\.js$/.test(path)) continue;
        const inline = entry.source?.match(/sourceMappingURL=data:application\/json[^,]*;base64,([^\s]+)/);
        // Vite also emits import/re-export-only facades; their implementation is in the mapped target chunk.
        const facade = /^import \{[\w$ ,]+\} from "\.\/[^"\n]+\.js";\s*export \{[\w$ ,]+\};\s*$/.test(
          entry.source ?? "",
        );
        if (!inline && facade) continue;
        if (!inline) throw new Error(`Missing inline source map: ${entry.url}`);
        const sourceMap = JSON.parse(Buffer.from(inline[1], "base64").toString("utf8"));
        if (!Array.isArray(sourceMap.sources)) throw new Error(`Invalid source map: ${entry.url}`);
        if (path.includes("/src/") || sourceMap.sources.some((source: string) => /(?:^|\/)src\//.test(source))) {
          mapped.push({ ...entry, sourceMap });
        }
      }
      if (mapped.length) await report.add(mapped);
      needsCheckpoint = false;
      if (restart) await page.coverage.startJSCoverage({ resetOnNavigation: false });
    }
    await page.coverage.startJSCoverage({ resetOnNavigation: false });
    collectors.set(page, () => collect());
    await use(page);
    collectors.delete(page);
    context.off("page", onPage);
    page.off("request", onRequest);
    await collect(false);
    if (missedNavigations.length)
      throw new Error(`Coverage checkpoint missing before navigation: ${missedNavigations.join(", ")}`);
    if (unexpected.length)
      throw new Error("Additional browser pages need an explicit coverage fixture before navigation");
  },
});
