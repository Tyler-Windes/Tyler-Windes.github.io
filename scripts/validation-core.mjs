import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, posix, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const SITE_ORIGIN = "https://tyler-windes.com";
const PORT1_REPOSITORY = "https://github.com/Tyler-Windes/workflow-intake-analysis-demo";
const PORT2_REPOSITORY = "https://github.com/Tyler-Windes/implementation-readiness-support-transition";
const PORT3_REPOSITORY = "https://github.com/Tyler-Windes/saas-integration-reliability-support-troubleshooting";
const PORT2_TOKEN = "{{PORT0002_REPOSITORY_URL}}";
const PORT3_TOKEN = "{{PORT0003_REPOSITORY_URL}}";
const PROFILE_URL = "https://github.com/Tyler-Windes";
const LINKEDIN_URL = "https://www.linkedin.com/in/tylerwindes";

const ROUTES = [
  { path: "index.html", url: `${SITE_ORIGIN}/`, type: "website" },
  {
    path: "projects/workflow-intake-analysis.html",
    url: `${SITE_ORIGIN}/projects/workflow-intake-analysis.html`,
    type: "article",
  },
  {
    path: "projects/implementation-readiness-support-transition.html",
    url: `${SITE_ORIGIN}/projects/implementation-readiness-support-transition.html`,
    type: "article",
  },
  {
    path: "projects/saas-integration-reliability-support-troubleshooting.html",
    url: `${SITE_ORIGIN}/projects/saas-integration-reliability-support-troubleshooting.html`,
    type: "article",
  },
  { path: "404.html", url: `${SITE_ORIGIN}/404.html`, type: "website" },
];

const EXPECTED_STATIC_PATHS = [
  ".nojekyll",
  "404.html",
  "assets/favicon.svg",
  "assets/social-preview-1200x630.png",
  "index.html",
  "projects/implementation-readiness-support-transition.html",
  "projects/saas-integration-reliability-support-troubleshooting.html",
  "projects/workflow-intake-analysis.html",
  "robots.txt",
  "sitemap.xml",
  "styles.css",
];

const PUBLIC_INPUT_PATHS = [
  ".gitattributes",
  ".github/workflows/pages.yml",
  ".gitignore",
  ".nvmrc",
  "LICENSE",
  "README.md",
  "assets/favicon.svg",
  "assets/social-preview-1200x630.png",
  "content/projects/implementation-readiness-support-transition.json",
  "content/projects/saas-integration-reliability-support-troubleshooting.json",
  "content/projects/workflow-intake-analysis.json",
  "content/schemas/public-education-content.schema.json",
  "content/schemas/public-project-content.schema.json",
  "content/site/education.json",
  "content/site/site-config.json",
  "package.json",
  "scripts/build.mjs",
  "scripts/serve.mjs",
  "scripts/validate-public.mjs",
  "scripts/validate-publication-preflight.mjs",
  "scripts/validation-core.mjs",
  "src/.nojekyll",
  "src/404.html",
  "src/index.html",
  "src/projects/implementation-readiness-support-transition.html",
  "src/projects/saas-integration-reliability-support-troubleshooting.html",
  "src/projects/workflow-intake-analysis.html",
  "src/robots.txt",
  "src/sitemap.xml",
  "src/styles.css",
];

const FORBIDDEN_REVIEW_PHRASES = [
  "Private site preview",
  "Private publication candidate",
  "Private candidate",
  "Read candidate case study",
  "Repository link withheld",
  "A local repository candidate exists",
  "not yet public",
  "not authorized for public",
  "PrivatePublicationCandidateNotYetAuthorized",
  "LocalCandidateWithheldUntilPublicationAuthorization",
  "public-project-candidate-content",
  "noindex",
  "nofollow",
  "noarchive",
  "link-withheld",
  "candidate-link-note",
];

