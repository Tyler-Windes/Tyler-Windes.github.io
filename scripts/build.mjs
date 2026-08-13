import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sourceRoot = join(projectRoot, "src");
const assetRoot = join(projectRoot, "assets");
const distRoot = join(projectRoot, "dist");
const validationRoot = join(projectRoot, "validation");

for (const required of [sourceRoot, assetRoot]) {
  if (!existsSync(required)) throw new Error(`Missing static input directory: ${required}`);
}

if (existsSync(distRoot)) rmSync(distRoot, { recursive: true, force: true });
mkdirSync(distRoot, { recursive: true });
mkdirSync(validationRoot, { recursive: true });

cpSync(sourceRoot, distRoot, { recursive: true });
cpSync(assetRoot, join(distRoot, "assets"), { recursive: true });

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
  build_mode: "StaticByteCopy",
  source_roots: ["src", "assets"],
  output_root: "dist",
  file_count: entries.length,
  entries,
};
writeFileSync(join(validationRoot, "build-manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
process.stdout.write(`Built ${entries.length} static files.\n`);
