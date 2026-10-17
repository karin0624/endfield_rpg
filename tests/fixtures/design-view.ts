import "../../src/web/style.css";

export type DesignCase = (root: HTMLElement, props: Record<string, unknown>) => void | Promise<void>;
type DesignModule = { cases: Record<string, DesignCase> };

const modules = import.meta.glob<DesignModule>(["./design-*.ts", "!./design-view.ts", "!./design-isolation.ts"]);
const query = new URLSearchParams(location.search);
const status: { state: "pending" | "ready" | "error"; error?: string } = { state: "pending" };
Object.assign(window, { designStatus: status });

try {
  const name = query.get("module");
  const key = query.get("case");
  const load = modules[`./design-${name}.ts`];
  if (!load || !key) throw new Error(`Unknown design fixture module/case: ${name}/${key}`);
  const fixture = (await load()).cases[key];
  if (!fixture) throw new Error(`Unknown design fixture case: ${name}/${key}`);
  const props: unknown = JSON.parse(query.get("props") ?? "{}");
  if (!props || typeof props !== "object" || Array.isArray(props)) throw new Error("Fixture props must be an object");
  const root = document.querySelector<HTMLElement>("#app");
  if (!root) throw new Error("Missing design fixture root");
  await fixture(root, props as Record<string, unknown>);
  await document.fonts.ready;
  await Promise.all([...document.images].map((image) => image.decode()));
  await Promise.all(
    [...document.querySelectorAll<SVGImageElement>("svg image")].map(async (element) => {
      const image = new Image();
      image.src = element.href.baseVal;
      await image.decode();
    }),
  );
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  status.state = "ready";
} catch (error) {
  status.state = "error";
  status.error = error instanceof Error ? error.message : String(error);
}