export function runPublicationValidation({ allowRepositoryTokens = false } = {}) {
  const checks = [];
  const check = (id, condition, detail) => {
    checks.push({ id, result: condition ? "PASS" : "FAIL", detail });
  };
  const absolute = (path) => join(projectRoot, ...path.split("/"));
  const text = (path) => readFileSync(absolute(path), "utf8");
  const json = (path) => JSON.parse(text(path));

  for (const path of PUBLIC_INPUT_PATHS) {
    check(`INPUT_${safeId(path)}`, existsSync(absolute(path)), path);
  }
  check("INPUT_COUNT_EXACT", PUBLIC_INPUT_PATHS.length === 30, "Thirty explicit public inputs.");
  check(
    "CANDIDATE_AUTHORITIES_REMOVED",
    !existsSync(absolute("content/schemas/public-project-candidate-content.schema.json")) &&
      !existsSync(absolute("scripts/validate-consolidated-candidate.mjs")),
    "No parallel candidate schema or candidate validator remains active.",
  );

  const packageJson = json("package.json");
  const siteConfig = json("content/site/site-config.json");
  const port1 = json("content/projects/workflow-intake-analysis.json");
  const port2 = json("content/projects/implementation-readiness-support-transition.json");
  const port3 = json("content/projects/saas-integration-reliability-support-troubleshooting.json");
  const schema = json("content/schemas/public-project-content.schema.json");
  const manifest = json("validation/build-manifest.json");

  check(
    "PACKAGE_WORKFLOW",
    packageJson.private === true &&
      packageJson.engines?.node === ">=24 <25" &&
      packageJson.scripts?.build === "node scripts/build.mjs" &&
      packageJson.scripts?.validate === "npm run validate:public" &&
      packageJson.scripts?.["validate:public"] === "npm run build && node scripts/validate-public.mjs",
    "Node 24, deterministic build, preflight default, and fail-closed final validation are configured.",
  );
  check("SITE_ORIGIN", siteConfig.site_base_url === SITE_ORIGIN, "Authorized custom-domain origin.");
  check(
    "ONE_PUBLISHED_SCHEMA",
    schema.$id === "urn:tyler-windes:portfolio:schemas:public-project-content:2.0.0" &&
      schema.oneOf?.length === 2 &&
      schema.$defs?.workflow_analysis_v1 &&
      schema.$defs?.public_case_study_v2,
    "One closed published-project schema preserves PORT-0001 and governs PORT-0002/3.",
  );
  check(
    "PORT1_CONTENT_PRESERVED",
    sha256(readFileSync(absolute("content/projects/workflow-intake-analysis.json"))) ===
      "6599D5B7FD5ADBEE1A97681BB5ABE4217D34533867C0E7B8A41F4753D9855D00" &&
      port1.title === "Workflow Intake Analysis Demo" &&
      port1.links?.repository_url === PORT1_REPOSITORY,
    "The accepted PORT-0001 content record is byte-exact.",
  );

  const expectedRepositories = allowRepositoryTokens
    ? { "PORT-0002": PORT2_TOKEN, "PORT-0003": PORT3_TOKEN }
    : { "PORT-0002": PORT2_REPOSITORY, "PORT-0003": PORT3_REPOSITORY };
  const expectedRecords = [
    [
      port2,
      {
        id: "PORT-0002",
        title: "Implementation Readiness & Support Transition",
        route: "projects/implementation-readiness-support-transition.html",
        repository: "implementation-readiness-support-transition",
      },
    ],
    [
      port3,
      {
        id: "PORT-0003",
        title: "SaaS Integration Reliability & Support Troubleshooting",
        route: "projects/saas-integration-reliability-support-troubleshooting.html",
        repository: "saas-integration-reliability-support-troubleshooting",
      },
    ],
  ];
  for (const [record, expected] of expectedRecords) {
    const keys = Object.keys(record).sort();
    const expectedKeys = [
      "$schema",
      "capabilities",
      "data_class",
      "differentiator",
      "evidence",
      "judgment",
      "links",
      "problem",
      "project_id",
      "publication_state",
      "schema_version",
      "scope",
      "subtitle",
      "title",
    ].sort();
    check(`CONTENT_KEYS_${expected.id}`, equalArrays(keys, expectedKeys), `${expected.id} has only the reviewed published fields.`);
    check(
      `CONTENT_IDENTITY_${expected.id}`,
      record.$schema === "../schemas/public-project-content.schema.json" &&
        record.schema_version === "2.0.0" &&
        record.project_id === expected.id &&
        record.title === expected.title &&
        record.data_class === "Synthetic" &&
        record.publication_state === "PortfolioApproved",
      `${expected.id} published content identity.`,
    );
    check(
      `CONTENT_LINKS_${expected.id}`,
      equalArrays(
        Object.keys(record.links).sort(),
        ["case_study_path", "repository_name", "repository_state", "repository_url"].sort(),
      ) &&
        record.links.case_study_path === expected.route &&
        record.links.repository_name === expected.repository &&
        record.links.repository_url === expectedRepositories[expected.id] &&
        record.links.repository_state === "ExistingPublicRepositoryWithVerifiedV1Release",
      `${expected.id} route and repository fields match the ${allowRepositoryTokens ? "bounded URL token" : "verified final URL"} mode.`,
    );
    check(
      `CONTENT_SUBSTANCE_${expected.id}`,
      record.subtitle.length >= 60 &&
        record.problem.length >= 100 &&
        record.judgment.length >= 100 &&
        record.evidence.length >= 3 &&
        record.capabilities.length >= 4 &&
        record.scope.length >= 2,
      `${expected.id} retains reviewed problem, judgment, evidence, capabilities, and scope.`,
    );
    check(
      `CONTENT_BOUNDARY_${expected.id}`,
      /synthetic/i.test(JSON.stringify(record.scope)) &&
        /(not evidence|no real customer|no live platform)/i.test(JSON.stringify(record.scope)),
      `${expected.id} retains a clear synthetic and non-production boundary.`,
    );
  }

  const port3All = JSON.stringify(port3);
  check(
    "PORT3_N8N_BOUNDARY",
    /n8n runtime execution was deferred/i.test(port3All) &&
      /rather than evidence of n8n proficiency/i.test(port3All),
    "The n8n-deferred/no-proficiency ceiling is exact.",
  );
  check(
    "PORT2_READINESS_PROOF",
    /Eight final synthetic UAT outcomes/.test(JSON.stringify(port2)) &&
      /Six explicit transition smoke checks/.test(JSON.stringify(port2)) &&
      /passing retests/.test(JSON.stringify(port2)),
    "PORT-0002 retains bounded UAT, retest, smoke-check, rollback, and handoff proof.",
  );
  check(
    "PORT3_RELIABILITY_PROOF",
    /Twelve named local scenarios/.test(port3All) &&
      /429/.test(port3All) &&
      /503/.test(port3All) &&
      /dead-letter replay/.test(port3All) &&
      /reconciliation/.test(port3All),
    "PORT-0003 retains mapping, retry, dead-letter, replay, and reconciliation proof.",
  );

  const activeTextPaths = [
    ...walk(absolute("src")).filter(isTextPath),
    ...walk(absolute("content/projects")).filter(isTextPath),
    absolute("content/schemas/public-project-content.schema.json"),
    ...walk(absolute("dist")).filter(isTextPath),
  ];
  const activeText = activeTextPaths.map((path) => readFileSync(path, "utf8")).join("\n");
  const residue = FORBIDDEN_REVIEW_PHRASES.filter((phrase) =>
    activeText.toLowerCase().includes(phrase.toLowerCase()),
  );
  check(
    "ZERO_REVIEW_STAGE_RESIDUE",
    residue.length === 0,
    residue.length ? residue.join("; ") : "No active reader-facing review-stage residue.",
  );
  check(
    "ZERO_LOCAL_PATH_RESIDUE",
    !/[A-Za-z]:\\\\|file:\/\/|\/Users\/|\/home\//i.test(activeText),
    "No absolute local filesystem path in public content or output.",
  );
  const renderedText = [
    ...walk(absolute("src")).filter(isTextPath),
    ...walk(absolute("dist")).filter(isTextPath),
  ].map((path) => readFileSync(path, "utf8")).join("\n");
  check(
    "NO_CONTROLLED_IDS_IN_RENDERED_SITE",
    !/PORT-000[123]/.test(renderedText),
    "Controlled project IDs remain structured metadata only.",
  );

  const tokenCounts = {
    port2Content: occurrences(text("content/projects/implementation-readiness-support-transition.json"), PORT2_TOKEN),
    port3Content: occurrences(text("content/projects/saas-integration-reliability-support-troubleshooting.json"), PORT3_TOKEN),
    port2Source: occurrences(text("src/index.html") + text("src/projects/implementation-readiness-support-transition.html"), PORT2_TOKEN),
    port3Source: occurrences(text("src/index.html") + text("src/projects/saas-integration-reliability-support-troubleshooting.html"), PORT3_TOKEN),
    port2Dist: occurrences(text("dist/index.html") + text("dist/projects/implementation-readiness-support-transition.html"), PORT2_TOKEN),
    port3Dist: occurrences(text("dist/index.html") + text("dist/projects/saas-integration-reliability-support-troubleshooting.html"), PORT3_TOKEN),
  };
  const exactPreflightTokens =
    tokenCounts.port2Content === 1 && tokenCounts.port3Content === 1 &&
    tokenCounts.port2Source === 2 && tokenCounts.port3Source === 2 &&
    tokenCounts.port2Dist === 2 && tokenCounts.port3Dist === 2;
  const noRepositoryTokens = Object.values(tokenCounts).every((count) => count === 0);
  check(
    "REPOSITORY_URL_GATE",
    allowRepositoryTokens ? exactPreflightTokens : noRepositoryTokens,
    allowRepositoryTokens
      ? "Each bounded URL token occurs once in content and twice across source/built home-plus-project surfaces."
      : "No repository URL token remains after independently verified URL insertion.",
  );
  const sourceTokens = uniqueTokens(
    walk(absolute("src")).filter(isTextPath).map((path) => readFileSync(path, "utf8")).join("\n"),
  );
  const contentTokens = uniqueTokens(
    walk(absolute("content/projects")).map((path) => readFileSync(path, "utf8")).join("\n"),
  );
  const distTokens = uniqueTokens(
    walk(absolute("dist")).filter(isTextPath).map((path) => readFileSync(path, "utf8")).join("\n"),
  );
  check(
    "ONLY_AUTHORIZED_TOKENS",
    allowRepositoryTokens
      ? equalArrays(sourceTokens, [PORT2_TOKEN, PORT3_TOKEN, "{{SITE_BASE_URL}}"].sort()) &&
          equalArrays(contentTokens, [PORT2_TOKEN, PORT3_TOKEN].sort()) &&
          equalArrays(distTokens, [PORT2_TOKEN, PORT3_TOKEN].sort())
      : equalArrays(sourceTokens, ["{{SITE_BASE_URL}}"] ) && contentTokens.length === 0 && distTokens.length === 0,
    `source=${sourceTokens.join(",") || "none"}; content=${contentTokens.join(",") || "none"}; dist=${distTokens.join(",") || "none"}`,
  );

  const staticPaths = [
    ...walk(absolute("src")).map((path) => relative(absolute("src"), path).replaceAll("\\", "/")),
    ...walk(absolute("assets")).map((path) => `assets/${relative(absolute("assets"), path).replaceAll("\\", "/")}`),
  ].sort();
  const builtPaths = walk(absolute("dist"))
    .map((path) => relative(absolute("dist"), path).replaceAll("\\", "/"))
    .sort();
  check("STATIC_SOURCE_SET", equalArrays(staticPaths, EXPECTED_STATIC_PATHS), "Eleven exact deployable source files.");
  check("BUILD_FILE_SET", equalArrays(builtPaths, EXPECTED_STATIC_PATHS), "Built tree contains the same eleven files.");
  check(
    "BUILD_MANIFEST_TOPOLOGY",
    manifest.build_mode === "DeterministicThreeProjectSiteBaseUrlGeneration" &&
      manifest.site_base_url === SITE_ORIGIN &&
      manifest.file_count === 11 &&
      equalArrays((manifest.entries || []).map((item) => item.relative_path).sort(), EXPECTED_STATIC_PATHS),
    "Build manifest records the exact deterministic topology.",
  );
  const manifestByPath = new Map((manifest.entries || []).map((item) => [item.relative_path, item]));
  const generatedHtml = new Set(ROUTES.map((route) => route.path));
  for (const path of EXPECTED_STATIC_PATHS) {
    const sourcePath = path.startsWith("assets/") ? absolute(path) : absolute(`src/${path}`);
    const sourceBytes = readFileSync(sourcePath);
    let expectedBytes = sourceBytes;
    if (generatedHtml.has(path)) {
      expectedBytes = Buffer.from(sourceBytes.toString("utf8").replaceAll("{{SITE_BASE_URL}}", SITE_ORIGIN), "utf8");
    } else if (path === "robots.txt") {
      expectedBytes = Buffer.from(`User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`, "utf8");
    } else if (path === "sitemap.xml") {
      expectedBytes = Buffer.from(renderSitemap(), "utf8");
    }
    const builtBytes = readFileSync(absolute(`dist/${path}`));
    const entry = manifestByPath.get(path);
    check(`BUILD_PARITY_${safeId(path)}`, expectedBytes.equals(builtBytes), path);
    check(
      `BUILD_HASH_${safeId(path)}`,
      entry?.size_bytes === builtBytes.length && entry?.sha256 === sha256(builtBytes),
      `${path} matches its build-manifest identity.`,
    );
  }

  for (const route of ROUTES) {
    const html = text(`dist/${route.path}`);
    const ids = [...html.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]);
    check(
      `PAGE_METADATA_${safeId(route.path)}`,
      /<html lang="en">/.test(html) &&
        /<meta name="viewport"/.test(html) &&
        /<meta name="robots" content="index, follow">/.test(html) &&
        html.includes(`<link rel="canonical" href="${route.url}">`) &&
        html.includes(`<meta property="og:type" content="${route.type}">`) &&
        html.includes(`<meta property="og:url" content="${route.url}">`) &&
        html.includes(`<meta property="og:image" content="${SITE_ORIGIN}/assets/social-preview-1200x630.png">`) &&
        /<meta name="twitter:card" content="summary_large_image">/.test(html) &&
        /<link rel="icon"/.test(html),
      `${route.path} is indexed and has canonical/Open Graph/Twitter/favicon metadata.`,
    );
    check(
      `PAGE_ACCESSIBILITY_${safeId(route.path)}`,
      occurrences(html, "<h1") === 1 &&
        html.includes("Skip to main content") &&
        html.includes('id="main-content"') &&
        new Set(ids).size === ids.length,
      `${route.path} has one H1, a skip link, main target, and unique IDs.`,
    );
    validateLinks(route.path, html, allowRepositoryTokens, check);
  }

  const home = text("dist/index.html");
  const p1Page = text("dist/projects/workflow-intake-analysis.html");
  const p2Page = text("dist/projects/implementation-readiness-support-transition.html");
  const p3Page = text("dist/projects/saas-integration-reliability-support-troubleshooting.html");
  check(
    "HOME_THREE_PROJECTS",
    [
      "Workflow Intake Analysis Demo",
      "Implementation Readiness &amp; Support Transition",
      "SaaS Integration Reliability &amp; Support Troubleshooting",
    ].every((value) => home.includes(value)) &&
      occurrences(home, "Read case study") === 3 &&
      occurrences(home, "View repository") === 3,
    "Homepage exposes three distinct case studies and repository paths.",
  );
  check(
    "ALL_PROJECT_NAVIGATION",
    p1Page.includes("implementation-readiness-support-transition.html") &&
      p1Page.includes("saas-integration-reliability-support-troubleshooting.html") &&
      p2Page.includes("workflow-intake-analysis.html") &&
      p2Page.includes("saas-integration-reliability-support-troubleshooting.html") &&
      p3Page.includes("workflow-intake-analysis.html") &&
      p3Page.includes("implementation-readiness-support-transition.html"),
    "Each project page links to the other two projects.",
  );
  check(
    "PORT2_VISIBLE_BOUNDARY",
    /Modeled lifecycle, not a live transaction/.test(p2Page) &&
      /Eight synthetic UAT cases/.test(p2Page) &&
      /Passing retests/.test(p2Page) &&
      /six modeled smoke checks/i.test(p2Page) &&
      /rollback/i.test(p2Page) &&
      /support-transition thinking/i.test(p2Page),
    "PORT-0002 page keeps its lifecycle, readiness, retest, rollback, and handoff boundary.",
  );
  check(
    "PORT3_VISIBLE_BOUNDARY",
    /No external service or live endpoint/.test(p3Page) &&
      /Twelve scenarios/.test(p3Page) &&
      /Dead letter and replay/i.test(p3Page) &&
      /n8n execution was deferred/.test(p3Page) &&
      /does not establish n8n proficiency/.test(p3Page),
    "PORT-0003 page keeps executable evidence and the exact n8n ceiling.",
  );

  const robots = text("dist/robots.txt");
  const sitemap = text("dist/sitemap.xml");
  const sitemapUrls = ROUTES.filter((route) => route.path !== "404.html").map((route) => route.url);
  check(
    "ROBOTS_PUBLIC",
    robots === `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`,
    "Public crawl and sitemap declaration.",
  );
  check(
    "SITEMAP_FOUR_ROUTES",
    occurrences(sitemap, "<loc>") === 4 &&
      sitemapUrls.every((url) => sitemap.includes(`<loc>${url}</loc>`)),
    "Sitemap contains exactly the homepage and three project routes.",
  );
  const css = text("dist/styles.css");
  check(
    "CSS_ACCESSIBILITY",
    /:focus-visible/.test(css) &&
      /@media \(prefers-reduced-motion: reduce\)/.test(css) &&
      /@media \(forced-colors: active\)/.test(css) &&
      occurrences(css, "@media") >= 5,
    "Focus, reduced-motion, forced-colors, and responsive controls remain present.",
  );
  check(
    "NO_ACTIVE_CODE_SURFACE",
    !/<script\b/i.test(home + p1Page + p2Page + p3Page) &&
      !/<form\b/i.test(home + p1Page + p2Page + p3Page) &&
      !/(google-analytics|googletagmanager|segment\.com|hotjar|mixpanel)/i.test(activeText),
    "The site remains static, form-free, and analytics-free.",
  );

  const failed = checks.filter((item) => item.result === "FAIL");
  const result = failed.length === 0 ? "PASS" : "HOLD";
  const terminal = failed.length === 0
    ? allowRepositoryTokens
      ? "PASS_CONSOLIDATED_THREE_PROJECT_SITE_READY_FOR_VERIFIED_REPOSITORY_URLS"
      : "PASS_CONSOLIDATED_THREE_PROJECT_PUBLIC_SITE"
    : allowRepositoryTokens
      ? "HOLD_CONSOLIDATED_THREE_PROJECT_SITE_PREPARATION_FAILED"
      : "HOLD_CONSOLIDATED_THREE_PROJECT_PUBLIC_SITE_VALIDATION_FAILED";
  const report = {
    schema_version: "1.0.0",
    validator: "ConsolidatedThreeProjectStaticSiteValidator",
    mode: allowRepositoryTokens
      ? "PublicationPreparationWithTwoBoundedRepositoryUrlTokens"
      : "FinalVerifiedPublicUrlsRequired",
    result,
    terminal,
    check_count: checks.length,
    passed_count: checks.length - failed.length,
    failed_count: failed.length,
    site_base_url: SITE_ORIGIN,
    expected_repository_urls: [PORT2_REPOSITORY, PORT3_REPOSITORY],
    authorized_repository_url_tokens: allowRepositoryTokens ? [PORT2_TOKEN, PORT3_TOKEN] : [],
    deployable_file_count: EXPECTED_STATIC_PATHS.length,
    public_input_count: PUBLIC_INPUT_PATHS.length,
    input_manifest: PUBLIC_INPUT_PATHS.filter((path) => existsSync(absolute(path))).map((path) => {
      const bytes = readFileSync(absolute(path));
      return { relative_path: path, size_bytes: bytes.length, sha256: sha256(bytes) };
    }),
    checks,
  };
  const reportDirectory = absolute("validation/consolidated-three-project-publication");
  mkdirSync(reportDirectory, { recursive: true });
  const reportName = allowRepositoryTokens ? "preflight-validation.json" : "public-validation.json";
  writeFileSync(join(reportDirectory, reportName), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return report;
}

