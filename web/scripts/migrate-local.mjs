import {
  readdirSync,
  readFileSync,
  existsSync,
  mkdirSync,
  writeFileSync,
} from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import "./sites-env.mjs";
if (!existsSync("dist/server/wrangler.json")) {
  console.error("Build first: npm run build, then npm run db:migrate.");
  process.exit(1);
}
mkdirSync(".sites-runtime", { recursive: true });
const marker = ".sites-runtime/local-migrations.json";
const applied = existsSync(marker)
  ? JSON.parse(readFileSync(marker, "utf8"))
  : [];
for (const file of readdirSync("drizzle")
  .filter((file) => file.endsWith(".sql"))
  .sort()) {
  if (applied.includes(file)) continue;
  const result = spawnSync(
    process.execPath,
    [
      "--import",
      "./scripts/sites-env.mjs",
      "./node_modules/wrangler/bin/wrangler.js",
      "d1",
      "execute",
      "DB",
      "--local",
      "--config",
      "dist/server/wrangler.json",
      "--persist-to",
      ".wrangler/state",
      "--file",
      path.join("drizzle", file),
    ],
    { stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
  applied.push(file);
  writeFileSync(marker, JSON.stringify(applied, null, 2) + "\n");
}
console.log("Local database is up to date.");
