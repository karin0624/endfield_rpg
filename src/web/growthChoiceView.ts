import type { GrowthEvent, GrowthFocus } from "../presentation/growthModel";
import type { GrowthFrame } from "../presentation/growthProjection";

export function createGrowthChoiceView(root: HTMLElement, send: (event: GrowthEvent) => boolean) {
  let events = new AbortController();
  let paint = "";
  let appliedFocus: string | undefined;
  const candidates = new Map<string, HTMLButtonElement>();
  return {
    render(frame: GrowthFrame, focus: GrowthFocus) {
      const nextPaint = JSON.stringify(frame);
      if (paint !== nextPaint) {
        paint = nextPaint;
        appliedFocus = undefined;
        candidates.clear();
        events.abort();
        events = new AbortController();
        const panel = document.createElement("section");
        panel.className = "growth-choice";
        panel.setAttribute("aria-label", "レベルアップのスキル選択");
        const title = document.createElement("h1");
        title.textContent = frame.title;
        title.tabIndex = -1;
        title.addEventListener("focus", () => send({ type: "focused", target: { kind: "heading" } }), {
          signal: events.signal,
        });
        const summary = document.createElement("p");
        summary.textContent = frame.summary;
        panel.append(title, summary);
        if (frame.guaranteed) {
          const notice = document.createElement("p");
          notice.textContent = frame.guaranteed;
          panel.append(notice);
        }
        if (frame.error) {
          const error = document.createElement("p");
          error.textContent = frame.error;
          error.setAttribute("role", "alert");
          panel.append(error);
        }
        for (const candidate of frame.candidates) {
          const button = document.createElement("button");
          button.type = "button";
          const name = document.createElement("strong");
          name.textContent = candidate.name;
          button.append(name);
          for (const text of [candidate.detail, candidate.description]) {
            const span = document.createElement("span");
            span.className = "growth-choice-detail";
            span.textContent = text;
            button.append(span);
          }
          button.addEventListener("click", () => send({ type: "choose", skillId: candidate.skillId }), {
            signal: events.signal,
          });
          button.addEventListener(
            "focus",
            () => send({ type: "focused", target: { kind: "candidate", skillId: candidate.skillId } }),
            { signal: events.signal },
          );
          candidates.set(candidate.skillId, button);
          panel.append(button);
        }
        root.replaceChildren(panel);
        panel.addEventListener(
          "keydown",
          (event) => {
            if (send({ type: "key", key: event.key, shift: event.shiftKey })) {
              event.preventDefault();
              event.stopPropagation();
            }
          },
          { signal: events.signal },
        );
      }
      const key = JSON.stringify(focus);
      if (key !== appliedFocus) {
        appliedFocus = key;
        if (focus?.kind === "heading") root.querySelector("h1")?.focus();
        else if (focus?.kind === "candidate") candidates.get(focus.skillId)?.focus();
      }
    },
    dispose() {
      events.abort();
    },
  };
}
