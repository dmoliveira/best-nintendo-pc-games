import { spawnSync } from "node:child_process";

const maxBuildMilliseconds = 180_000;
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const startedAt = performance.now();
const result = spawnSync(npmCommand, ["run", "build"], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});

if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);

const elapsedMilliseconds = performance.now() - startedAt;
if (elapsedMilliseconds > maxBuildMilliseconds) {
  console.error(`Catalog-1000 build exceeded the ${maxBuildMilliseconds / 1000}-second limit (${(elapsedMilliseconds / 1000).toFixed(2)} seconds).`);
  process.exit(1);
}

console.log(`Catalog-1000 build completed in ${(elapsedMilliseconds / 1000).toFixed(2)} seconds (limit ${maxBuildMilliseconds / 1000} seconds).`);
