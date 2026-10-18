import { expect, it } from "vitest";
import { designAvailableMemory, designConcurrency, parallelMap } from "./design-workers.mjs";

const MiB = 1024 * 1024;

it("counts reclaimable Linux file cache without exceeding system or cgroup limits", () => {
  const availableMemory = designAvailableMemory({
    systemAvailable: 8192 * MiB,
    freeMemory: 1024 * MiB,
    processAvailable: 1024 * MiB,
    constrainedMemory: 16384 * MiB,
    cgroupLimit: 8192 * MiB,
    cgroupCurrent: 7168 * MiB,
    inactiveFile: 6144 * MiB,
  });
  expect(availableMemory).toBe(7168 * MiB);
  expect(designConcurrency({ memoryPerWorker: 1280 * MiB, resources: { cpus: 8, availableMemory } })).toMatchObject({
    workers: 5,
  });
  const limits = { systemAvailable: 16384 * MiB, cgroupLimit: 8192 * MiB, cgroupCurrent: 7168 * MiB };
  expect(designAvailableMemory({ ...limits, inactiveFile: 16384 * MiB })).toBe(8192 * MiB);
  expect(designAvailableMemory({ ...limits, inactiveFile: 6144 * MiB, constrainedMemory: 4096 * MiB })).toBe(
    4096 * MiB,
  );
  expect(designAvailableMemory({ ...limits, cgroupCurrent: 9216 * MiB })).toBe(0);
});

it("uses standard Node memory information when Linux MemAvailable is unavailable", () => {
  const memory = { freeMemory: 3072 * MiB, processAvailable: 2048 * MiB };
  expect(designAvailableMemory(memory)).toBe(2048 * MiB);
  expect(designAvailableMemory({ ...memory, constrainedMemory: 1024 * MiB })).toBe(1024 * MiB);
  expect(designAvailableMemory({ ...memory, systemAvailable: 0 })).toBe(0);
});

it("uses available CPU and memory independently for local and CI-sized machines", () => {
  const choose = (cpus, memory, cpuQuota) =>
    designConcurrency({ resources: { cpus, cpuQuota, availableMemory: memory * MiB } });
  expect(choose(2, 8192)).toMatchObject({ workers: 2, cpus: 2 });
  expect(choose(8, 16384)).toMatchObject({ workers: 8, cpus: 8 });
  expect(choose(8, 2048)).toMatchObject({ workers: 2, cpus: 8 });
  expect(choose(8, 8192, 1.5)).toMatchObject({ workers: 2, cpus: 2, cpuQuota: 1.5 });
  expect(choose(2, 0)).toMatchObject({ workers: 1, availableMemory: 0 });
});

it("allows an explicit positive worker count and configurable per-worker memory", () => {
  const resources = { cpus: 2, availableMemory: 2048 * MiB };
  expect(designConcurrency({ workers: 8, resources })).toMatchObject({ workers: 8, automaticWorkers: 2 });
  expect(designConcurrency({ memoryPerWorker: 1536 * MiB, resources })).toMatchObject({ workers: 1 });
  expect(designConcurrency({ memoryPerWorker: 512 * MiB, resources })).toMatchObject({ workers: 2 });
  for (const workers of [0, -1, 1.5, "4", "invalid", Infinity])
    expect(() => designConcurrency({ workers, resources })).toThrow();
  expect(() => designConcurrency({ memoryPerWorker: 0, resources })).toThrow();
  expect(() => designConcurrency({ reserveMemory: -1, resources })).toThrow();
});

it("runs bounded independent tasks while returning results in input order", async () => {
  const gates = Array.from({ length: 4 }, () => Promise.withResolvers());
  const began = Array.from({ length: 4 }, () => Promise.withResolvers());
  const started = [];
  let active = 0;
  let peak = 0;
  const result = parallelMap(["a", "b", "c", "d"], 2, async (item, index) => {
    started.push(index);
    active++;
    peak = Math.max(peak, active);
    began[index].resolve();
    try {
      await gates[index].promise;
      return item.toUpperCase();
    } finally {
      active--;
    }
  });
  expect(started).toEqual([0, 1]);
  gates[1].resolve();
  await began[2].promise;
  gates[2].resolve();
  await began[3].promise;
  gates[3].resolve();
  gates[0].resolve();
  expect(await result).toEqual(["A", "B", "C", "D"]);
  expect(peak).toBe(2);
  expect(active).toBe(0);
});

it("stops starting work after failure and waits for active cleanup before rejecting", async () => {
  const work = Promise.withResolvers();
  const cleanupStarted = Promise.withResolvers();
  const cleanupFinished = Promise.withResolvers();
  const failure = new Error("export failed");
  const started = [];
  let settled = false;
  const result = parallelMap([0, 1, 2, 3], 2, async (index) => {
    started.push(index);
    if (index === 0) throw failure;
    try {
      await work.promise;
    } finally {
      cleanupStarted.resolve();
      await cleanupFinished.promise;
    }
  });
  const outcome = result.catch((error) => error);
  void outcome.then(() => {
    settled = true;
  });
  work.resolve();
  await cleanupStarted.promise;
  expect(started).toEqual([0, 1]);
  expect(settled).toBe(false);
  cleanupFinished.resolve();
  expect(await outcome).toBe(failure);
  expect(started).toEqual([0, 1]);
  expect(await parallelMap([], 8, () => "unused")).toEqual([]);
  await expect(parallelMap([1], 0, () => "unused")).rejects.toThrow();
});
