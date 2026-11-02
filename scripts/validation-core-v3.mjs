// Portable successor for the accepted editorial layout. The original evaluator
// is executed afresh, never loaded from saved JSON. Enumerated layout/navigation
// assertions are superseded; PACKAGE_WORKFLOW retains its invariant with the
// new wrapper path. Every other legacy result, including new failures, is kept.
import { createHash, randomUUID } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, lstatSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { projectRoot, runPublicationValidation } from './validation-core.mjs';

const ORIGIN = 'https://tyler-windes.com';
const IMAGE = `${ORIGIN}/assets/irw-social-preview.png`;
const PROFILE = 'https://github.com/Tyler-Windes';
const LINKEDIN = 'https://www.linkedin.com/in/tylerwindes';
const REPOSITORIES = [
  `${PROFILE}/implementation-readiness-support-transition`,
  `${PROFILE}/workflow-intake-analysis-demo`,
  `${PROFILE}/saas-integration-reliability-support-troubleshooting`,
];
const CASES = ['irw/index.html', 'projects/workflow-intake-analysis.html', 'projects/saas-integration-reliability-support-troubleshooting.html'];
const HTML = ['index.html', ...CASES, 'projects/implementation-readiness-support-transition.html', '404.html'];
const STATIC = ['.nojekyll', ...HTML, 'assets/favicon.svg', 'assets/irw-social-preview.png',
  'assets/social-preview-1200x630.png', 'homepage.css', 'styles.css', 'robots.txt', 'sitemap.xml'].sort();
export const replacements = Object.freeze({
  ASCII_DASHES_ON_REFRESHED_SURFACES: 'V3_UTF8_TEXT_INTEGRITY',
  STATIC_SOURCE_SET: 'V3_STATIC_SOURCE_SET',
  BUILD_FILE_SET: 'V3_BUILD_FILE_SET',
  BUILD_MANIFEST_TOPOLOGY: 'V3_MANIFEST_TOPOLOGY',
  PAGE_METADATA_INDEX_HTML: 'V3_HOME_METADATA',
  PAGE_ACCESSIBILITY_INDEX_HTML: 'V3_HOME_ACCESSIBILITY',
  HOME_THREE_PROJECTS: 'V3_THREE_PROJECTS',
  IRW_SCOPE_BOUNDARY: 'V3_IRW_SCOPE',
  HOME_IRW_CANONICAL_LINK: 'V3_CANONICAL_CASE_LINKS',
  PROJECT_NAVIGATION: 'V3_PRIMARY_NAVIGATION',
  LINKS_IRW_INDEX_HTML: 'V3_LINKS_AND_ASSETS',
  LINKS_PROJECTS_WORKFLOW_INTAKE_ANALYSIS_HTML: 'V3_LINKS_AND_ASSETS',
  LINKS_PROJECTS_SAAS_INTEGRATION_RELIABILITY_SUPPORT_TROUBLESHOOTING_HTML: 'V3_LINKS_AND_ASSETS',
});
const absolute = p => join(projectRoot, ...p.split('/'));
const bytes = p => readFileSync(absolute(p));
const text = p => new TextDecoder('utf-8', { fatal: true }).decode(bytes(p));
const json = p => JSON.parse(text(p));
const sha = data => createHash('sha256').update(data).digest('hex').toUpperCase();
const id = p => p.toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, '');
const same = (a, b) => a.length === b.length && [...a].sort().every((x, i) => x === [...b].sort()[i]);