function validateLinks(pagePath, html, allowRepositoryTokens, check) {
  const hrefs = [...html.matchAll(/\shref="([^"]+)"/g)].map((match) => match[1]);
  const allowedExternal = new Set([
    PORT1_REPOSITORY,
    PORT2_REPOSITORY,
    PORT3_REPOSITORY,
    PROFILE_URL,
    LINKEDIN_URL,
  ]);
  const idsByPath = new Map(
    ROUTES.map((route) => {
      const routeHtml = readFileSync(join(projectRoot, "dist", ...route.path.split("/")), "utf8");
      return [route.path, new Set([...routeHtml.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]))];
    }),
  );
  let valid = true;
  const failures = [];
  for (const href of hrefs) {
    if (href === PORT2_TOKEN || href === PORT3_TOKEN) {
      if (!allowRepositoryTokens) {
        valid = false;
        failures.push(`unresolved ${href}`);
      }
      continue;
    }
    if (href.startsWith("https://")) {
      const allowedCanonical = ROUTES.some((route) => route.url === href);
      const allowedSocial = href === `${SITE_ORIGIN}/assets/social-preview-1200x630.png`;
      if (!allowedExternal.has(href) && !allowedCanonical && !allowedSocial) {
        valid = false;
        failures.push(`unapproved external ${href}`);
      }
      continue;
    }
    if (/^(mailto:|tel:|javascript:|data:|file:)/i.test(href)) {
      valid = false;
      failures.push(`prohibited scheme ${href}`);
      continue;
    }
    const [targetPart, fragment] = href.split("#", 2);
    const targetPath = targetPart
      ? posix.normalize(posix.join(posix.dirname(pagePath), targetPart))
      : pagePath;
    if (!existsSync(join(projectRoot, "dist", ...targetPath.split("/")))) {
      valid = false;
      failures.push(`missing ${href}`);
      continue;
    }
    if (fragment && idsByPath.has(targetPath) && !idsByPath.get(targetPath).has(fragment)) {
      valid = false;
      failures.push(`missing fragment ${href}`);
    }
  }
  check(
    `LINKS_${safeId(pagePath)}`,
    valid,
    failures.length ? failures.join("; ") : `${hrefs.length} links resolve and are allowlisted.`,
  );
}

function renderSitemap() {
  const sitemapRoutes = ROUTES.filter((route) => route.path !== "404.html").map((route) => route.url);
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sitemapRoutes.flatMap((url) => ["  <url>", `    <loc>${url}</loc>`, "  </url>"]),
    "</urlset>",
    "",
  ].join("\n");
}

function walk(directory) {
  const files = [];
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) files.push(...walk(path));
    else files.push(path);
  }
  return files;
}

function isTextPath(path) {
  return /\.(?:css|html|json|md|mjs|txt|xml|yml)$/i.test(path) || path.endsWith(".nojekyll");
}

function uniqueTokens(value) {
  return [...new Set(value.match(/\{\{[A-Z0-9_]+\}\}/g) || [])].sort();
}

function occurrences(value, needle) {
  return value.split(needle).length - 1;
}

function equalArrays(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function safeId(value) {
  return value.toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_|_$/g, "");
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex").toUpperCase();
}
