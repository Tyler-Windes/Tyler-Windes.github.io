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
const IRW_ATLASSIAN_URL =
  "https://tyler-windes.atlassian.net/wiki/spaces/~7120203b004a0c07184b39860e66e497b78dd0/pages/426169";

const ROUTES = [
  { path: "index.html", canonical: `${SITE_ORIGIN}/`, type: "website" },
  { path: "irw/index.html", canonical: `${SITE_ORIGIN}/irw/`, type: "article" },
  {
    path: "projects/workflow-intake-analysis.html",
    canonical: `${SITE_ORIGIN}/projects/workflow-intake-analysis.html`,
    type: "article",
  },
  {
    path: "projects/implementation-readiness-support-transition.html",
    canonical: `${SITE_ORIGIN}/irw/`,
    type: "article",
    redirect: "../irw/",
  },
  {
    path: "projects/saas-integration-reliability-support-troubleshooting.html",
    canonical: `${SITE_ORIGIN}/projects/saas-integration-reliability-support-troubleshooting.html`,
    type: "article",
  },
  { path: "404.html", canonical: `${SITE_ORIGIN}/404.html`, type: "website" },
];

const SITEMAP_URLS = [
  `${SITE_ORIGIN}/`,
  `${SITE_ORIGIN}/irw/`,
  `${SITE_ORIGIN}/projects/workflow-intake-analysis.html`,
  `${SITE_ORIGIN}/projects/saas-integration-reliability-support-troubleshooting.html`,
];

