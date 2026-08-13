import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(projectRoot, "src");
const assetRoot = join(projectRoot, "assets");
const siteConfigPath = join(projectRoot, "content", "site", "site-config.json");
const distRoot = join(projectRoot, "dist");
const validationRoot = join(projectRoot, "validation");

for (const required of [sourceRoot, assetRoot, siteConfigPath]) {
  if (!existsSync(required)) throw new Error(`Missing static input directory: ${required}`);
}

const siteConfig = JSON.parse(readFileSync(siteConfigPath, "utf8"));
const siteBaseUrl = siteConfig.site_base_url;
assertSiteBaseUrl(siteBaseUrl);

if (existsSync(distRoot)) rmSync(distRoot, { recursive: true, force: true });
mkdirSync(distRoot, { recursive: true });
mkdirSync(validationRoot, { recursive: true });

cpSync(sourceRoot, distRoot, { recursive: true });
cpSync(assetRoot, join(distRoot, "assets"), { recursive: true });

for (const relativePath of ["index.html", "projects/workflow-intake-analysis.html", "404.html"]) {
  const absolute = join(distRoot, ...relativePath.split("/"));
  let html = readFileSync(absolute, "utf8");
  html = html.replaceAll("{{SITE_BASE_URL}}", siteBaseUrl);
  if (html.includes("{{SITE_BASE_URL}}")) throw new Error(`Unresolved SITE_BASE_URL token: ${relativePath}`);
  writeFileSync(absolute, html, "utf8");
}

writeFileSync(
  join(distRoot, "robots.txt"),
  `User-agent: *\nAllow: /\n\nSitemap: ${siteBaseUrl}/sitemap.xml\n`,
  "utf8",
);
writeFileSync(
  join(distRoot, "sitemap.xml"),
  [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    "  <url>",
    `    <loc>${siteBaseUrl}/</loc>`,
    "  </url>",
    "  <url>",
    `    <loc>${siteBaseUrl}/projects/workflow-intake-analysis.html</loc>`,
    "  </url>",
    "</urlset>",
    "",
  ].join("\n"),
  "utf8",
);

const files = [];
const walk = (directory) => {
  for (const name of readdirSync(directory)) {
    const absolute = join(directory, name);
    if (statSync(absolute).isDirectory()) walk(absolute);
    else files.push(absolute);
  }
};
walk(distRoot);

const entries = files.sort().map((absolute) => {
  const bytes = readFileSync(absolute);
  return {
    relative_path: relative(distRoot, absolute).replaceAll("\\", "/"),
    size_bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex").toUpperCase(),
  };
});

const manifest = {
  schema_version: "1.0.0",
  build_mode: "DeterministicSiteBaseUrlGeneration",
  site_base_url: siteBaseUrl,
  source_roots: ["src", "assets"],
  output_root: "dist",
  file_count: entries.length,
  entries,
};
writeFileSync(join(validationRoot, "build-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
process.stdout.write(`Built ${entries.length} static files.\n`);

function assertSiteBaseUrl(value) {
  const authorizedHosts = new Set(["tyler-windes.com", "tylerwindes.com"]);
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("Invalid site_base_url");
  }
  if (
    parsed.protocol !== "https:" ||
    !authorizedHosts.has(parsed.hostname) ||
    parsed.origin !== value ||
    parsed.pathname !== "/" ||
    parsed.search !== "" ||
    parsed.hash !== "" ||
    parsed.username !== "" ||
    parsed.password !== ""
  ) {
    throw new Error("site_base_url must be an authorized HTTPS apex origin without a trailing slash");
  }
}
