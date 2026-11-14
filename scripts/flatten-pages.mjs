import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const dist = "dist-pages";
const nested = join(dist, "spa", "index.html");
const dest = join(dist, "index.html");

if (!existsSync(nested) && existsSync(dest)) {
  copyFileSync(dest, join(dist, "404.html"));
  process.exit(0);
}

if (!existsSync(nested)) {
  console.error("flatten-pages: no HTML at", nested, "or", dest);
  process.exit(1);
}

let html = readFileSync(nested, "utf8");
html = html.replaceAll("../assets/", "./assets/");
html = html.replaceAll('src="/assets/', 'src="./assets/');
html = html.replaceAll('href="/assets/', 'href="./assets/');
writeFileSync(dest, html);
writeFileSync(join(dist, "404.html"), html);
rmSync(join(dist, "spa"), { recursive: true, force: true });
console.log("flatten-pages: wrote dist-pages/index.html");
