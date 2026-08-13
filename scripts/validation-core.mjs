import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const sourceRoot = join(projectRoot, "src");
const assetRoot = join(projectRoot, "assets");
const distRoot = join(projectRoot, "dist");
const reportPath = join(projectRoot, "validation", "public-validation.json");
const manifestPath = join(projectRoot, "validation", "build-manifest.json");
const contentPath = join(projectRoot, "content", "projects", "workflow-intake-analysis.json");
const schemaPath = join(projectRoot, "content", "schemas", "public-project-content.schema.json");
const educationContentPath = join(projectRoot, "content", "site", "education.json");
const siteConfigPath = join(projectRoot, "content", "site", "site-config.json");
const educationSchemaPath = join(
  projectRoot,
  "content",
  "schemas",
  "public-education-content.schema.json",
);
const workflowPath = join(projectRoot, ".github", "workflows", "pages.yml");

const siteConfig = readJson(siteConfigPath);
const siteOrigin = siteConfig.site_base_url;
const homeUrl = siteOrigin + "/";
const projectUrl = siteOrigin + "/projects/workflow-intake-analysis.html";
const notFoundUrl = siteOrigin + "/404.html";
const socialUrl = siteOrigin + "/assets/social-preview-1200x630.png";
const repositoryUrl = "https://github.com/Tyler-Windes/workflow-intake-analysis-demo";
const profileUrl = "https://github.com/Tyler-Windes";
const allowedExternalUrls = new Set([repositoryUrl, profileUrl]);
const allowedHttpsUrls = new Set([
  ...allowedExternalUrls,
  homeUrl,
  projectUrl,
  notFoundUrl,
]);

const publicInputPaths = [
  ".gitattributes",
  ".github/workflows/pages.yml",
  ".gitignore",
  ".nvmrc",
  "LICENSE",
  "README.md",
  "assets/favicon.svg",
  "assets/social-preview-1200x630.png",
  "content/projects/workflow-intake-analysis.json",
  "content/site/education.json",
  "content/site/site-config.json",
  "content/schemas/public-education-content.schema.json",
  "content/schemas/public-project-content.schema.json",
  "package.json",
  "scripts/build.mjs",
  "scripts/serve.mjs",
  "scripts/validate-public.mjs",
  "scripts/validation-core.mjs",
  "src/.nojekyll",
  "src/404.html",
  "src/index.html",
  "src/projects/workflow-intake-analysis.html",
  "src/robots.txt",
  "src/sitemap.xml",
  "src/styles.css",
];

const expectedStaticPaths = [
  ".nojekyll",
  "404.html",
  "assets/favicon.svg",
  "assets/social-preview-1200x630.png",
  "index.html",
  "projects/workflow-intake-analysis.html",
  "robots.txt",
  "sitemap.xml",
  "styles.css",
];

const requiredContentKeys = [
  "$schema",
  "schema_version",
  "title",
  "subtitle",
  "data_class",
  "why_built",
  "lead_problem",
  "human_judgment",
  "design_decisions",
  "primary_skills",
  "results",
  "links",
  "ai_use",
  "scope",
  "lesson",
  "next_improvement",
];

const requiredLinkKeys = ["repository_name", "repository_url", "profile_url"];

const requiredEducationKeys = [
  "$schema",
  "schema_version",
  "section_heading",
  "context",
  "items",
  "claim_boundary",
];
const requiredEducationItemKeys = ["classification", "institution", "detail"];
const exactEducationHeading = "Education & Technical Training";
const exactEducationContext =
  "My education combines a business foundation with hands-on technical training that supports my work across systems, workflows, data quality, and technical problem solving.";
const exactEducationItems = [
  {
    classification: "Degree",
    institution: "Front Range Community College",
    detail: "Associate of Arts with Business Designation, 2015",
  },
  {
    classification: "CompletedTechnicalTraining",
    institution: "University of Denver",
    detail: "Cybersecurity Boot Camp, 240-hour completed program, 2022",
  },
  {
    classification: "CourseworkNotDegree",
    institution: "Additional coursework",
    detail: "Additional coursework at Colorado State University and the University of Northern Colorado",
  },
];
const exactEducationBoundary =
  "Cybersecurity is a supporting technical foundation only where accurately represented. Colorado State University and the University of Northern Colorado are coursework, not degrees.";

const actionPins = [
  {
    name: "actions/checkout",
    version: "v7.0.1",
    sha: "3d3c42e5aac5ba805825da76410c181273ba90b1",
  },
  {
    name: "actions/setup-node",
    version: "v7.0.0",
    sha: "820762786026740c76f36085b0efc47a31fe5020",
  },
  {
    name: "actions/configure-pages",
    version: "v6.0.0",
    sha: "45bfe0192ca1faeb007ade9deae92b16b8254a0d",
  },
  {
    name: "actions/upload-pages-artifact",
    version: "v5.0.0",
    sha: "fc324d3547104276b827a68afc52ff2a11cc49c9",
  },
  {
    name: "actions/deploy-pages",
    version: "v5.0.0",
    sha: "cd2ce8fcbc39b97be8ca5fce6e763baed58fa128",
  },
];

