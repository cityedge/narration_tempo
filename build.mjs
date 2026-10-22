import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("./", import.meta.url);
const { version } = JSON.parse(await readFile(new URL("package.json", root), "utf8"));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw Error("Expected a numeric release version");
let html = await readFile(new URL("src/index.html", root), "utf8");
html = html.replaceAll("__APP_VERSION__", version);
for (const [tag, file] of [
  ["STYLE", "style.css"],
  ["WORKER", "engine.js"],
  ["APP", "app.js"],
]) {
  let source = await readFile(new URL("src/" + file, root), "utf8");
  if (tag === "WORKER")
    source =
      "/* BrowserMp3 bundle:begin */\n" +
      (await readFile(new URL("vendor/browser-mp3.js", root), "utf8")) +
      "\n/* BrowserMp3 bundle:end */\n" +
      source;
  if (/<\/script/i.test(source)) throw Error("Unsafe script delimiter");
  html = html.replace("/*__" + tag + "__*/", () => source);
}
const path = new URL("Narration_Tempo.html", root);
await writeFile(path, html, "utf8");
console.log(fileURLToPath(path));