const EXPECTED_STATIC_PATHS = [
  ".nojekyll",
  "404.html",
  "assets/favicon.svg",
  "assets/social-preview-1200x630.png",
  "index.html",
  "irw/index.html",
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
  "src/irw/index.html",
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
  check("INPUT_COUNT_EXACT", PUBLIC_INPUT_PATHS.length === 31, "Thirty-one explicit public inputs.");

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
    "Node 24, deterministic build, and fail-closed validation are configured.",
  );
  check("SITE_ORIGIN", siteConfig.site_base_url === SITE_ORIGIN, "Authorized custom-domain origin.");
  check(
    "ONE_PUBLISHED_SCHEMA",
    schema.$id === "urn:tyler-windes:portfolio:schemas:public-project-content:2.0.0" &&
      schema.oneOf?.length === 2 &&
      schema.$defs?.workflow_analysis_v1 &&
      schema.$defs?.public_case_study_v2,
    "One project-content schema governs the three published projects.",
  );
  check(
    "PORT1_CONTENT_PRESERVED",
    sha256(readFileSync(absolute("content/projects/workflow-intake-analysis.json"))) ===
      "6599D5B7FD5ADBEE1A97681BB5ABE4217D34533867C0E7B8A41F4753D9855D00" &&
      port1.title === "Workflow Intake Analysis Demo" &&
      port1.links?.repository_url === PORT1_REPOSITORY,
    "The accepted Workflow Intake Analysis content record is unchanged.",
  );

  const expectedRepositories = allowRepositoryTokens
    ? {
        "PORT-0002": new Set([PORT2_REPOSITORY, PORT2_TOKEN]),
        "PORT-0003": new Set([PORT3_REPOSITORY, PORT3_TOKEN]),
      }
    : {
        "PORT-0002": new Set([PORT2_REPOSITORY]),
        "PORT-0003": new Set([PORT3_REPOSITORY]),
      };
  const expectedRecords = [
    [
      port2,
      {
        id: "PORT-0002",
        title: "Implementation Readiness & Support Transition",
        route: "irw/index.html",
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
    check(
      `CONTENT_KEYS_${expected.id}`,
      equalArrays(Object.keys(record).sort(), expectedKeys),
      `${expected.id} has only the reviewed published fields.`,
    );
    check(
      `CONTENT_IDENTITY_${expected.id}`,
      record.$schema === "../schemas/public-project-content.schema.json" &&
        record.schema_version === "2.0.0" &&
        record.project_id === expected.id &&
        record.title === expected.title &&
        record.data_class === "Synthetic" &&
        record.publication_state === "PortfolioApproved",
      `${expected.id} identity and publication state are correct.`,
    );
    check(
      `CONTENT_LINKS_${expected.id}`,
      record.links.case_study_path === expected.route &&
        record.links.repository_name === expected.repository &&
        expectedRepositories[expected.id].has(record.links.repository_url) &&
        record.links.repository_state === "ExistingPublicRepositoryWithVerifiedV1Release",
      `${expected.id} route and repository identity are correct.`,
    );
    check(
      `CONTENT_SUBSTANCE_${expected.id}`,
      record.subtitle.length >= 60 &&
        record.problem.length >= 100 &&
        record.judgment.length >= 100 &&
        record.evidence.length >= 3 &&
        record.capabilities.length >= 4 &&
        record.scope.length >= 2,
      `${expected.id} contains substantive problem, judgment, evidence, capability, and scope fields.`,
    );
    check(
      `CONTENT_BOUNDARY_${expected.id}`,
      /synthetic|fictional/i.test(JSON.stringify(record.scope)) &&
        /not represent|not evidence|no real customer|no live platform/i.test(JSON.stringify(record.scope)),
      `${expected.id} keeps a clear fictional and non-production boundary.`,
    );
  }

  check(
    "PORT2_TWO_LAYER_MODEL",
    /platform-neutral/i.test(JSON.stringify(port2)) &&
      /Jira and Confluence implementation/i.test(JSON.stringify(port2)) &&
      /Eight final synthetic foundation outcomes/i.test(JSON.stringify(port2)) &&
      /ten final passing UAT cases/i.test(JSON.stringify(port2)) &&
      /v1.1 roadmap/i.test(JSON.stringify(port2)),
    "The readiness project distinguishes its platform-neutral foundation, Atlassian implementation, and v1.1 roadmap.",
  );
  const port3All = JSON.stringify(port3);
  check(
    "PORT3_N8N_BOUNDARY",
    /n8n runtime execution was deferred/i.test(port3All) &&
      /rather than evidence of n8n proficiency/i.test(port3All),
    "The integration project keeps the reviewed n8n boundary.",
  );
  check(
    "PORT3_RELIABILITY_PROOF",
    /Twelve named local scenarios/.test(port3All) &&
      /429/.test(port3All) &&
      /503/.test(port3All) &&
      /dead-letter replay/.test(port3All) &&
      /reconciliation/.test(port3All),
    "The integration project retains mapping, retry, replay, and reconciliation evidence.",
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
    residue.length ? residue.join("; ") : "No reader-facing review-stage residue.",
  );
  check(
    "ZERO_LOCAL_PATH_RESIDUE",
    !/[A-Za-z]:\\\\|file:\/\/|\/Users\/|\/home\//i.test(activeText),
    "No absolute local filesystem path appears in public content.",
  );
  check(
    "NO_OVERT_AUDIENCE_LANGUAGE",
    !/(recruiter-facing|employer-facing|built to prove|proof for employers)/i.test(activeText),
    "The public site describes the work directly rather than addressing an application audience.",
  );
  const refreshedSurfaces = [
    text("src/index.html"),
    text("src/irw/index.html"),
    text("src/projects/implementation-readiness-support-transition.html"),
  ].join("\n");
  check(
    "ASCII_DASHES_ON_REFRESHED_SURFACES",
    !/[\u2013\u2014]/u.test(refreshedSurfaces),
    "The refreshed homepage and IRW routes contain no en dash or em dash.",
  );

  const renderedText = [
    ...walk(absolute("src")).filter(isTextPath),
    ...walk(absolute("dist")).filter(isTextPath),
  ].map((path) => readFileSync(path, "utf8")).join("\n");
  check(
    "NO_CONTROLLED_IDS_IN_RENDERED_SITE",
    !/PORT-000[123]/.test(renderedText),
    "Internal project IDs remain structured metadata only.",
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
  const tokenSetAllowed = (tokens, allowed) => tokens.every((token) => allowed.has(token));
  check(
    "ONLY_AUTHORIZED_TOKENS",
    tokenSetAllowed(sourceTokens, new Set(["{{SITE_BASE_URL}}", PORT2_TOKEN, PORT3_TOKEN])) &&
      tokenSetAllowed(contentTokens, new Set([PORT2_TOKEN, PORT3_TOKEN])) &&
      tokenSetAllowed(distTokens, new Set([PORT2_TOKEN, PORT3_TOKEN])) &&
      (allowRepositoryTokens || (!sourceTokens.includes(PORT2_TOKEN) && !sourceTokens.includes(PORT3_TOKEN) &&
        !contentTokens.includes(PORT2_TOKEN) && !contentTokens.includes(PORT3_TOKEN) &&
        !distTokens.includes(PORT2_TOKEN) && !distTokens.includes(PORT3_TOKEN))),
    `source=${sourceTokens.join(",") || "none"}; content=${contentTokens.join(",") || "none"}; dist=${distTokens.join(",") || "none"}`,
  );

  const staticPaths = [
    ...walk(absolute("src")).map((path) => relative(absolute("src"), path).replaceAll("\\", "/")),
    ...walk(absolute("assets")).map((path) => `assets/${relative(absolute("assets"), path).replaceAll("\\", "/")}`),
  ].sort();
  const builtPaths = walk(absolute("dist"))
    .map((path) => relative(absolute("dist"), path).replaceAll("\\", "/"))
    .sort();
  check("STATIC_SOURCE_SET", equalArrays(staticPaths, EXPECTED_STATIC_PATHS), "Twelve exact deployable source files.");
  check("BUILD_FILE_SET", equalArrays(builtPaths, EXPECTED_STATIC_PATHS), "The built tree contains the same twelve files.");
  check(
    "BUILD_MANIFEST_TOPOLOGY",
    manifest.build_mode === "DeterministicThreeProjectSiteBaseUrlGeneration" &&
      manifest.site_base_url === SITE_ORIGIN &&
      manifest.file_count === 12 &&
      equalArrays((manifest.entries || []).map((item) => item.relative_path).sort(), EXPECTED_STATIC_PATHS),
    "The build manifest records the exact deterministic topology.",
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
      `${path} matches the build manifest.`,
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
        html.includes(`<link rel="canonical" href="${route.canonical}">`) &&
        html.includes(`<meta property="og:type" content="${route.type}">`) &&
        html.includes(`<meta property="og:url" content="${route.canonical}">`) &&
        html.includes(`<meta property="og:image" content="${SITE_ORIGIN}/assets/social-preview-1200x630.png">`) &&
        /<meta name="twitter:card" content="summary_large_image">/.test(html) &&
        /<link rel="icon"/.test(html),
      `${route.path} has canonical, social, and indexing metadata.`,
    );
    check(
      `PAGE_ACCESSIBILITY_${safeId(route.path)}`,
      occurrences(html, "<h1") === 1 &&
        html.includes("Skip to main content") &&
        html.includes('id="main-content"') &&
        new Set(ids).size === ids.length,
      `${route.path} has one H1, a skip link, a main target, and unique IDs.`,
    );
    if (route.redirect) {
      check(
        `REDIRECT_${safeId(route.path)}`,
        html.includes(`content="0; url=${route.redirect}"`) && html.includes(`href="${route.redirect}"`),
        `${route.path} redirects and provides a normal link to ${route.redirect}.`,
      );
    }
    validateLinks(route.path, html, allowRepositoryTokens, check);
  }

  const home = text("dist/index.html");
  const irw = text("dist/irw/index.html");
  const p1 = text("dist/projects/workflow-intake-analysis.html");
  const p2Redirect = text("dist/projects/implementation-readiness-support-transition.html");
  const p3 = text("dist/projects/saas-integration-reliability-support-troubleshooting.html");

  check(
    "HOME_THREE_PROJECTS",
    home.includes("Workflow Intake Analysis Demo") &&
      home.includes("Implementation Readiness and Support Transition") &&
      home.includes("SaaS Integration Reliability and Support Troubleshooting") &&
      occurrences(home, "Read case study") === 3 &&
      occurrences(home, "View repository") === 2 &&
      occurrences(home, "View foundation repository") === 1,
    "The homepage retains three projects and distinct repository links.",
  );
  check(
    "HOME_IRW_CANONICAL_LINK",
    home.includes('href="irw/index.html"') && !home.includes('href="projects/implementation-readiness-support-transition.html">Read case study'),
    "The readiness project card uses the canonical IRW route.",
  );
  check(
    "IRW_TWO_LAYER_NARRATIVE",
    /platform-neutral implementation-readiness model/i.test(irw) &&
      /working Jira and Confluence workspace/i.test(irw) &&
      /original eight validation cases/i.test(irw) &&
      /ten IRW cases/i.test(irw) &&
      /IRW-76.*blocks IRW-75/is.test(irw),
    "The IRW page explains both layers, the separate validation sets, and the current dependency.",
  );
  check(
    "IRW_HUMAN_OWNERSHIP",
    /I owned the analysis, decisions, validation, and closeout/i.test(irw) &&
      /automation for repetitive setup and consistency checking/i.test(irw) &&
      /responsibility for the decisions and results/i.test(irw),
    "The IRW page explains Tyler's ownership without hiding tool assistance.",
  );
  check(
    "IRW_SCOPE_BOUNDARY",
    /fictional implementation/i.test(irw) &&
      /does not represent customer work/i.test(irw) &&
      /No source, app identity, build, deployment, installation, or runtime result is claimed yet/i.test(irw),
    "The IRW page distinguishes completed core work from customer work and unfinished Forge delivery.",
  );
  check(
    "PROJECT_NAVIGATION",
    p1.includes("implementation-readiness-support-transition.html") &&
      p1.includes("saas-integration-reliability-support-troubleshooting.html") &&
      irw.includes("workflow-intake-analysis.html") &&
      irw.includes("saas-integration-reliability-support-troubleshooting.html") &&
      p3.includes("workflow-intake-analysis.html") &&
      p3.includes("implementation-readiness-support-transition.html") &&
      p2Redirect.includes("../irw/"),
    "Each project remains connected, and legacy readiness links resolve through the redirect.",
  );
  check(
    "PORT3_VISIBLE_BOUNDARY",
    /No external service or live endpoint/.test(p3) &&
      /Twelve scenarios/.test(p3) &&
      /Dead letter and replay/i.test(p3) &&
      /n8n execution was deferred/.test(p3) &&
      /does not establish n8n proficiency/.test(p3),
    "The integration page retains its reviewed execution and n8n boundaries.",
  );

  const robots = text("dist/robots.txt");
  const sitemap = text("dist/sitemap.xml");
  check(
    "ROBOTS_PUBLIC",
    robots === `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`,
    "Public crawl and sitemap declaration are correct.",
  );
  check(
    "SITEMAP_CANONICAL_ROUTES",
    occurrences(sitemap, "<loc>") === SITEMAP_URLS.length &&
      SITEMAP_URLS.every((url) => sitemap.includes(`<loc>${url}</loc>`)) &&
      !sitemap.includes("implementation-readiness-support-transition.html"),
    "The sitemap contains the homepage, canonical IRW route, and two other project routes.",
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
    !/<script\b/i.test(home + irw + p1 + p2Redirect + p3) &&
      !/<form\b/i.test(home + irw + p1 + p2Redirect + p3) &&
      !/(google-analytics|googletagmanager|segment\.com|hotjar|mixpanel)/i.test(activeText),
    "The site remains static, form-free, and analytics-free.",
  );

  const failed = checks.filter((item) => item.result === "FAIL");
  const result = failed.length === 0 ? "PASS" : "HOLD";
  const terminal = failed.length === 0
    ? allowRepositoryTokens
      ? "PASS_THREE_PROJECT_SITE_PREFLIGHT"
      : "PASS_THREE_PROJECT_PUBLIC_SITE"
    : allowRepositoryTokens
      ? "HOLD_THREE_PROJECT_SITE_PREFLIGHT"
      : "HOLD_THREE_PROJECT_PUBLIC_SITE";
  const report = {
    schema_version: "1.0.0",
    validator: "ThreeProjectStaticSiteValidator",
    mode: allowRepositoryTokens ? "PublicationPreflight" : "FinalPublicUrlsRequired",
    result,
    terminal,
    check_count: checks.length,
    passed_count: checks.length - failed.length,
    failed_count: failed.length,
    site_base_url: SITE_ORIGIN,
    canonical_irw_url: `${SITE_ORIGIN}/irw/`,
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
    IRW_ATLASSIAN_URL,
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
      const allowedCanonical = ROUTES.some((route) => route.canonical === href);
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
    let targetPath = targetPart
      ? posix.normalize(posix.join(posix.dirname(pagePath), targetPart))
      : pagePath;
    if (targetPath.endsWith("/")) targetPath = `${targetPath}index.html`;
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
  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...SITEMAP_URLS.flatMap((url) => ["  <url>", `    <loc>${url}</loc>`, "  </url>"]),
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