export function runPublicValidation({ writeReport = true } = {}) {
  const checks = [];
  const check = (id, condition, detail) => {
    checks.push({ id, result: condition ? "PASS" : "FAIL", detail });
  };

  for (const path of publicInputPaths) {
    check("INPUT_EXISTS_" + safeId(path), existsSync(join(projectRoot, ...path.split("/"))), path);
  }

  const content = readJson(contentPath);
  const schema = readJson(schemaPath);
  const educationContent = readJson(educationContentPath);
  const educationSchema = readJson(educationSchemaPath);
  const manifest = readJson(manifestPath);
  const packageJson = readJson(join(projectRoot, "package.json"));
  const workflow = readText(workflowPath);
  const readme = readText(join(projectRoot, "README.md"));
  const attributes = readText(join(projectRoot, ".gitattributes"));
  const ignore = readText(join(projectRoot, ".gitignore"));
  const nodeVersion = readText(join(projectRoot, ".nvmrc")).trim();
  const license = readText(join(projectRoot, "LICENSE"));
  const robots = readText(join(sourceRoot, "robots.txt")).replaceAll("\r\n", "\n");
  const sitemap = readText(join(sourceRoot, "sitemap.xml"));
  const noJekyll = readFile(join(sourceRoot, ".nojekyll"));
  const css = readText(join(sourceRoot, "styles.css"));
  const favicon = readText(join(assetRoot, "favicon.svg"));
  const socialBytes = readFile(join(assetRoot, "social-preview-1200x630.png"));

  let siteBaseUrlIsAuthorized = false;
  try {
    const parsedSiteBaseUrl = new URL(siteOrigin);
    siteBaseUrlIsAuthorized =
      parsedSiteBaseUrl.protocol === "https:" &&
      new Set(["tyler-windes.com", "tylerwindes.com"]).has(parsedSiteBaseUrl.hostname) &&
      parsedSiteBaseUrl.origin === siteOrigin &&
      parsedSiteBaseUrl.pathname === "/" &&
      parsedSiteBaseUrl.search === "" &&
      parsedSiteBaseUrl.hash === "" &&
      parsedSiteBaseUrl.username === "" &&
      parsedSiteBaseUrl.password === "";
  } catch {
    siteBaseUrlIsAuthorized = false;
  }

  check(
    "SITE_CONFIG_KEYS_EXACT",
    equalSets(Object.keys(siteConfig), ["schema_version", "site_base_url"]),
    "The site-address authority contains only its schema version and base URL.",
  );
  check(
    "SITE_BASE_URL_AUTHORIZED",
    siteConfig.schema_version === "1.0.0" && siteBaseUrlIsAuthorized,
    "The one current site-base authority is an approved HTTPS apex origin with no trailing slash.",
  );
  check(
    "SITE_BASE_MIGRATION_DOCUMENTED",
    readme.includes("`content/site/site-config.json`") &&
      readme.includes("change only `site_base_url`") &&
      readme.includes("DNS, Cloudflare, and GitHub Pages domain settings remain separate"),
    "The future one-value base-URL migration and infrastructure boundary are documented.",
  );

  check("INPUT_COUNT_EXACT", publicInputPaths.length === 25, "Twenty-five explicit public inputs.");
  check("NODE_RUNTIME_FILE", nodeVersion === "24.18.1", "Node.js 24.18.1.");
  check(
    "PACKAGE_RUNTIME",
    packageJson.engines?.node === ">=24 <25" &&
      packageJson.scripts?.build === "node scripts/build.mjs" &&
      packageJson.scripts?.validate === "npm run build && node scripts/validate-public.mjs",
    "Package scripts and Node 24 range are exact.",
  );
  check(
    "IGNORE_GENERATED",
    ["dist/", "node_modules/", "validation/", "*.log"].every((value) => ignore.includes(value)),
    "Generated outputs and dependencies are ignored.",
  );
  check(
    "ATTRIBUTES_BINARY",
    attributes.includes("* text=auto eol=lf") && attributes.includes("*.png binary"),
    "Text line endings and PNG binary handling are explicit.",
  );
  check(
    "LICENSE_MIT",
    license.startsWith("MIT License") && license.includes("Copyright (c) 2026 Tyler Windes"),
    "MIT license is present.",
  );

  check(
    "CONTENT_KEYS_EXACT",
    equalSets(Object.keys(content), requiredContentKeys),
    "Public content contains the documented top-level field set.",
  );
  check(
    "CONTENT_SCHEMA_REFERENCE",
    content.$schema === "../schemas/public-project-content.schema.json",
    "Public content uses the committed local schema.",
  );
  check(
    "SCHEMA_PUBLIC_ID",
    schema.$id === "urn:tyler-windes:portfolio:schemas:public-project-content:1.0.0",
    "Project schema has a stable domain-independent public identifier.",
  );
  check(
    "CONTENT_SCHEMA_CLOSED",
    schema.additionalProperties === false &&
      Array.isArray(schema.required) &&
      equalSets(schema.required, requiredContentKeys),
    "Schema is closed and requires every public field.",
  );
  check(
    "LINKS_SCHEMA_CLOSED",
    schema.properties?.links?.additionalProperties === false &&
      equalSets(schema.properties?.links?.required, requiredLinkKeys),
    "Employer-facing project links are closed and public-minimal.",
  );
  check(
    "EDUCATION_CONTENT_KEYS_EXACT",
    equalSets(Object.keys(educationContent), requiredEducationKeys),
    "Education content contains the exact documented field set.",
  );
  check(
    "EDUCATION_SCHEMA_REFERENCE",
    educationContent.$schema === "../schemas/public-education-content.schema.json",
    "Education content uses the committed local schema.",
  );
  check(
    "EDUCATION_SCHEMA_PUBLIC_ID",
    educationSchema.$id === "urn:tyler-windes:portfolio:schemas:public-education-content:1.0.0",
    "Education schema has a stable domain-independent public identifier.",
  );
  check(
    "EDUCATION_SCHEMA_CLOSED",
    educationSchema.additionalProperties === false &&
      equalSets(educationSchema.required, requiredEducationKeys),
    "Education schema requires the complete field set and rejects undocumented fields.",
  );
  const educationItemSchemas = educationSchema.properties?.items?.prefixItems || [];
  check(
    "EDUCATION_ITEM_SCHEMA_EXACT",
    educationSchema.properties?.items?.minItems === 3 &&
      educationSchema.properties?.items?.maxItems === 3 &&
      educationSchema.properties?.items?.items === false &&
      educationItemSchemas.length === 3 &&
      educationItemSchemas.every(
        (itemSchema, index) =>
          itemSchema.additionalProperties === false &&
          equalSets(itemSchema.required, requiredEducationItemKeys) &&
          itemSchema.properties?.classification?.const === exactEducationItems[index].classification &&
          itemSchema.properties?.institution?.const === exactEducationItems[index].institution &&
          itemSchema.properties?.detail?.const === exactEducationItems[index].detail,
      ),
    "Education schema fixes the exact degree, training, and coursework records.",
  );
  check(
    "EDUCATION_CONTENT_EXACT",
    educationContent.section_heading === exactEducationHeading &&
      educationContent.context === exactEducationContext &&
      educationContent.claim_boundary === exactEducationBoundary &&
      Array.isArray(educationContent.items) &&
      JSON.stringify(educationContent.items) === JSON.stringify(exactEducationItems),
    "Education content matches the approved authority and claim boundary exactly.",
  );
  check(
    "CONTENT_LINK_KEYS_EXACT",
    equalSets(Object.keys(content.links || {}), requiredLinkKeys),
    "Project links contain the exact public field set.",
  );
  check(
    "CONTENT_LINK_IDENTITY",
    content.links?.repository_name === "workflow-intake-analysis-demo" &&
      content.links?.repository_url === repositoryUrl &&
      content.links?.profile_url === profileUrl,
    "Repository and profile URLs are exact.",
  );
  check("CONTENT_DATA_CLASS", content.data_class === "Synthetic", "Synthetic.");
  check(
    "CONTENT_PRIMARY_SKILLS",
    JSON.stringify(content.primary_skills) ===
      JSON.stringify([
        "Systems analysis",
        "Requirements and acceptance criteria",
        "Data-quality validation",
        "SQL and reconciliation",
        "Traceability and technical/business communication",
      ]),
    "Primary skills preserve the reviewed emphasis and order.",
  );
  check(
    "CONTENT_RESULT_SET",
    ["30", "21", "9", "420", "15", "12/12"].every((value) =>
      (content.results || []).some((item) => item.value === value),
    ),
    "Six bounded synthetic-data and reconciliation results are present.",
  );
  check(
    "CONTENT_AI_ACCOUNTABILITY",
    content.ai_use?.includes("defined the goals and business rules") &&
      content.ai_use?.includes("made the final decisions") &&
      content.ai_use?.includes("reproducible code"),
    "AI assistance remains subordinate to Tyler's direction and reproducible evidence.",
  );
  check(
    "CONTENT_SCOPE_TWO_PARAGRAPHS",
    Array.isArray(content.scope) &&
      content.scope.length === 2 &&
      content.scope[0].includes("synthetic data") &&
      content.scope[0].includes("not a live production deployment") &&
      content.scope[1].includes("remain in review"),
    "Scope is stated in two concise employer-facing paragraphs.",
  );

  const staticSources = [
    ...listFiles(sourceRoot).map((absolute) => ({
      absolute,
      relative: toPosix(relative(sourceRoot, absolute)),
    })),
    ...listFiles(assetRoot).map((absolute) => ({
      absolute,
      relative: "assets/" + toPosix(relative(assetRoot, absolute)),
    })),
  ].sort((left, right) => left.relative.localeCompare(right.relative));
  const staticPaths = staticSources.map((item) => item.relative);
  const builtPaths = listFiles(distRoot)
    .map((absolute) => toPosix(relative(distRoot, absolute)))
    .sort();

  check("STATIC_SOURCE_SET", equalArrays(staticPaths, expectedStaticPaths), "Nine exact deployable files.");
  check("BUILD_FILE_SET", equalArrays(builtPaths, expectedStaticPaths), "Built routes exactly match source.");
  check(
    "BUILD_MANIFEST_FILE_SET",
    manifest.file_count === expectedStaticPaths.length &&
      equalArrays(
        (manifest.entries || []).map((item) => item.relative_path).sort(),
        expectedStaticPaths,
      ),
    "Build manifest exactly enumerates the deployable tree.",
  );
  check(
    "BUILD_MANIFEST_MODE",
    manifest.build_mode === "DeterministicSiteBaseUrlGeneration" &&
      manifest.site_base_url === siteOrigin &&
      equalArrays(manifest.source_roots, ["src", "assets"]) &&
      manifest.output_root === "dist",
    "Build mode, site-base authority, and roots are explicit.",
  );

  const manifestByPath = new Map((manifest.entries || []).map((item) => [item.relative_path, item]));
  const generatedSiteBasePaths = new Set([
    "404.html",
    "index.html",
    "projects/workflow-intake-analysis.html",
    "robots.txt",
    "sitemap.xml",
  ]);
  for (const source of staticSources) {
    const sourceBytes = readFile(source.absolute);
    const builtBytes = readFile(join(distRoot, ...source.relative.split("/")));
    const entry = manifestByPath.get(source.relative);
    const expectedBytes = generatedSiteBasePaths.has(source.relative)
      ? Buffer.from(sourceBytes.toString("utf8").replaceAll("{{SITE_BASE_URL}}", siteOrigin), "utf8")
      : sourceBytes;
    check(
      "BUILD_BYTES_" + safeId(source.relative),
      expectedBytes.equals(builtBytes),
      generatedSiteBasePaths.has(source.relative)
        ? source.relative + " is deterministically generated from site_base_url."
        : source.relative,
    );
    check(
      "BUILD_HASH_" + safeId(source.relative),
      entry?.size_bytes === expectedBytes.length && entry?.sha256 === sha256(expectedBytes),
      source.relative + " matches its build-manifest identity.",
    );
  }

  const pages = [
    {
      name: "HOME",
      absolute: join(distRoot, "index.html"),
      html: readText(join(distRoot, "index.html")),
      canonical: homeUrl,
      stylesheet: "styles.css",
      favicon: "assets/favicon.svg",
      ogType: "website",
    },
    {
      name: "PROJECT",
      absolute: join(distRoot, "projects", "workflow-intake-analysis.html"),
      html: readText(join(distRoot, "projects", "workflow-intake-analysis.html")),
      canonical: projectUrl,
      stylesheet: "../styles.css",
      favicon: "../assets/favicon.svg",
      ogType: "article",
    },
    {
      name: "NOT_FOUND",
      absolute: join(distRoot, "404.html"),
      html: readText(join(distRoot, "404.html")),
      canonical: notFoundUrl,
      stylesheet: "styles.css",
      favicon: "assets/favicon.svg",
      ogType: "website",
    },
  ];

  for (const page of pages) {
    const ids = allMatches(page.html, /\bid="([^"]+)"/gi);
    const labelledBy = allMatches(page.html, /\baria-labelledby="([^"]+)"/gi);
    const headings = [...page.html.matchAll(/<h([1-6])\b/gi)].map((match) => Number(match[1]));
    const externalLinks = allMatches(page.html, /\bhref="(https:\/\/[^"]+)"/gi);

    check(page.name + "_DOCTYPE", /^\s*<!doctype html>/i.test(page.html), "HTML5 doctype.");
    check(page.name + "_LANG", /<html\s+lang="en">/i.test(page.html), "English language.");
    check(page.name + "_TITLE", count(page.html, /<title>[\s\S]*?<\/title>/gi) === 1, "One title.");
    check(
      page.name + "_DESCRIPTION",
      count(page.html, /<meta\s+name="description"\s+content="[^"]+">/gi) === 1,
      "One description.",
    );
    check(
      page.name + "_ROBOTS",
      page.html.includes('<meta name="robots" content="index, follow">') &&
        !/noindex|nofollow|noarchive/i.test(page.html),
      "Public indexing directive.",
    );
    check(
      page.name + "_CANONICAL",
      page.html.includes('<link rel="canonical" href="' + page.canonical + '">'),
      page.canonical,
    );
    check(
      page.name + "_OPEN_GRAPH",
      page.html.includes('<meta property="og:type" content="' + page.ogType + '">') &&
        page.html.includes('<meta property="og:url" content="' + page.canonical + '">') &&
        page.html.includes('<meta property="og:image" content="' + socialUrl + '">') &&
        page.html.includes('<meta property="og:image:width" content="1200">') &&
        page.html.includes('<meta property="og:image:height" content="630">') &&
        /<meta property="og:image:alt" content="[^"]+">/i.test(page.html),
      "Open Graph URL and 1200x630 image metadata.",
    );
    check(
      page.name + "_TWITTER_CARD",
      page.html.includes('<meta name="twitter:card" content="summary_large_image">'),
      "Large-image Twitter card.",
    );
    check(
      page.name + "_LOCAL_ASSETS",
      page.html.includes('<link rel="stylesheet" href="' + page.stylesheet + '">') &&
        page.html.includes('<link rel="icon" href="' + page.favicon + '" type="image/svg+xml">') &&
        !/(?:src|poster)="(?:https?:)?\/\//i.test(page.html),
      "Stylesheet and favicon are local; no external media assets.",
    );
    check(page.name + "_MAIN", count(page.html, /<main\b/gi) === 1, "One main landmark.");
    check(page.name + "_H1", count(page.html, /<h1\b/gi) === 1, "One h1.");
    check(
      page.name + "_HEADING_ORDER",
      headings.every((level, index) => index === 0 || level <= headings[index - 1] + 1),
      "Heading levels do not skip downward.",
    );
    check(
      page.name + "_SKIP_LINK",
      page.html.includes('<a class="skip-link" href="#main-content">') &&
        page.html.includes('<main id="main-content" tabindex="-1">'),
      "Skip link targets a focusable main landmark.",
    );
    check(page.name + "_DUPLICATE_IDS", ids.length === new Set(ids).size, "No duplicate IDs.");
    check(
      page.name + "_ARIA_TARGETS",
      labelledBy.every((value) => value.split(/\s+/).every((id) => ids.includes(id))),
      "Every aria-labelledby reference resolves.",
    );
    check(
      page.name + "_NO_ACTIVE_CONTENT",
      !/<(?:script|form|iframe|object|embed|input|textarea|select)\b/i.test(page.html),
      "No scripts, forms, embeds, or data-entry controls.",
    );
    check(
      page.name + "_EXTERNAL_ALLOWLIST",
      externalLinks.every((url) => allowedHttpsUrls.has(url)),
      "Every external link is an approved HTTPS GitHub URL.",
    );
    check(
      page.name + "_LINKS_AND_FRAGMENTS",
      validateLinks(page.absolute, page.html),
      "Every local link and fragment resolves.",
    );
    check(
      page.name + "_NO_BLANK_TARGET_RISK",
      !/target="_blank"/i.test(page.html) ||
        !/<a\b(?=[^>]*target="_blank")(?![^>]*rel="[^"]*noopener)[^>]*>/i.test(page.html),
      "Any new-window link would require noopener.",
    );
  }

  const home = pages[0].html;
  const project = pages[1].html;
  const notFound = pages[2].html;
  const combinedHtml = pages.map((page) => page.html).join("\n");

  check(
    "HOME_ROLE_LED",
    home.includes("Technical Consultant · Systems Analyst · Business Systems Analyst") &&
      home.includes("I turn ambiguous workflows into"),
    "Homepage remains role-led.",
  );
  check(
    "HOME_GITHUB_PROFILE",
    home.includes('<a href="' + profileUrl + '">GitHub profile</a>'),
    "Homepage exposes one discreet GitHub profile route.",
  );
  check(
    "PROJECT_LINKS",
    project.includes('href="' + repositoryUrl + '"') &&
      project.includes('href="' + profileUrl + '"'),
    "Case study links to the exact repository and profile.",
  );
  check(
    "PROJECT_OWNER_WORDING",
    project.includes("<h1 id=\"project-title\">Workflow Intake Analysis Demo</h1>") &&
      content.why_built.every((paragraph) => project.includes(paragraph)) &&
      project.includes(content.human_judgment) &&
      project.includes("Separate validated and review-required records") &&
      project.includes("Preserve raw and normalized values together"),
    "Project title, why-built passages, judgment, and decisions remain exact.",
  );
  check(
    "PROJECT_HUMAN_LED_AI_USE",
    count(project, /id="ai-use"/g) === 1 &&
      project.includes("defined the goals and business rules") &&
      project.includes("made the final decisions"),
    "One human-directed AI-use section.",
  );
  check(
    "PROJECT_ONE_SCOPE_SECTION",
    count(project, /<section[^>]+id="scope"/g) === 1 &&
      content.scope.every((paragraph) => project.includes(paragraph)),
    "One concise scope section.",
  );
  check(
    "NO_VISIBLE_RELEASE_MECHANICS",
    !/(?:releases\/tag|v1\.0\.0|verified github release|released on github|version 1\.0\.0|read the v1\.0\.0 release)/i.test(
      combinedHtml,
    ),
    "Employer-facing routes omit project and site release mechanics.",
  );
  check(
    "PROJECT_CLAIM_BOUNDARY",
    /synthetic data/i.test(project) &&
      project.includes("not business-impact claims") &&
      !/\b(?:saved|increased|reduced costs?|improved revenue|customer adoption|enterprise deployment)\b/i.test(
        combinedHtml,
      ),
    "Synthetic scope is explicit and unsupported outcomes are absent.",
  );
  const educationSection =
    home.match(/<section\s+class="section section-tinted"\s+id="education"[\s\S]*?<\/section>/i)?.[0] ||
    "";
  check(
    "EDUCATION_RENDERED_EXACT",
    educationSection.includes('<h2 id="education-title">Education &amp; Technical Training</h2>') &&
      educationSection.includes(exactEducationContext) &&
      exactEducationItems.every(
        (item) =>
          educationSection.includes("<h3>" + item.institution + "</h3>") &&
          educationSection.includes("<p>" + item.detail + "</p>"),
      ),
    "The approved education heading, context, institutions, and exact facts are rendered.",
  );
  check(
    "EDUCATION_STRUCTURE",
    count(educationSection, /<article\b/gi) === 3 &&
      count(educationSection, /<h3\b/gi) === 3 &&
      count(educationSection, /class="education-featured"/gi) === 1 &&
      educationSection.indexOf("Front Range Community College") <
        educationSection.indexOf("University of Denver") &&
      educationSection.indexOf("University of Denver") <
        educationSection.indexOf("Additional coursework"),
    "Three ordered education records render, with technical training emphasized once.",
  );
  check(
    "EDUCATION_NO_CYBER_PIVOT_OR_INFERRED_CURRICULUM",
    count(educationSection, /Cybersecurity/gi) === 1 &&
      !/\b(?:SOC|security operations|networking|Linux|cloud|penetration testing|incident response)\b/i.test(
        educationSection,
      ),
    "The credential supports the broader technical story without inferred curriculum or cyber-specialist positioning.",
  );
  check(
    "NOT_FOUND_USEFUL",
    notFound.includes("404 · Page not found") &&
      notFound.includes('href="index.html"') &&
      notFound.includes('href="projects/workflow-intake-analysis.html"'),
    "404 page offers two local recovery routes.",
  );

  check(
    "ROBOTS_EXACT",
    robots ===
      "User-agent: *\nAllow: /\n\nSitemap: {{SITE_BASE_URL}}/sitemap.xml\n" &&
      readText(join(distRoot, "robots.txt")).replaceAll("\r\n", "\n") ===
        "User-agent: *\nAllow: /\n\nSitemap: " + siteOrigin + "/sitemap.xml\n",
    "robots.txt permits indexing and names the exact sitemap.",
  );
  check(
    "SITEMAP_XML",
    sitemap.includes("{{SITE_BASE_URL}}/") &&
      sitemap.includes("{{SITE_BASE_URL}}/projects/workflow-intake-analysis.html") &&
      (() => {
        const builtSitemap = readText(join(distRoot, "sitemap.xml"));
        return (
          builtSitemap.startsWith('<?xml version="1.0" encoding="UTF-8"?>') &&
          builtSitemap.includes('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">') &&
          count(builtSitemap, /<loc>/g) === 2 &&
          builtSitemap.includes("<loc>" + homeUrl + "</loc>") &&
          builtSitemap.includes("<loc>" + projectUrl + "</loc>") &&
          !builtSitemap.includes(notFoundUrl)
        );
      })(),
    "Sitemap contains only the home and case-study routes.",
  );
  check("NOJEKYLL_PRESENT", noJekyll.toString("utf8").trim() === "", ".nojekyll is empty.");
  check(
    "NO_CNAME",
    !existsSync(join(sourceRoot, "CNAME")) && !builtPaths.some((path) => /(^|\/)CNAME$/i.test(path)),
    "No custom-domain file exists.",
  );
  check(
    "FAVICON_LOCAL_SVG",
    favicon.includes('<svg xmlns="http://www.w3.org/2000/svg"') &&
      favicon.includes('viewBox="0 0 64 64"') &&
      !/https?:\/\/(?!www\.w3\.org)/i.test(favicon),
    "Favicon is a self-contained SVG.",
  );
  const dimensions = pngDimensions(socialBytes);
  check(
    "SOCIAL_IMAGE_PNG",
    dimensions.width === 1200 && dimensions.height === 630 && socialBytes.length > 10_000,
    "Social image is a substantive 1200x630 PNG.",
  );

  check(
    "CSS_FOCUS_VISIBLE",
    css.includes(":focus-visible") &&
      css.includes("outline: 3px solid var(--focus)") &&
      css.includes(".skip-link:focus"),
    "Visible focus and skip-link treatments are defined.",
  );
  check(
    "CSS_TOUCH_TARGETS",
    css.includes("min-height: 2.75rem") && css.includes("min-height: 3.15rem"),
    "Navigation and primary controls have substantial minimum heights.",
  );
  check(
    "CSS_RESPONSIVE",
    ["@media (max-width: 58rem)", "@media (max-width: 42rem)", "@media (max-width: 28rem)"].every(
      (value) => css.includes(value),
    ),
    "Desktop, tablet, mobile, and narrow-mobile adaptations exist.",
  );
  check(
    "CSS_REDUCED_MOTION",
    css.includes("@media (prefers-reduced-motion: reduce)") &&
      css.includes("animation-duration: 0.01ms !important"),
    "Reduced-motion users receive effectively static animation.",
  );
  check(
    "CSS_FORCED_COLORS",
    css.includes("@media (forced-colors: active)"),
    "Forced-colors adaptation exists.",
  );

  const contrastPairs = [
    ["INK_ON_PAPER", "#17211c", "#f6f7f3", 4.5],
    ["SOFT_ON_PAPER", "#45534b", "#f6f7f3", 4.5],
    ["ACCENT_ON_PAPER", "#205c4f", "#f6f7f3", 4.5],
    ["WHITE_ON_DEEP", "#ffffff", "#173f36", 4.5],
    ["SIGNAL_ON_SIGNAL_SOFT", "#8a4b18", "#fff0df", 4.5],
    ["FOCUS_ON_PAPER", "#9b4a0a", "#f6f7f3", 3],
  ];
  for (const [id, foreground, background, threshold] of contrastPairs) {
    const ratio = contrastRatio(foreground, background);
    check(
      "CONTRAST_" + id,
      ratio >= threshold,
      foreground + " on " + background + " = " + ratio.toFixed(2) + ":1",
    );
  }

  const readerFacing = [
    combinedHtml,
    JSON.stringify(content),
    JSON.stringify(educationContent),
    readme,
    robots,
    sitemap,
  ].join("\n");
  check(
    "PRIVACY_NO_LOCAL_PATHS",
    !/(?:^|[^A-Za-z])(?:[A-Za-z]:[\\/]|file:\/\/|\\\\Users\\\\|Master_Workspace|___Temp_Folders)/i.test(
      readerFacing,
    ),
    "No local or absolute filesystem paths.",
  );
  check(
    "PRIVACY_NO_DIRECT_CONTACT",
    !/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(readerFacing) &&
      !/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}/.test(readerFacing) &&
      !/\b(?:mailto|tel):/i.test(readerFacing),
    "No email, phone number, mailto, or tel route.",
  );
  check(
    "PRIVACY_NO_INTERNAL_CONTROLS",
    !/\b(?:PORT-000\d|coordinator|governance|authority manifest|accepted package|owner response|review package)\b/i.test(
      readerFacing,
    ),
    "No internal project-control language.",
  );
  check(
    "PUBLIC_NO_HOLD_LANGUAGE",
    !/\b(?:private site|private-preview|publication pending|release candidate|candidate branch|under review)\b/i.test(
      readerFacing,
    ),
    "No preview, candidate, pending, or held-publication wording.",
  );
  check(
    "PUBLIC_NO_INDEX_BLOCK",
    !/\b(?:noindex|nofollow|noarchive)\b/i.test(readerFacing),
    "No indexing block appears in reader-facing files.",
  );
  check(
    "PUBLIC_NO_TRACKING",
    !/\b(?:google-analytics|googletagmanager|gtag\(|segment\.com|mixpanel|hotjar|posthog|facebook pixel)\b/i.test(
      readerFacing,
    ),
    "No analytics or tracker reference.",
  );
  check(
    "PUBLIC_NO_PLACEHOLDER_DOMAIN",
    !/(?:example\.invalid|localhost|127\.0\.0\.1)/i.test(readerFacing),
    "No fake or local domain appears in public content.",
  );
  check(
    "PUBLIC_NO_SECONDARY_PROJECT",
    !/\bPORT-000[23]\b/i.test(readerFacing),
    "No unbuilt secondary project is presented.",
  );

  check(
    "WORKFLOW_TRIGGERS",
    /^\s*pull_request:\s*$/m.test(workflow) &&
      /^\s*push:\s*$/m.test(workflow) &&
      /branches:\s*\n\s*-\s*main/m.test(workflow) &&
      !/pull_request_target:/i.test(workflow),
    "Pull requests validate and main pushes run; pull_request_target is absent.",
  );
  check(
    "WORKFLOW_NODE",
    workflow.includes('node-version: "24.18.1"') &&
      workflow.includes("package-manager-cache: false") &&
      workflow.includes("run: npm run validate"),
    "Workflow uses the reviewed Node runtime and exact validation command.",
  );
  check(
    "WORKFLOW_DEPLOY_MAIN_ONLY",
    count(
      workflow,
      /if: github\.event_name == 'push' && github\.ref == 'refs\/heads\/main'/g,
    ) === 3,
    "Configure, upload, and deploy are limited to pushes to main.",
  );
  check(
    "WORKFLOW_ARTIFACT",
    workflow.includes("path: dist") &&
      workflow.includes("include-hidden-files: true") &&
      workflow.includes("needs: validate"),
    "The exact dist tree, including .nojekyll, deploys after validation.",
  );
  check(
    "WORKFLOW_LEAST_PRIVILEGE",
    workflow.includes("permissions:\n  contents: read") &&
      workflow.includes("pages: read") &&
      workflow.includes("pages: write") &&
      workflow.includes("id-token: write") &&
      !/contents:\s*write/i.test(workflow),
    "Read-only source permission and scoped Pages/OIDC permissions.",
  );
  check(
    "WORKFLOW_ENVIRONMENT",
    workflow.includes("name: github-pages") &&
      workflow.includes("steps.deployment.outputs.page_url") &&
      workflow.includes("group: github-pages") &&
      workflow.includes("cancel-in-progress: false"),
    "GitHub Pages environment and non-cancelling deployment concurrency.",
  );
  check(
    "WORKFLOW_NO_SECRETS",
    !workflow.includes("secrets.") && !/password|api[_-]?key|access[_-]?token/i.test(workflow),
    "No explicit secret or credential input.",
  );
  check(
    "WORKFLOW_ACTION_COUNT",
    count(workflow, /\buses:\s*[^\s]+/g) === actionPins.length,
    "Exactly five official actions are used.",
  );
  for (const pin of actionPins) {
    check(
      "WORKFLOW_PIN_" + safeId(pin.name),
      workflow.includes("uses: " + pin.name + "@" + pin.sha) &&
        workflow.includes("# " + pin.version + "; reviewed 2026-08-13") &&
        readme.includes(pin.name) &&
        readme.includes(pin.version) &&
        readme.includes(pin.sha) &&
        !workflow.includes("uses: " + pin.name + "@" + pin.version),
      pin.name + " " + pin.version + " is recorded and pinned to " + pin.sha + ".",
    );
  }

  const inputManifest = publicInputPaths
    .filter((path) => existsSync(join(projectRoot, ...path.split("/"))))
    .map((path) => {
      const bytes = readFile(join(projectRoot, ...path.split("/")));
      return { relative_path: path, size_bytes: bytes.length, sha256: sha256(bytes) };
    });
  const failed = checks.filter((item) => item.result === "FAIL");
  const report = {
    schema_version: "1.0.0",
    validator: "StandalonePublicGitHubPagesValidator",
    result: failed.length === 0 ? "PASS" : "FAIL",
    check_count: checks.length,
    passed_count: checks.length - failed.length,
    failed_count: failed.length,
    public_input_count: inputManifest.length,
    static_source_count: staticPaths.length,
    built_file_count: builtPaths.length,
    site_origin: siteOrigin,
    public_inputs: inputManifest,
    checks,
  };

  if (writeReport) {
    mkdirSync(dirname(reportPath), { recursive: true });
    writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  }
  return report;
}

