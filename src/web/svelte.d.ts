import "svelte/elements";

// Preserve the existing accessible descriptions until Svelte types include aria-description.
declare module "svelte/elements" {
  interface AriaAttributes {
    "aria-description"?: string;
  }
}
