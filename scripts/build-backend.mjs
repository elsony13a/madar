import { build } from "esbuild";
import { mkdir, writeFile } from "node:fs/promises";
await mkdir("build/backend", { recursive: true });
await build({
  entryPoints: ["backend/handler.mjs"],
  outfile: "build/backend/handler.mjs",
  bundle: true,
  platform: "node",
  target: "node22",
  format: "esm",
  minify: false,
  sourcemap: false,
  banner: {
    js: "import {createRequire} from 'node:module';const require=createRequire(import.meta.url);",
  },
});
await writeFile(
  "build/backend/package.json",
  JSON.stringify({ type: "module" }),
);
console.log("Bundled backend ready at build/backend. No deployment performed.");
