const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");

const ROOT = process.cwd();
const OUTPUT_DIR = path.join(ROOT, "js/pages");

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

function walk(dir) {
  return fs.readdirSync(dir).flatMap(file => {
    const full = path.join(dir, file);
    if (fs.statSync(full).isDirectory()) return walk(full);
    if (file.endsWith(".html")) return [full];
    return [];
  });
}

const files = walk(ROOT).filter(f =>
  !f.includes("node_modules") &&
  !f.includes("backup_refactor")
);

for (const file of files) {
  const html = fs.readFileSync(file, "utf8");
  const dom = new JSDOM(html);

  const scriptTags = [...dom.window.document.querySelectorAll("script")];

  const inlineScripts = [];
  let modifiedHTML = html;

  for (const script of scriptTags) {
    if (!script.src && script.textContent.trim()) {
      inlineScripts.push(script.textContent.trim());
      modifiedHTML = modifiedHTML.replace(script.outerHTML, "");
    }
  }

  if (inlineScripts.length === 0) continue;

  const base = path.basename(file, ".html");
  const outFile = path.join(OUTPUT_DIR, `${base}.js`);

  fs.writeFileSync(outFile, inlineScripts.join("\n\n"));

  // inject external script link BEFORE </body>
  const scriptTag = `<script src="js/pages/${base}.js"></script>`;
  if (!modifiedHTML.includes(scriptTag)) {
    modifiedHTML = modifiedHTML.replace("</body>", `${scriptTag}\n</body>`);
  }

  fs.writeFileSync(file, modifiedHTML);

  console.log(`✔ refactored: ${file} → js/pages/${base}.js`);
}
