import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync, spawnSync } from 'node:child_process';
import { cpSync, readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const source = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const fixtureBase = process.env.PORTFOLIO_FIXTURE_ROOT;
const evidenceBase = process.env.PORTFOLIO_TEST_EVIDENCE;
assert.ok(fixtureBase && evidenceBase, 'Set isolated PORTFOLIO_FIXTURE_ROOT and PORTFOLIO_TEST_EVIDENCE');
mkdirSync(fixtureBase, { recursive: true });
const run = mkdtempSync(join(resolve(fixtureBase), 'negative-'));
const evidence = join(resolve(evidenceBase), run.split(/[\\/]/).at(-1));
mkdirSync(evidence, { recursive: true });
const reportPath = 'validation/portable-v3/public-validation.json';
const results = [];
const edit = (root, file, from, to) => {
  const path = join(root, file), before = readFileSync(path, 'utf8');
  assert.ok(before.includes(from), `Mutation anchor missing: ${file}: ${from}`);
  writeFileSync(path, before.replace(from, to));
};
const jsonEdit = (root, change) => {
  const path = join(root, 'validation/build-manifest.json');
  const value = JSON.parse(readFileSync(path, 'utf8')); change(value);
  writeFileSync(path, JSON.stringify(value));
};
function copy(name) {
  const root = join(run, name);
  cpSync(source, root, { recursive: true, filter: path => !/(?:^|[\\/])(?:dist|validation|node_modules|\.git)(?:[\\/]|$)/.test(path) });
  return root;
}
function command(root, kind) {
  if (kind === 'npm') {
    try { return { status: 0, stdout: execSync('npm run validate', { cwd: root, encoding: 'utf8', timeout: 60000, stdio: 'pipe', windowsHide: true }), stderr: '' }; }
    catch (e) { return { status: e.status ?? -1, stdout: String(e.stdout ?? ''), stderr: String(e.stderr ?? e.message) }; }
  }
  return spawnSync(process.execPath, [kind === 'build' ? 'scripts/build.mjs' : 'scripts/validate-public-v3.mjs'], { cwd: root, encoding: 'utf8', timeout: 30000, windowsHide: true });
}
function record(name, root, outcome, start) {
  assert.ok(existsSync(join(root, reportPath)), 'Validator must write a fresh report on rejection');
  const report = JSON.parse(readFileSync(join(root, reportPath), 'utf8'));
  assert.ok(Date.parse(report.started_at) >= start, 'Report must be from this invocation');
  assert.ok(report.run_id, 'Report identifies the invocation');
  const failed = report.checks.filter(c => c.result === 'FAIL').map(c => c.id);
  const row = { name, command: name.startsWith('npm-') ? 'npm run validate' : 'node scripts/validate-public-v3.mjs (after build, no rebuild)', exit_code: outcome.status, report_result: report.result, failed_check_ids: failed, run_id: report.run_id };
  results.push(row);
  writeFileSync(join(evidence, `${name}.stdout.log`), outcome.stdout ?? '');
  writeFileSync(join(evidence, `${name}.stderr.log`), outcome.stderr ?? '');
  writeFileSync(join(evidence, `${name}.report.json`), JSON.stringify(report, null, 2) + '\n');
  writeFileSync(join(evidence, 'summary.json'), JSON.stringify(results, null, 2) + '\n');
  return { report, failed };
}

// Each mutation names an actual defect; expected failure IDs are literal and do
// not come from the implementation's replacement table or validation helpers.
const scenarios = [
  ['npm-wrong-canonical', 'npm', r => edit(r, 'src/index.html', 'rel="canonical" href="{{SITE_BASE_URL}}/"', 'rel="canonical" href="{{SITE_BASE_URL}}/wrong/"'), 'V3_HOME_METADATA'],
  ['npm-wrong-social', 'npm', r => edit(r, 'src/index.html', 'property="og:image" content="{{SITE_BASE_URL}}/assets/irw-social-preview.png"', 'property="og:image" content="{{SITE_BASE_URL}}/assets/social-preview-1200x630.png"'), 'V3_HOME_METADATA'],
  ['description-scope', 'source', r => { const p=join(r,'src/index.html'); writeFileSync(p,readFileSync(p,'utf8').replaceAll('Tyler Windes connects small-business operations','Tyler Windes connects Amkha small-business operations')); }, 'V3_HOME_METADATA'],
  ['extra-source-file', 'source', r => writeFileSync(join(r, 'src/unapproved.txt'), 'unexpected'), 'V3_STATIC_SOURCE_SET'],
  ['missing-source-stylesheet', 'source', r => rmSync(join(r, 'src/homepage.css')), 'V3_STATIC_SOURCE_SET'],
  ['extra-built-file', 'built', r => writeFileSync(join(r, 'dist/unapproved.txt'), 'unexpected'), 'V3_BUILD_FILE_SET'],
  ['missing-built-stylesheet', 'built', r => rmSync(join(r, 'dist/homepage.css')), 'V3_BUILD_FILE_SET'],
  ['manifest-hash', 'built', r => jsonEdit(r, m => { m.entries.find(e => e.relative_path === 'homepage.css').sha256 = '0'.repeat(64); }), 'V3_BUILD_HASH_HOMEPAGE_CSS'],
  ['manifest-duplicate', 'built', r => jsonEdit(r, m => m.entries.push(m.entries[0])), 'V3_MANIFEST_TOPOLOGY'],
  ['source-changed-after-build', 'built', r => writeFileSync(join(r, 'src/homepage.css'), readFileSync(join(r, 'src/homepage.css'), 'utf8') + '\n/* changed after build */'), 'V3_BUILD_PARITY_HOMEPAGE_CSS'],
  ['built-changed-after-build', 'built', r => writeFileSync(join(r, 'dist/homepage.css'), readFileSync(join(r, 'dist/homepage.css'), 'utf8') + '\n/* corrupt output */'), 'V3_BUILD_PARITY_HOMEPAGE_CSS'],
  ['broken-local-target', 'source', r => edit(r, 'src/index.html', 'href="projects/workflow-intake-analysis.html"', 'href="projects/missing.html"'), 'LINKS_INDEX_HTML'],
  ['broken-skip-target', 'source', r => edit(r, 'src/index.html', 'class="skip" href="#main"', 'class="skip" href="#missing"'), 'V3_HOME_ACCESSIBILITY'],
  ['customer-disclaimer-removed', 'source', r => edit(r, 'src/irw/index.html', 'It does not represent customer work, production administration, measured outcomes, a completed Jira dashboard, or a deployed Forge application.', 'Customer work.'), 'V3_IRW_SCOPE'],
  ['fictional-disclaimer-removed', 'source', r => { const p=join(r,'src/irw/index.html'); writeFileSync(p,readFileSync(p,'utf8').replaceAll(/fictional/gi,'actual')); }, 'V3_IRW_SCOPE'],
  ['injected-script', 'source', r => edit(r, 'src/index.html', '</body>', '<script>alert(1)</script></body>'), 'NO_ACTIVE_CODE_SURFACE'],
  ['404-injected-script', 'source', r => edit(r, 'src/404.html', '</body>', '<script>alert(1)</script></body>'), 'V3_STATIC_ONLY'],
  ['injected-event-handler', 'source', r => edit(r, 'src/index.html', '<body>', '<body onload="alert(1)">'), 'V3_STATIC_ONLY'],
  ['unapproved-contact', 'source', r => edit(r, 'src/index.html', 'https://www.linkedin.com/in/tylerwindes', 'mailto:unapproved@example.test'), 'LINKS_INDEX_HTML'],
  ['unapproved-contact-single-quote', 'source', r => edit(r, 'src/index.html', '</body>', "<a href='mailto:unapproved@example.test'>Email</a></body>"), 'V3_LINKS_AND_ASSETS'],
  ['additional-legacy-failure', 'source', r => edit(r, 'content/projects/saas-integration-reliability-support-troubleshooting.json', 'Synthetic', 'Customer'), 'CONTENT_IDENTITY_PORT-0003'],
  ['unicode-corruption', 'source', r => edit(r, 'src/index.html', 'Tyler Windes', 'Tyler \ufffd Windes'), 'V3_UTF8_TEXT_INTEGRITY'],
  ['private-drive-path', 'source', r => edit(r, 'src/index.html', '</body>', '<p>Z:/restricted/source.txt</p></body>'), 'V3_NO_PRIVATE_PATHS'],
  ['missing-third-project', 'source', r => edit(r, 'src/index.html', 'class="case integration-case"', 'class="removed-project"'), 'V3_THREE_PROJECTS'],
  ['stale-forge-claim', 'source', r => edit(r, 'src/irw/index.html', 'not implemented or deployed', 'implemented and deployed'), 'V3_IRW_SCOPE'],
  ['wrong-package-binding', 'built', r => edit(r, 'package.json', 'npm run build && node scripts/validate-public-v3.mjs', 'node scripts/validate-public.mjs'), 'PACKAGE_WORKFLOW'],
  ['invalid-manifest-json', 'built', r => writeFileSync(join(r, 'validation/build-manifest.json'), '{broken'), 'V3_EXECUTION'],
];

test('portable gate accepts current content and rejects real defects with fresh evidence', async t => {
  for (const [name, mode, mutate, expected] of scenarios) {
    await t.test(name, () => {
      const root = copy(name);
      if (mode === 'source' || mode === 'npm') mutate(root);
      if (mode !== 'npm') {
        const build = command(root, 'build');
        assert.equal(build.status, 0, build.stderr);
        if (mode === 'built') mutate(root);
      }
      const start = Date.now();
      const outcome = command(root, mode === 'npm' ? 'npm' : 'direct');
      const { report, failed } = record(name, root, outcome, start);
      assert.equal(outcome.status, 1, 'Defect must reject with exit 1');
      assert.equal(report.result, 'HOLD');
      assert.ok(failed.includes(expected), `Expected ${expected}; got ${failed.join(', ')}`);
    });
  }
  for (const name of ['positive-current', 'positive-legal-unicode']) {
    await t.test(name, () => {
      const root = copy(name);
      if (name.endsWith('unicode')) edit(root, 'src/index.html', 'The work doesn\'t stop', 'The work doesn\'t stop — really');
      assert.equal(command(root, 'build').status, 0);
      const start = Date.now(), outcome = command(root, 'direct');
      const { report, failed } = record(name, root, outcome, start);
      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(report.result, 'PASS');
      assert.deepEqual(failed, []);
    });
  }
});
