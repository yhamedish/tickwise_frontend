import fs from "fs";
import path from "path";

const distDir = "dist";
const routes = ["picks"]; // add more routes later if you have them

const src = path.join(distDir, "index.html");
if (!fs.existsSync(src)) {
  console.error("dist/index.html not found. Run build first.");
  process.exit(1);
}

for (const r of routes) {
  const dir = path.join(distDir, r);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(src, path.join(dir, "index.html"));
  console.log(`Created ${dir}/index.html`);
}