function readText(path) {
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8");
}

function readFile(path) {
  if (!existsSync(path)) return Buffer.alloc(0);
  return readFileSync(path);
}

function readJson(path) {
  const text = readText(path);
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

function listFiles(root) {
  if (!existsSync(root)) return [];
  const result = [];
  const walk = (directory) => {
    for (const name of readdirSync(directory)) {
      const absolute = join(directory, name);
      if (statSync(absolute).isDirectory()) walk(absolute);
      else result.push(absolute);
    }
  };
  walk(root);
  return result.sort();
}

function validateLinks(sourcePath, html) {
  const idsByFile = new Map();
  const builtSourcePath = sourcePath.startsWith(distRoot)
    ? sourcePath
    : join(distRoot, relative(sourceRoot, sourcePath));
  const idsFor = (path) => {
    if (!idsByFile.has(path)) {
      idsByFile.set(path, new Set(allMatches(readText(path), /\bid="([^"]+)"/gi)));
    }
    return idsByFile.get(path);
  };

  for (const href of allMatches(html, /\bhref="([^"]+)"/gi)) {
    if (/^https:\/\//i.test(href)) {
      if (!allowedHttpsUrls.has(href)) return false;
      continue;
    }
    if (/^(?:http:|mailto:|tel:|javascript:|data:)/i.test(href)) return false;

    const [pathPart, fragment] = href.split("#", 2);
    const target = pathPart
      ? pathPart.startsWith("/")
        ? resolve(distRoot, pathPart.replace(/^\/+/, ""))
        : resolve(dirname(builtSourcePath), pathPart)
      : builtSourcePath;
    if (
      target !== distRoot &&
      !target.startsWith(distRoot + "\\") &&
      !target.startsWith(distRoot + "/")
    ) {
      return false;
    }
    if (!existsSync(target)) return false;
    if (fragment && !idsFor(target).has(fragment)) return false;
  }
  return true;
}

function allMatches(text, expression) {
  return [...text.matchAll(expression)].map((match) => match[1]);
}

function count(text, expression) {
  return [...text.matchAll(expression)].length;
}

function equalSets(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    [...left].sort().every((value, index) => value === [...right].sort()[index])
  );
}

function equalArrays(left, right) {
  return (
    Array.isArray(left) &&
    Array.isArray(right) &&
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function pngDimensions(bytes) {
  const signature = "89504E470D0A1A0A";
  if (bytes.length < 24 || bytes.subarray(0, 8).toString("hex").toUpperCase() !== signature) {
    return { width: 0, height: 0 };
  }
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}

function safeId(value) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function toPosix(value) {
  return value.replaceAll("\\", "/");
}

function contrastRatio(foreground, background) {
  const luminance = (hex) => {
    const channels = [1, 3, 5].map(
      (index) => Number.parseInt(hex.slice(index, index + 2), 16) / 255,
    );
    const adjusted = channels.map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
    return 0.2126 * adjusted[0] + 0.7152 * adjusted[1] + 0.0722 * adjusted[2];
  };
  const first = luminance(foreground);
  const second = luminance(background);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
