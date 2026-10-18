import { readFileSync } from "node:fs";
import { availableParallelism, freemem } from "node:os";

const MiB = 1024 * 1024;

function systemFile(path) {
  try {
    return readFileSync(path, "utf8").trim();
  } catch (error) {
    if (error.code === "ENOENT") return undefined;
    throw error;
  }
}

export function designAvailableMemory({
  systemAvailable,
  freeMemory,
  processAvailable,
  constrainedMemory = 0,
  cgroupLimit,
  cgroupCurrent,
  inactiveFile = 0,
}) {
  // MemAvailable includes reclaimable cache; freemem/availableMemory may not.
  // cgroup v2's inactive_file is likewise reclaimable within its memory limit.
  const cgroupAvailable =
    Number.isFinite(cgroupLimit) && Number.isFinite(cgroupCurrent)
      ? Math.min(cgroupLimit, Math.max(0, cgroupLimit - cgroupCurrent + inactiveFile))
      : Infinity;
  return Math.min(
    systemAvailable ?? Math.min(freeMemory, processAvailable),
    constrainedMemory > 0 ? constrainedMemory : Infinity,
    cgroupAvailable,
  );
}

function resources() {
  const [quota, period] = (systemFile("/sys/fs/cgroup/cpu.max") ?? "").split(/\s+/).map(Number);
  const meminfo = process.platform === "linux" ? systemFile("/proc/meminfo") : undefined;
  const memAvailable = meminfo?.match(/^MemAvailable:\s+(\d+) kB$/m)?.[1];
  const inactiveFile = systemFile("/sys/fs/cgroup/memory.stat")?.match(/^inactive_file (\d+)$/m)?.[1];
  return {
    cpus: availableParallelism(),
    cpuQuota: quota > 0 && period > 0 ? quota / period : undefined,
    availableMemory: designAvailableMemory({
      systemAvailable: memAvailable === undefined ? undefined : Number(memAvailable) * 1024,
      freeMemory: freemem(),
      processAvailable: process.availableMemory(),
      constrainedMemory: process.constrainedMemory(),
      cgroupLimit: Number(systemFile("/sys/fs/cgroup/memory.max")),
      cgroupCurrent: Number(systemFile("/sys/fs/cgroup/memory.current")),
      inactiveFile: Number(inactiveFile ?? 0),
    }),
  };
}

/** Choose parallelism from this process's resources, without a host/CI-specific cap. */
export function designConcurrency({
  workers = "auto",
  memoryPerWorker = 768 * MiB,
  reserveMemory = 512 * MiB,
  resources: available = resources(),
} = {}) {
  if (workers !== "auto" && (!Number.isSafeInteger(workers) || workers < 1))
    throw new Error("workers must be 'auto' or a positive integer");
  if (!Number.isSafeInteger(memoryPerWorker) || memoryPerWorker < 1)
    throw new Error("memoryPerWorker must be a positive integer");
  if (!Number.isSafeInteger(reserveMemory) || reserveMemory < 0)
    throw new Error("reserveMemory must be a non-negative integer");
  const cpus = Math.max(1, Math.min(available.cpus, Math.ceil(available.cpuQuota ?? available.cpus)));
  const memoryWorkers = Math.max(1, Math.floor((available.availableMemory - reserveMemory) / memoryPerWorker));
  const automaticWorkers = Math.min(cpus, memoryWorkers);
  return {
    workers: workers === "auto" ? automaticWorkers : workers,
    automaticWorkers,
    cpus,
    cpuQuota: available.cpuQuota,
    availableMemory: available.availableMemory,
    memoryPerWorker,
    reserveMemory,
  };
}

/** Preserve input order and await every active task's cleanup before rejecting. */
export async function parallelMap(items, concurrency, task) {
  if (!Number.isSafeInteger(concurrency) || concurrency < 1) throw new Error("concurrency must be a positive integer");
  const results = new Array(items.length);
  let next = 0;
  let failed = false;
  let failure;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (!failed && next < items.length) {
        const index = next++;
        try {
          results[index] = await task(items[index], index);
        } catch (error) {
          if (!failed) {
            failed = true;
            failure = error;
          }
        }
      }
    }),
  );
  if (failed) throw failure;
  return results;
}
