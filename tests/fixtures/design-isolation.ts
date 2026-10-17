// Preserve the real component's layout, inherited styles and ancestor paint
// coordinates. Hiding an ancestor itself changes Chromium's raster context.
export function isolateDesignComponent(root: HTMLElement, selector: string) {
  const target = root.querySelector<HTMLElement>(selector);
  if (!target || root.querySelectorAll(selector).length !== 1)
    throw new Error(`Expected one design component: ${selector}`);
  for (let ancestor = target.parentElement; ancestor && root.contains(ancestor); ancestor = ancestor.parentElement) {
    ancestor.dataset.designIsolationAncestor = "";
    ancestor.style.background = "transparent";
    ancestor.style.borderColor = "transparent";
    ancestor.style.boxShadow = "none";
    for (const child of [...ancestor.childNodes]) {
      if (!(child instanceof Text) || !child.textContent?.trim()) continue;
      const hidden = document.createElement("span");
      hidden.style.visibility = "hidden";
      child.replaceWith(hidden);
      hidden.append(child);
    }
  }
  for (const element of root.querySelectorAll<HTMLElement>("*"))
    if (element !== target && !target.contains(element) && !element.contains(target))
      element.style.visibility = "hidden";
  const style = document.createElement("style");
  style.textContent =
    "[data-design-isolation-ancestor]::before,[data-design-isolation-ancestor]::after{visibility:hidden} dialog::backdrop{background:transparent!important}";
  root.append(style);
}
