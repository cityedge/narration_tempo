import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
const root = new URL("./", import.meta.url);
const { version } = JSON.parse(
  await readFile(new URL("package.json", root), "utf8"),
);
if (!/^\d+\.\d+\.\d+$/.test(version))
  throw Error("Expected a numeric release version");
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
      (await readFile(new URL("src/analysis.js", root), "utf8")) +
      "\n" +
      (await readFile(new URL("src/formant.js", root), "utf8")) +
      "\n" +
      source;
  if (/<\/script/i.test(source)) throw Error("Unsafe script delimiter");
  html = html.replace("/*__" + tag + "__*/", () => source);
}
// The published entry point is index.html. Keep the former local filename in
// sync for existing bookmarks; the publication allowlist includes only index.html.
for (const name of ["index.html", "Narration_Tempo.html"])
  await writeFile(new URL(name, root), html, "utf8");
console.log(fileURLToPath(new URL("index.html", root)));

// Render the guide's deliberately small Markdown subset with no runtime dependencies.
const guide = (await readFile(new URL("USER_GUIDE.md", root), "utf8")).replace(
  /^\uFEFF/,
  "",
);
const escape = (s) =>
  s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
const lines = guide.trim().split(/\r?\n/),
  body = [],
  toc = [];
let table = false,
  section = 0;
for (const line of lines) {
  if (line.startsWith("|")) {
    if (/^\|[ \-:|]+$/.test(line)) continue;
    const cells = line.split("|").slice(1, -1);
    const tag = table ? "td" : "th";
    if (!table) {
      body.push('<div class="table-scroll"><table>');
      table = true;
    }
    body.push(
      "<tr>" +
        cells
          .map((c) => "<" + tag + ">" + escape(c.trim()) + "</" + tag + ">")
          .join("") +
        "</tr>",
    );
    continue;
  }
  if (table) {
    body.push("</table></div>");
    table = false;
  }
  if (!line.trim()) continue;
  if (line.startsWith("# "))
    body.push("<h1>" + escape(line.slice(2)) + "</h1>");
  else if (line.startsWith("## ")) {
    const id = "section-" + ++section,
      title = escape(line.slice(3));
    toc.push('<a href="#' + id + '">' + title + "</a>");
    body.push('<h2 id="' + id + '">' + title + "</h2>");
  } else body.push("<p>" + escape(line) + "</p>");
}
if (table) body.push("</table></div>");
const guideHtml =
  '<!doctype html><html lang="ja"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Narration Tempo v' +
  version +
  " ユーザーマニュアル</title><style>html{color-scheme:dark;scroll-behavior:smooth}body{background:#0c131d;color:#e3eaf3;font:16px/1.85 system-ui,sans-serif;max-width:1000px;margin:auto;padding:28px}h1{font-size:1.8rem}h2{margin-top:2.4em;border-bottom:1px solid #34465a;padding-bottom:.4em;scroll-margin-top:20px}a{color:#63d4da}nav{background:#152130;padding:20px;border-radius:8px}nav a{display:block}table{border-collapse:collapse;width:100%;min-width:540px}td,th{border:1px solid #34465a;padding:12px;text-align:left}th{background:#182838}.table-scroll{overflow-x:auto}p{overflow-wrap:anywhere}@media(max-width:600px){body{padding:16px}h1{font-size:1.4rem}}@media print{body{background:white;color:black;max-width:none}nav{display:none}td,th{background:white;border-color:#888}}</style><main>" +
  body.shift() +
  '<nav aria-label="目次"><strong>目次</strong>' +
  toc.join("") +
  "</nav>" +
  body.join("\n") +
  "</main></html>";
await writeFile(new URL("USER_GUIDE.html", root), guideHtml, "utf8");
