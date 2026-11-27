import { build } from "esbuild";
import { readFile, writeFile } from "node:fs/promises";
if ((await import("../web/config.js")).config.mode !== "demo")
  throw Error(
    "Standalone preview must stay in demo mode. Restore demo config before building it.",
  );
const built = await build({
  entryPoints: ["web/app.js"],
  bundle: true,
  write: false,
  format: "iife",
  platform: "browser",
  target: "es2022",
  minify: true,
});
let css = await readFile("web/style.css", "utf8");
for (const name of [
  "dm-sans-latin-wght-normal.woff2",
  "noto-sans-arabic-arabic-wght-normal.woff2",
])
  css = css.replace(
    `./fonts/${name}`,
    "data:font/woff2;base64," +
      (await readFile("web/fonts/" + name)).toString("base64"),
  );
const icon =
  "data:image/svg+xml;base64," +
  (await readFile("web/mark.svg")).toString("base64");
let html = await readFile("web/index.html", "utf8");
html = html
  .replace(
    '<link rel="icon" href="./mark.svg" />',
    () => `<link rel="icon" href="${icon}">`,
  )
  .replace(
    '<link rel="stylesheet" href="./style.css" />',
    () => `<style>${css}</style>`,
  )
  .replace(
    '<script type="module" src="./app.js"></script>',
    () =>
      `<script>${built.outputFiles[0].text.replace(/<\/script/gi, "<\\/script")}</script>`,
  );
if (
  !html.includes("data:font/woff2") ||
  !html.includes("<style>") ||
  html.includes('href="./style.css"') ||
  html.includes('src="./app.js"')
)
  throw Error("Standalone asset embedding failed");
await writeFile("Madar-Preview.html", html);
await writeFile("Madar-Preview.html.txt", html);
console.log(
  "Standalone demo HTML created, with fonts and code embedded. No cloud connection or deployment.",
);
