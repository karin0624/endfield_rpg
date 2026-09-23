export function requiredElement<T extends Element>(root: ParentNode, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (element === null) throw new Error(`必要な要素が見つかりません: ${selector}`);
  return element;
}
