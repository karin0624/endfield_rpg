import * as v from "valibot";

// Wire-format constraints only. Definition lookup and ownership belong to restoration.
export const nonnegativeNumber = v.pipe(v.number(), v.finite(), v.minValue(0));
export const nonnegativeInteger = v.pipe(v.number(), v.safeInteger(), v.minValue(0));
export const positiveInteger = v.pipe(nonnegativeInteger, v.minValue(1));
export const savedRandomState = v.pipe(nonnegativeInteger, v.maxValue(0xffffffff));
