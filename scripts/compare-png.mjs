import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PNG } from "pngjs";

export async function comparePNG(actualPath, referencePath) {
  const actual = PNG.sync.read(await readFile(actualPath));
  const reference = PNG.sync.read(await readFile(referencePath));
  if (actual.depth !== 8 || reference.depth !== 8) throw new Error("Expected 8-bit PNG channels");
  const result = {
    actual: resolve(actualPath),
    reference: resolve(referencePath),
    actualSize: [actual.width, actual.height],
    referenceSize: [reference.width, reference.height],
    identical: false,
  };
  if (actual.width !== reference.width || actual.height !== reference.height) return result;
  let differentPixels = 0;
  let maxChannelDifference = 0;
  for (let index = 0; index < actual.data.length; index += 4) {
    let different = false;
    for (let channel = 0; channel < 4; channel++) {
      const difference = Math.abs(actual.data[index + channel] - reference.data[index + channel]);
      different ||= difference !== 0;
      maxChannelDifference = Math.max(maxChannelDifference, difference);
    }
    differentPixels += Number(different);
  }
  return {
    ...result,
    totalPixels: actual.width * actual.height,
    differentPixels,
    maxChannelDifference,
    identical: differentPixels === 0,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const [actual, reference, ...extra] = process.argv.slice(2);
  if (!actual || !reference || extra.length) throw new Error("Usage: compare-png ACTUAL.png REFERENCE.png");
  const result = await comparePNG(actual, reference);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.identical) process.exitCode = 1;
}
