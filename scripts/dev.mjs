import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

function run(name, command, args, cwd = root) {
  const child = spawn(command, args, {
    cwd,
    stdio: "inherit",
    shell: process.platform === "win32",
    env: {
      ...process.env,
      PATH: `${path.join(root, "node_modules", ".bin")}${path.delimiter}${process.env.PATH || ""}`,
    },
  });
  child.on("exit", (code) => {
    if (code && code !== 0) {
      console.error(`[${name}] exited ${code}`);
    }
  });
  return child;
}

const api = run("api", "go", ["run", "./cmd/api"], path.join(root, "backend"));
const web = run("web", "vite", ["--port", "3000", "--strictPort"]);

api.on("exit", (code) => {
  if (code && code !== 0) {
    web.kill("SIGTERM");
    process.exit(code);
  }
});

function shutdown() {
  api.kill("SIGTERM");
  web.kill("SIGTERM");
  setTimeout(() => process.exit(0), 500);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
