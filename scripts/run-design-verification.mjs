import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { DESIGN_IMAGE } from "./design-environment.mjs";
import { OPENPENCIL_REVISION } from "./openpencil.mjs";

const args = process.argv.slice(2);
const directory = process.cwd();
const source = `.openpencil/${OPENPENCIL_REVISION}`;
const containerIndex = args.indexOf("--container");
const container = containerIndex < 0 ? undefined : args.splice(containerIndex, 2)[1];
const rootIndex = args.indexOf("--container-root");
const root = rootIndex < 0 ? "/work" : args.splice(rootIndex, 2)[1];
if (!root?.startsWith("/")) throw new Error("Container root must be absolute");
const inside = [
  `${root}/node_modules/bun/bin/bun.exe`,
  `${root}/scripts/verify-design.mjs`,
  `${root}/${source}`,
  "--inside",
  ...args,
];
const command = process.env.DESIGN_IN_CONTAINER === "1" ? inside.shift() : "docker";
const options =
  process.env.DESIGN_IN_CONTAINER === "1"
    ? inside
    : container
      ? ["exec", "-w", root, container, ...inside]
      : [
          "run",
          "--rm",
          "--init",
          "--ipc=host",
          "--platform",
          "linux/amd64",
          "--user",
          `${process.getuid()}:${process.getgid()}`,
          "-v",
          `${resolve(directory)}:${root}`,
          "-w",
          root,
          DESIGN_IMAGE,
          ...inside,
        ];
const child = spawn(command, options, { stdio: "inherit" });
child.on("error", (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