// These sites use explicit closing tags and no client runtime. This deliberately
// small tokenizer accepts quoted/unquoted attributes and HTML character entities;
// malformed markup fails closed. It is not a general browser HTML repair parser.
const VOID = new Set('area base br col embed hr img input link meta param source track wbr'.split(' '));
function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|quot|apos|lt|gt|nbsp);/gi, (all, key) => {
    if (key[0] === '#') return String.fromCodePoint(key[1].toLowerCase() === 'x' ? parseInt(key.slice(2), 16) : Number(key.slice(1)));
    return { amp: '&', quot: '"', apos: "'", lt: '<', gt: '>', nbsp: ' ' }[key.toLowerCase()];
  });
}
function parse(html) {
  const root = { tag: '#document', attrs: {}, children: [], text: '' }, stack = [root], nodes = [];
  const token = /<!--[\s\S]*?-->|<![^>]*>|<\/?[a-z][\w:-]*\b(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
  let cursor = 0;
  for (const match of html.matchAll(token)) {
    for (const parent of stack) parent.text += decode(html.slice(cursor, match.index));
    cursor = match.index + match[0].length;
    const raw = match[0];
    if (raw.startsWith('<!')) continue;
    const tag = /^<\/?([\w:-]+)/.exec(raw)[1].toLowerCase();
    if (raw.startsWith('</')) {
      if (stack.length === 1 || stack.at(-1).tag !== tag) throw new Error(`Unbalanced closing tag: ${tag}`);
      stack.pop(); continue;
    }
    const attrs = {};
    const attrText = raw.slice(raw.indexOf(tag) + tag.length, -1).replace(/\/$/, '');
    for (const attr of attrText.matchAll(/([^\s=<>/]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g)) {
      const name = attr[1].toLowerCase();
      if (Object.hasOwn(attrs, name)) throw new Error(`Duplicate attribute: ${name}`);
      attrs[name] = decode(attr[2] ?? attr[3] ?? attr[4] ?? '');
    }
    const node = { tag, attrs, children: [], text: '', parent: stack.at(-1) };
    stack.at(-1).children.push(node); nodes.push(node);
    if (!VOID.has(tag) && !raw.endsWith('/>')) stack.push(node);
  }
  if (stack.length !== 1) throw new Error(`Unclosed tag: ${stack.at(-1).tag}`);
  return { nodes, text: root.text.replace(/\s+/g, ' ').trim() };
}
const hasClass = (n, c) => (n.attrs.class ?? '').split(/\s+/).includes(c);
const under = (n, ancestor) => { for (let p = n.parent; p; p = p.parent) if (p === ancestor) return true; return false; };
const select = (d, tag) => d.nodes.filter(n => n.tag === tag);
function one(nodes, predicate) { const found = nodes.filter(predicate); return found.length === 1 ? found[0] : null; }
function files(p) {
  const output = [];
  for (const item of readdirSync(absolute(p))) {
    const child = `${p}/${item}`, stat = lstatSync(absolute(child));
    if (stat.isSymbolicLink()) throw new Error(`Symlink not permitted: ${child}`);
    if (stat.isDirectory()) output.push(...files(child));
    else if (stat.isFile()) output.push(child);
    else throw new Error(`Unsupported file type: ${child}`);
  }
  return output.sort();
}

export function runPortableValidation() {
  const started_at = new Date().toISOString(), run_id = randomUUID(), checks = [], coverage = [];
  let legacy = null;
  const check = (key, condition, detail) => checks.push({ id: key, result: condition ? 'PASS' : 'FAIL', detail });
  try {
    check('V3_NODE24', process.versions.node.split('.')[0] === '24', 'Node 24 runtime.');
    check('V3_LEGACY_MODULE_PRESERVED', sha(bytes('scripts/validation-core.mjs')) === '31BBA0FE4DB631BC62A415BB59ECAE4F7987EB46DEABD9045095CAE15CF504EA', 'Original historical validator bytes.');
    try {
      legacy = runPublicationValidation({ allowRepositoryTokens: false });
      for (const item of legacy.checks) {
        const replacement = replacements[item.id];
        const wiring = item.id === 'PACKAGE_WORKFLOW';
        coverage.push({ original_id: item.id, original_result: item.result,
          disposition: replacement ? 'superseded-layout-assertion' : wiring ? 'same-invariant-new-entrypoint' : 'carried-fresh',
          current_id: replacement ?? item.id });
        if (!replacement && !wiring) checks.push(item);
      }
      check('V3_LEGACY_COVERAGE', legacy.check_count === 119 && new Set(legacy.checks.map(c => c.id)).size === 119 &&
        Object.keys(replacements).every(key => legacy.checks.some(c => c.id === key)) && legacy.checks.some(c => c.id === 'PACKAGE_WORKFLOW'),
      '119 fresh legacy results accounted for; thirteen exact layout/navigation replacements and one migrated package binding.');
    } catch (error) {
      // Missing/malformed inputs must not reuse a previous successful report.
      check('V3_LEGACY_EXECUTION', false, error.message);
    }

    const pkg = json('package.json');
    check('PACKAGE_WORKFLOW', pkg.private === true && pkg.engines?.node === '>=24 <25' &&
      pkg.scripts?.build === 'node scripts/build.mjs' && pkg.scripts?.validate === 'npm run validate:public' &&
      pkg.scripts?.['validate:public'] === 'npm run build && node scripts/validate-public-v3.mjs' &&
      !Object.keys(pkg.dependencies ?? {}).length && !Object.keys(pkg.devDependencies ?? {}).length &&
      !Object.keys(pkg.scripts).some(k => /^(?:pre|post)(?:validate(?::public)?|build)$/.test(k)),
    'Same private/Node24/deterministic-build invariant; actual npm command invokes this fail-closed successor with no hooks or packages.');

    const source = [...files('src').map(p => p.slice(4)), ...files('assets')];
    const built = files('dist').map(p => p.slice(5));
    check('V3_STATIC_SOURCE_SET', same(source, STATIC), 'Exactly 14 approved files, including homepage.css: ' + JSON.stringify(source));
    check('V3_BUILD_FILE_SET', same(built, STATIC), 'Exactly the same 14 files in dist: ' + JSON.stringify(built));
    const manifest = json('validation/build-manifest.json');
    check('V3_MANIFEST_TOPOLOGY', manifest.schema_version === '1.0.0' &&
      manifest.build_mode === 'DeterministicThreeProjectSiteBaseUrlGeneration' && manifest.site_base_url === ORIGIN &&
      manifest.output_root === 'dist' && same(manifest.source_roots ?? [], ['src', 'assets']) &&
      manifest.file_count === 14 && same((manifest.entries ?? []).map(e => e.relative_path), STATIC),
    'Exact file set/count, no duplicates, authorized origin and deterministic build mode.');
    const entryByPath = new Map((manifest.entries ?? []).map(e => [e.relative_path, e]));
    for (const p of STATIC) {
      const sourcePath = p.startsWith('assets/') ? p : `src/${p}`;
      const present = existsSync(absolute(sourcePath)) && existsSync(absolute(`dist/${p}`));
      let expected = present ? bytes(sourcePath) : null;
      if (present && HTML.includes(p)) expected = Buffer.from(text(sourcePath).replaceAll('{{SITE_BASE_URL}}', ORIGIN));
      // The unchanged builder generates these two files; the retained legacy
      // BUILD_PARITY and ROBOTS/SITEMAP checks recompute their exact contents.
      const generated = ['robots.txt', 'sitemap.xml'].includes(p);
      const output = present ? bytes(`dist/${p}`) : null, entry = entryByPath.get(p);
      check(`V3_BUILD_PARITY_${id(p)}`, present && (generated ? legacy?.checks.some(c => c.id === `BUILD_PARITY_${id(p)}` && c.result === 'PASS') : expected.equals(output)), `${p}: current source-to-output parity.`);
      check(`V3_BUILD_HASH_${id(p)}`, present && entry?.size_bytes === output.length && entry?.sha256 === sha(output), `${p}: freshly computed output length and SHA-256.`);
    }

    const textPaths = [...files('src'), ...files('content'), ...files('dist')].filter(p => /\.(?:html|css|json|txt|xml)$/.test(p));
    const active = textPaths.map(p => text(p)); // fatal UTF-8 decoder
    check('V3_UTF8_TEXT_INTEGRITY', active.every(s => !/[\ufffd\u0000-\u0008\u000b\u000c\u000e-\u001f]|â[€€™“”]/u.test(s)), 'Valid UTF-8, no replacement/control/mojibake characters; Unicode punctuation is allowed.');
    check('V3_NO_PRIVATE_PATHS', !/\b[a-z]:[\\/]|file:\/\/|\/Users\/|\/home\/|\/mnt\/data/i.test(active.join('\n')), 'No local absolute paths in deployable text or content records.');

    const docs = new Map(HTML.filter(p => existsSync(absolute(`dist/${p}`))).map(p => [p, parse(text(`dist/${p}`))]));
    const home = docs.get('index.html');
    const meta = (key, attr = 'name') => one(select(home, 'meta'), n => n.attrs[attr] === key)?.attrs.content;
    const title = one(select(home, 'title'), () => true)?.text;
    const alt = 'Tyler Windes - Implementation Readiness Workspace, a synthetic case study';
    const png = bytes('dist/assets/irw-social-preview.png');
    check('V3_HOME_METADATA', one(select(home, 'html'), n => n.attrs.lang === 'en') &&
      /Technical Implementation Consultant/.test(title ?? '') && /Business Systems Analyst/.test(title ?? '') &&
      /width=device-width/.test(meta('viewport') ?? '') && meta('robots') === 'index, follow' &&
      /business/i.test(meta('description') ?? '') && !/Amkha/.test(meta('description') ?? '') &&
      meta('og:description', 'property') === meta('description') &&
      one(select(home, 'link'), n => n.attrs.rel === 'canonical')?.attrs.href === `${ORIGIN}/` &&
      meta('og:type', 'property') === 'website' && meta('og:url', 'property') === `${ORIGIN}/` &&
      meta('og:title', 'property') === title && meta('og:image', 'property') === IMAGE &&
      meta('og:image:width', 'property') === '1730' && meta('og:image:height', 'property') === '909' &&
      meta('og:image:alt', 'property') === alt && meta('twitter:card') === 'summary_large_image' &&
      meta('twitter:image') === IMAGE && meta('twitter:image:alt') === alt &&
      one(select(home, 'link'), n => n.attrs.rel === 'icon')?.attrs.href === 'assets/favicon.svg' &&
      png.length >= 24 && png.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) &&
      png.toString('ascii', 12, 16) === 'IHDR' && png.readUInt32BE(16) === 1730 && png.readUInt32BE(20) === 909,
    'Unique canonical and complete matching OG/Twitter metadata, with actual IRW image dimensions and synthetic alt text.');

    const ids = home.nodes.filter(n => 'id' in n.attrs).map(n => n.attrs.id);
    check('V3_HOME_ACCESSIBILITY', select(home, 'h1').length === 1 && new Set(ids).size === ids.length &&
      one(select(home, 'main'), n => n.attrs.id === 'main') &&
      one(select(home, 'a'), n => hasClass(n, 'skip') && n.attrs.href === '#main' && /^Skip to/i.test(n.text)) &&
      one(select(home, 'nav'), n => n.attrs['aria-label'] === 'Primary navigation'),
    'One H1, unique IDs, a real skip-to-main target and labeled navigation in the accepted layout.');
    const work = one(select(home, 'section'), n => n.attrs.id === 'work');
    const articles = select(home, 'article').filter(n => under(n, work));
    check('V3_THREE_PROJECTS', articles.length === 3 && hasClass(articles[0], 'featured') &&
      /Fictional implementation exercise/.test(articles[0].text) &&
      articles.every((n, i) => (i === 0 || hasClass(n, 'case')) &&
        select(home, 'a').some(a => under(a, n) && a.attrs.href === (i === 0 ? 'irw/' : CASES[i])) &&
        select(home, 'a').some(a => under(a, n) && a.attrs.href === REPOSITORIES[i])),
    'Exactly three distinct case articles, IRW first, each linked to its own local case and authentic repository.');
    const irw = docs.get('irw/index.html').text;
    check('V3_IRW_SCOPE', /fictional implementation/i.test(irw) && /does not represent customer work/i.test(irw) &&
      /earned the Atlassian Credentialed in Forge Fundamentals certificate/i.test(irw) &&
      /remain planned, not implemented or deployed/i.test(irw) &&
      /No Forge source, app identity, build, installation, or runtime result is claimed/i.test(irw) &&
      /original eight validation cases/i.test(irw) && /ten IRW cases/i.test(irw) &&
      !/I am completing the Atlassian Forge certification path/i.test(irw),
    'Awarded certificate distinguished from unimplemented Forge/dashboard, fictional/customer scope and separate 8/10 evidence sets.');

    check('V3_HOMEPAGE_STYLESHEET_SCOPE', HTML.every(p => {
      const d = docs.get(p); return d && select(d, 'link').filter(n => n.attrs.rel === 'stylesheet' && /(?:^|\/)homepage\.css$/.test(n.attrs.href ?? '')).length === (p === 'index.html' ? 1 : 0);
    }), 'Homepage stylesheet exists, is built with parity and loads only on the homepage.');
    const homeCss = text('dist/homepage.css');
    check('V3_HOME_CSS_ACCESSIBILITY', /:focus-visible/.test(homeCss) && /prefers-reduced-motion/.test(homeCss) && /@media/.test(homeCss), 'Homepage focus, reduced-motion and responsive controls preserved.');
    check('V3_EVIDENCE_DISCLOSURES', /30 SYNTHETIC RECORDS/.test(home.text) && /Rules satisfied\s*21/.test(home.text) && /More context needed\s*9/.test(home.text) &&
      /not a Jira screenshot/.test(home.text) && /ten-case fictional Atlassian layer and eight-case foundation are separate/.test(home.text) &&
      /12\/12 expected outcomes; no live SaaS or n8n execution/.test(home.text) && /not Amkha deployments or paid client implementations/.test(home.text),
    'Three illustrations and work samples retain their synthetic/local qualifications and distinct evidence sets.');
    check('V3_CREDENTIAL_SCOPE', ['Forge Fundamentals', 'BigQuery Data Skill Badge', 'Databricks'].every(s => home.text.includes(s)) &&
      !/PL-900|Workato|Looker skill badge earned/.test(home.text), 'Accepted compact awards remain distinct from planned awards; host evidence authenticity is an Owner preflight responsibility.');
    const contact = one(home.nodes, n => hasClass(n, 'connect-links'));
    check('V3_CONTACT_CHANNELS', contact && same(select(home, 'a').filter(a => under(a, contact)).map(a => a.attrs.href), [LINKEDIN, PROFILE]), 'Homepage contact block contains exactly the approved LinkedIn and GitHub links.');


    // Current navigation and exact evidence destinations are a bounded successor
    // to the five newly migrated legacy assertions. Other legacy failures carry forward.
    const substantive = ['index.html', ...CASES];
    const routePaths = ['/irw/', '/projects/workflow-intake-analysis.html', '/projects/saas-integration-reliability-support-troubleshooting.html'];
    const navNames = ['Implementation readiness', 'Data quality', 'Integration reliability'];
    const tidy = s => s.replace(/\s+/g, ' ').trim();
    const routeOf = (a, p) => new URL(a.attrs.href, `${ORIGIN}/${p}`).pathname.replace(/index\.html$/, '');
    const navLinks = (d, label) => { const n = one(select(d, 'nav'), x => x.attrs['aria-label'] === label); return n ? select(d, 'a').filter(a => under(a, n)) : []; };
    check('V3_PRIMARY_NAVIGATION', substantive.every((p, i) => {
      const d = docs.get(p), links = navLinks(d, 'Primary navigation');
      if (links.length !== 3 || links.some((a, j) => routeOf(a, p) !== routePaths[j] || tidy(a.text) !== navNames[j] || a.attrs.href.startsWith('#'))) return false;
      const current = links.filter(a => a.attrs['aria-current'] !== undefined);
      return i === 0 ? current.length === 0 : current.length === 1 && current[0].attrs['aria-current'] === 'page' && routeOf(current[0], p) === routePaths[i - 1];
    }), 'Three consistently ordered direct case destinations, with correct active-page semantics.');
    check('V3_PROFESSIONAL_LINKS', substantive.every(p => {
      const links = navLinks(docs.get(p), 'Professional links');
      return links.length === 2 && links[0].attrs.href === LINKEDIN && links[1].attrs.href === PROFILE;
    }), 'LinkedIn and GitHub remain separately labeled professional destinations.');
    const homeSections = ['#background', '#independent-work', '#work', '#approach', '#learning', '#connect'];
    check('V3_PAGE_OUTLINES', substantive.every(p => {
      const d = docs.get(p), links = navLinks(d, 'On this page');
      return links.length >= 5 && links.every(a => a.attrs.href.startsWith('#') && d.nodes.some(n => n.attrs.id === a.attrs.href.slice(1))) &&
        (p !== 'index.html' || links.map(a => a.attrs.href).join('|') === homeSections.join('|'));
    }), 'Clearly labeled page outlines use existing fragments in the intended order.');
    const heroActions = one(home.nodes, n => hasClass(n, 'hero-actions'));
    const opening = select(home, 'a').filter(a => heroActions && under(a, heroActions));
    check('V3_OPENING_CASE_ACTIONS', opening.length === 2 && routeOf(opening[0], 'index.html') === '/irw/' &&
      /Read the implementation-readiness case/.test(opening[0].text) && opening[1].attrs.href === '#work' && /on this page/.test(opening[1].text),
    'Opening action opens the flagship; secondary action explicitly stays on this page.');
    check('V3_CASE_DISCOVERY', articles.every((n, i) => {
      const links = select(home, 'a').filter(a => under(a, n));
      return links.filter(a => routeOf(a, 'index.html') === routePaths[i]).length === 2 &&
        links.some(a => a.attrs.href === REPOSITORIES[i] && /View .* evidence on GitHub/.test(tidy(a.text)));
    }), 'Each card offers a linked case label, a case action and a readable source action.');
    const expectedArtifacts = [
      ['irw/index.html', REPOSITORIES[0], ['evidence/uat-cases-results.csv', 'evidence/defect-retests.csv']],
      ['projects/workflow-intake-analysis.html', REPOSITORIES[1], ['reports/examples/sql/summary_metrics.csv', 'reports/examples/sql/review_required_records.csv']],
      ['projects/saas-integration-reliability-support-troubleshooting.html', REPOSITORIES[2], ['evidence/execution-and-reconciliation.json', 'evidence/structured-execution-trace.jsonl']],
    ];
    check('V3_DIRECT_ARTIFACTS', expectedArtifacts.every(([p, repo, paths]) => paths.every(file => {
      const matches = select(docs.get(p), 'a').filter(a => a.attrs.href === `${repo}/blob/main/${file}`);
      return matches.length === 1 && /\((?:CSV|JSON|JSONL)\)/.test(matches[0].text);
    })), 'Exactly one descriptive link to each of the six selected public evidence files.');
    const foundation = one(docs.get('irw/index.html').nodes, n => n.attrs.id === 'foundation-artifacts');
    check('V3_ARTIFACT_CONTEXT', foundation && /eight-case platform-neutral model/.test(foundation.text) && /not the test records for the separate ten-case/.test(foundation.text),
    'Public foundation files are not misrepresented as ten-case Atlassian test evidence.');
    check('V3_NO_EM_DASHES', HTML.every(p => !/\u2014|&mdash;?|&#0*8212;?|&#x0*2014;?/i.test(text(`src/${p}`) + text(`dist/${p}`))),
    'Site HTML and metadata contain no literal or encoded em dash.');
    const legacyRedirect = text('dist/projects/implementation-readiness-support-transition.html');
    check('V3_CANONICAL_CASE_LINKS', substantive.every(p => select(docs.get(p), 'a').every(a => !a.attrs.href?.includes('implementation-readiness-support-transition.html'))) &&
      /http-equiv="refresh" content="0; url=\.\.\/irw\/"/.test(legacyRedirect),
    'New internal links use the direct IRW route while the original legacy redirect remains available.');

    const prohibited = [], linkErrors = [];
    const allowed = new Set([...REPOSITORIES, LINKEDIN, PROFILE, 'https://tyler-windes.atlassian.net/wiki/spaces/~7120203b004a0c07184b39860e66e497b78dd0/pages/426169',
      "https://github.com/Tyler-Windes/implementation-readiness-support-transition/blob/main/evidence/uat-cases-results.csv",
      "https://github.com/Tyler-Windes/implementation-readiness-support-transition/blob/main/evidence/defect-retests.csv",
      "https://github.com/Tyler-Windes/workflow-intake-analysis-demo/blob/main/reports/examples/sql/summary_metrics.csv",
      "https://github.com/Tyler-Windes/workflow-intake-analysis-demo/blob/main/reports/examples/sql/review_required_records.csv",
      "https://github.com/Tyler-Windes/saas-integration-reliability-support-troubleshooting/blob/main/evidence/execution-and-reconciliation.json",
      "https://github.com/Tyler-Windes/saas-integration-reliability-support-troubleshooting/blob/main/evidence/structured-execution-trace.jsonl",
    ]);
    for (const [path, doc] of docs) {
      for (const n of doc.nodes) {
        if (['script','form','iframe','object','embed','base'].includes(n.tag) || Object.keys(n.attrs).some(k => /^on/i.test(k) || ['srcdoc','srcset','action','formaction'].includes(k))) prohibited.push(`${path}: ${n.tag}`);
        for (const attribute of ['href','src','poster']) {
          if (!(attribute in n.attrs)) continue;
          const value = n.attrs[attribute];
          const url = new URL(value, `${ORIGIN}/${path}`);
          if (/^(?:https?:)?\/\//i.test(value)) {
            const canonical = n.tag === 'link' && n.attrs.rel === 'canonical' && url.origin === ORIGIN;
            if (!canonical && !(n.tag === 'a' && allowed.has(value))) linkErrors.push(`${path}: unapproved external ${value}`);
            continue;
          }
          if (url.origin !== ORIGIN || /^(?:[a-z][\w+.-]*:|\/\/)/i.test(value)) { linkErrors.push(`${path}: prohibited URL ${value}`); continue; }
          let target = decodeURIComponent(url.pathname).slice(1);
          if (!target || target.endsWith('/')) target += 'index.html';
          const fragment = decodeURIComponent(url.hash.slice(1));
          if (!built.includes(target) || (fragment && !docs.get(target)?.nodes.some(x => x.attrs.id === fragment))) linkErrors.push(`${path}: missing ${value}`);
        }
      }
    }
    const assetText = [...files('src'), ...files('assets'), ...files('dist')].filter(p => /\.(?:css|svg|html)$/.test(p)).map(text).join('\n');
    if (/<\s*(?:script|iframe|object|embed)\b|\bon\w+\s*=|@import\b|url\(\s*["']?\s*(?:https?:|\/\/|data:)|javascript:/i.test(assetText)) prohibited.push('Active or external asset content');
    check('V3_STATIC_ONLY', prohibited.length === 0, prohibited.join('; ') || 'All six routes and CSS/SVG remain static, form-free and free of active handlers or remote assets.');
    check('V3_LINKS_AND_ASSETS', linkErrors.length === 0, linkErrors.join('; ') || 'Case-sensitive local targets/fragments/assets exist; external channels are exactly allowlisted.');
  } catch (error) {
    check('V3_EXECUTION', false, `${error.name}: ${error.message}`);
  }

  const failed = checks.filter(c => c.result === 'FAIL');
  const inputPaths = ['package.json', '.github/workflows/pages.yml', ...files('scripts'), ...files('src'), ...files('assets'), ...files('content')];
  const report = { schema_version: '3.0.0', validator: 'PortablePortfolioValidatorV3', started_at,
    completed_at: new Date().toISOString(), run_id, result: failed.length ? 'HOLD' : 'PASS',
    terminal: failed.length ? 'HOLD_PORTABLE_PUBLIC_SITE_V3' : 'PASS_PORTABLE_PUBLIC_SITE_V3',
    check_count: checks.length, passed_count: checks.length - failed.length, failed_count: failed.length,
    runtime: { node: process.version, platform: process.platform }, replacements, coverage,
    legacy_fresh: legacy, input_manifest: inputPaths.map(p => ({ relative_path: p, size_bytes: bytes(p).length, sha256: sha(bytes(p)) })), checks };
  const output = absolute('validation/portable-v3');
  mkdirSync(output, { recursive: true });
  writeFileSync(join(output, 'public-validation.json'), JSON.stringify(report, null, 2) + '\n');
  return report;
}
