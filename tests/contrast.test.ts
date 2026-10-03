import { expect, it } from "vitest";
import { plateContrastLowerBound } from "./contrast";

it("uses the WCAG ratio without rounding and composes the plate against the worst unknown background", () => {
  expect(plateContrastLowerBound([255, 255, 255], [0, 0, 0], 1)).toBe(21);
  expect(plateContrastLowerBound([255, 255, 255], [0, 0, 0], 0.6)).toBeCloseTo(5.74183648145415, 12);
  expect(plateContrastLowerBound([255, 255, 255], [119, 119, 119], 1)).toBeLessThan(4.5);
  expect(plateContrastLowerBound([255, 255, 255], [118, 118, 118], 1)).toBeGreaterThan(4.5);
  expect(plateContrastLowerBound([128, 128, 128], [0, 0, 0], 0.4)).toBe(1);
  expect(plateContrastLowerBound([255, 255, 255], [0, 0, 0], 1, [[255, 255, 255]])).toBe(1);
});
