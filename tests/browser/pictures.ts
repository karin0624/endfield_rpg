import { relative } from "node:path";
import { test } from "./coverage";

/** Record the real baseline passed to the standard matcher; successful cases prove the comparison ran. */
export function approvedPicture(path: string[]): string[] {
  const info = test.info();
  info.annotations.push({
    type: "snapshot-baseline",
    description: relative(process.cwd(), info.snapshotPath(...path)),
  });
  return path;
}
