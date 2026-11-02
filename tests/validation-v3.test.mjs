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
  ['navigation-section-jump', 'source', r => edit(r, 'src/index.html', 'href="irw/">Implementation readiness', 'href="#work">Implementation readiness'), 'V3_PRIMARY_NAVIGATION'],
  ['navigation-wrong-current', 'source', r => edit(r, 'src/irw/index.html', 'aria-current="page"', 'aria-current="step"'), 'V3_PRIMARY_NAVIGATION'],
  ['artifact-context-confusion', 'source', r => edit(r, 'src/irw/index.html', 'eight-case platform-neutral model', 'ten-case Atlassian test run'), 'V3_ARTIFACT_CONTEXT'],
  ['artifact-file-removed', 'source', r => edit(r, 'src/projects/workflow-intake-analysis.html', '/blob/main/reports/examples/sql/summary_metrics.csv', '/blob/main/reports/examples/sql/missing.csv'), 'V3_DIRECT_ARTIFACTS'],
  ['encoded-em-dash', 'source', r => edit(r, 'src/index.html', '</body>', '<p>Unsupported punctuation &mdash; test.</p></body>'), 'V3_NO_EM_DASHES'],
  ['arbitrary-github-file', 'source', r => edit(r, 'src/index.html', '</body>', '<a href="https://github.com/Tyler-Windes/workflow-intake-analysis-demo/blob/main/unapproved.txt">Unapproved file</a></body>'), 'V3_LINKS_AND_ASSETS'],
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
      if (name.endsWith('unicode')) edit(root, 'src/index.html', 'The work doesn\'t stop', 'The work doesn\'t stop - café example');
      assert.equal(command(root, 'build').status, 0);
      const start = Date.now(), outcome = command(root, 'direct');
      const { report, failed } = record(name, root, outcome, start);
      assert.equal(outcome.status, 0, outcome.stderr);
      assert.equal(report.result, 'PASS');
      assert.deepEqual(failed, []);
    });
  }
});

// Optional browser-backed regressions: set PORTFOLIO_BROWSER_EXECUTABLE to an
// installed Chromium-family executable. Node built-ins only; no installation.
// The existing validator suite above always runs, including when Chrome is absent.
test('rendered print and reader-spacing regressions', {
  skip: !process.env.PORTFOLIO_BROWSER_EXECUTABLE && 'Set PORTFOLIO_BROWSER_EXECUTABLE for rendered CSS checks',
}, async t => {
  const { spawn } = await import('node:child_process');
  const { pathToFileURL } = await import('node:url');
  const root = copy('browser-regressions');
  assert.equal(command(root, 'build').status, 0, 'Build real site for browser checks');
  const profile = mkdtempSync(join(run, 'chrome-'));
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const proc = spawn(process.env.PORTFOLIO_BROWSER_EXECUTABLE, [
    '--headless=new', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-networking', '--disable-sync',
    '--disable-component-update', '--remote-debugging-address=127.0.0.1',
    '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank',
  ], { stdio: 'ignore', windowsHide: true });
  let exited = false; proc.once('exit', () => { exited = true; });
  let ws, sequence = 0; const pending = new Map(), observations = [];
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout ' + method)); }, 10000);
    pending.set(id, { resolve: v => { clearTimeout(timer); resolve(v); }, reject: e => { clearTimeout(timer); reject(e); } });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    assert.ok(!r.exceptionDetails, JSON.stringify(r.exceptionDetails)); return r.result.value;
  };
  const page = async (relative, width, media = 'screen') => {
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await send('Emulation.setEmulatedMedia', { media });
    const url = pathToFileURL(join(root, 'dist', relative)).href;
    await send('Page.navigate', { url });
    for (let i = 0; i < 80; i++) {
      await sleep(50);
      if (await evaluate('location.href === ' + JSON.stringify(url) + ' && document.readyState === "complete" && !!document.querySelector("main")')) {
        await evaluate('document.fonts.ready.then(() => true)'); return;
      }
    }
    assert.fail('Page did not load: ' + relative);
  };
  const recordBrowser = async (id, details) => {
    const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(join(evidence, id + '.png'), Buffer.from(screenshot.data, 'base64'));
    observations.push({ id, ...details });
    writeFileSync(join(evidence, 'browser-regressions.json'), JSON.stringify(observations, null, 2) + '\n');
  };
  try {
    let port;
    for (let i = 0; i < 100; i++) {
      const active = join(profile, 'DevToolsActivePort');
      if (existsSync(active)) { port = Number(readFileSync(active, 'utf8').split('\n')[0]); break; }
      assert.ok(!exited, 'Chrome exited before initialization'); await sleep(50);
    }
    assert.ok(port, 'Chrome debugging endpoint available');
    const tabs = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
    ws = new WebSocket(tabs.find(x => x.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
    ws.addEventListener('message', e => { const m = JSON.parse(e.data), p = pending.get(m.id); if (!p) return; pending.delete(m.id); m.error ? p.reject(Error(JSON.stringify(m.error))) : p.resolve(m.result || {}); });
    await send('Page.enable'); await send('Runtime.enable');
    await t.test('F-01 important homepage copy and links remain readable in print', async () => {
      await page('index.html', 1280, 'print');
      const details = await evaluate(`(() => {
        const rgb = s => s.match(/[\\d.]+/g).slice(0,3).map(Number);
        const lum = a => a.map(v => v/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055)**2.4).reduce((sum,v,i) => sum+v*[.2126,.7152,.0722][i],0);
        const rows = [];
        for (const e of document.querySelectorAll('.featured .feature-copy *, .connect-section *')) {
          const text = [...e.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
          if (!text || !e.getClientRects().length) continue;
          const s = getComputedStyle(e); let background = [255,255,255];
          for (let p=e;p;p=p.parentElement) { const b=getComputedStyle(p).backgroundColor, v=b.match(/[\\d.]+/g); if(v && (v.length===3 || +v[3]===1)) { background=rgb(b);break; } }
          const a=lum(rgb(s.color)),b=lum(background),ratio=(Math.max(a,b)+.05)/(Math.min(a,b)+.05);
          const required=parseFloat(s.fontSize)>=24 || (parseFloat(s.fontSize)>=18.66 && parseFloat(s.fontWeight)>=700) ? 3 : 4.5;
          rows.push({text,ratio,required});
        }
        return {rows, failing:rows.filter(r => r.ratio<r.required)};
      })()`);
      await recordBrowser('F-01', details);
      assert.ok(details.rows.length >= 12, 'Print probe must cover actual feature/contact text');
      assert.deepEqual(details.failing, [], 'F-01: important print text lacks contrast');
    });
    for (const [name, relative] of [['irw', 'irw/index.html'], ['integration', 'projects/saas-integration-reliability-support-troubleshooting.html']]) {
      for (const width of [320, 390]) await t.test('F-02 ' + name + ' readable spacing at ' + width, async () => {
        await page(relative, width);
        const details = await evaluate(`(() => {
          const s=document.createElement('style');s.textContent='*{line-height:1.5!important;letter-spacing:.12em!important;word-spacing:.16em!important}p{margin-bottom:2em!important}';document.head.append(s);
          const h=document.querySelector('.project-hero h1'),r=h.getBoundingClientRect();
          return {client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,heading:h.textContent.trim(),left:r.left,right:r.right,headingOverflow:getComputedStyle(h).overflowX};
        })()`);
        await recordBrowser('F-02-' + name + '-' + width, details);
        assert.ok(details.scroll <= details.client + 1, 'F-02: horizontal overflow ' + JSON.stringify(details));
        assert.ok(details.left >= -1 && details.right <= details.client + 1, 'Heading must remain in the content viewport');
        assert.ok(!['hidden', 'clip'].includes(details.headingOverflow), 'Do not conceal heading text');
      });
    }
  } finally {
    try { await send('Browser.close'); } catch {}
    try { ws?.close(); } catch {}
    for (let i=0;i<30&&!exited;i++) await sleep(100);
    if (!exited) { proc.kill(); for(let i=0;i<30&&!exited;i++) await sleep(100); }
    writeFileSync(join(evidence, 'browser-settlement.json'), JSON.stringify({pid:proc.pid,exited,exit_code:proc.exitCode,signal:proc.signalCode})+'\n');
    assert.ok(exited, 'Owned Chrome process must exit');
  }
});

// F-03: a real HTTP 404 must retain origin-root assets and working recovery.
// Restoring relative hrefs breaks nested URLs; changing only recovery hrefs
// must fail even when CSS and favicon still work. Node built-ins + installed
// Chrome only; fixture/evidence/profile locations come from the caller.
test('F-03 HTTP-backed missing-page assets and recovery', {
  skip: !process.env.PORTFOLIO_BROWSER_EXECUTABLE && 'Set PORTFOLIO_BROWSER_EXECUTABLE for HTTP browser checks',
}, async t => {
  const { createServer } = await import('node:http');
  const { spawn } = await import('node:child_process');
  const { createHash } = await import('node:crypto');
  const { extname, sep } = await import('node:path');
  const root = copy('http-404-recovery');
  assert.equal(command(root, 'build').status, 0, 'Build the actual source');
  const dist = join(root, 'dist'), current404 = readFileSync(join(dist, '404.html'), 'utf8');
  const rootReferences = ['assets/favicon.svg', 'styles.css', 'index.html', 'projects/workflow-intake-analysis.html'];
  let rooted404 = current404;
  for (const ref of rootReferences) rooted404 = rooted404.replaceAll('href="' + ref + '"', 'href="/' + ref + '"');
  const legacy404 = rootReferences.reduce((s, ref) => s.replaceAll('href="/' + ref + '"', 'href="' + ref + '"'), rooted404);
  const recovery404 = ['index.html', 'projects/workflow-intake-analysis.html'].reduce((s, ref) => s.replaceAll('href="/' + ref + '"', 'href="' + ref + '"'), rooted404);
  let fixture = 'current';
  const bodies = { current: current404, legacy: legacy404, recovery: recovery404 };
  const requests = [], observations = [], events = [];
  const digest = b => createHash('sha256').update(b).digest('hex');
  const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain', '.xml': 'application/xml' };
  const server = createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://fixture.invalid').pathname);
    const relative = pathname.endsWith('/') ? pathname + 'index.html' : pathname;
    const file = resolve(dist, '.' + relative);
    const present = file.startsWith(dist + sep) && existsSync(file);
    const status = present ? 200 : 404;
    const body = present ? readFileSync(file) : Buffer.from(bodies[fixture]);
    const mime = present ? types[extname(file)] || 'application/octet-stream' : types['.html'];
    requests.push({ fixture, path: pathname, status, mime, bytes: body.length, sha256: digest(body) });
    res.writeHead(status, { 'Content-Type': mime, 'Cache-Control': 'no-store' }); res.end(body);
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const origin = 'http://127.0.0.1:' + server.address().port;
  const profile = mkdtempSync(join(run, 'chrome-http404-'));
  const proc = spawn(process.env.PORTFOLIO_BROWSER_EXECUTABLE, [
    '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-extensions',
    '--disable-background-networking', '--disable-sync', '--disable-component-update',
    '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0', '--user-data-dir=' + profile, 'about:blank',
  ], { stdio: 'ignore', windowsHide: true });
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  let exited = false, ws, sequence = 0; proc.once('exit', () => { exited = true; });
  const pending = new Map();
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++sequence, timer = setTimeout(() => { pending.delete(id); reject(Error('F03_CDP_TIMEOUT ' + method)); }, 10000);
    pending.set(id, { resolve: value => { clearTimeout(timer); resolve(value); }, reject: e => { clearTimeout(timer); reject(e); } });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async expression => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    assert.ok(!r.exceptionDetails, 'F03_RUNTIME ' + JSON.stringify(r.exceptionDetails)); return r.result.value;
  };
  const navigate = async url => {
    await send('Page.navigate', { url });
    for (let i = 0; i < 100; i++) {
      await sleep(40);
      if (await evaluate('location.href===' + JSON.stringify(url) + '&&document.readyState==="complete"&&!!document.querySelector("main")')) {
        await evaluate('document.fonts.ready.then(()=>true)'); return;
      }
    }
    assert.fail('F03_PAGE_TIMEOUT ' + url);
  };
  async function probe(id, route, width, mode) {
    fixture = mode;
    const start = requests.length, eventStart = events.length, checks = [];
    const check = (id, passed, detail) => checks.push({ id, passed: !!passed, detail });
    const url = origin + route;
    await send('Emulation.setDeviceMetricsOverride', { width, height: 900, deviceScaleFactor: 1, mobile: false });
    await navigate(url);
    const details = await evaluate(`(async()=>{
      const asset=async selector=>{const e=document.querySelector(selector),r=await fetch(e.href,{cache:'no-store'}),b=await r.arrayBuffer();return {url:e.href,status:r.status,mime:r.headers.get('content-type'),bytes:b.byteLength,sha256:[...new Uint8Array(await crypto.subtle.digest('SHA-256',b))].map(v=>v.toString(16).padStart(2,'0')).join('')}};
      const sheet=document.querySelector('link[rel=stylesheet]');
      return {heading:document.querySelector('h1').textContent.trim(),css:await asset('link[rel=stylesheet]'),icon:await asset('link[rel=icon]'),stylesheetLoaded:[...document.styleSheets].some(s=>{try{return s.href===sheet.href&&s.cssRules.length>0}catch{return false}}),margin:getComputedStyle(document.body).margin,brandBackground:getComputedStyle(document.querySelector('.brand-mark')).backgroundColor,client:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,links:[...document.querySelectorAll('.brand,.button-primary,.button-secondary')].map(a=>({selector:a.classList.contains('brand')?'.brand':a.classList.contains('button-primary')?'.button-primary':'.button-secondary',url:a.href}))};
    })()`);
    check('F03_CUSTOM_404_DOCUMENT', events.slice(eventStart).some(e => e.method === 'Network.responseReceived' && e.params.type === 'Document' && e.params.response.url === url && e.params.response.status === 404) && details.heading === 'This route does not lead to a portfolio page.', details.heading);
    check('F03_CSS_ORIGIN_ROOT', details.css.url === origin + '/styles.css', details.css);
    check('F03_CSS_RESPONSE', details.css.status === 200 && details.css.mime.startsWith('text/css') && details.css.sha256 === digest(readFileSync(join(dist, 'styles.css'))), details.css);
    check('F03_ICON_ORIGIN_ROOT', details.icon.url === origin + '/assets/favicon.svg', details.icon);
    check('F03_ICON_RESPONSE', details.icon.status === 200 && details.icon.mime.startsWith('image/svg+xml') && details.icon.sha256 === digest(readFileSync(join(dist, 'assets/favicon.svg'))), details.icon);
    check('F03_COMPUTED_STYLING', details.stylesheetLoaded && details.margin === '0px' && details.brandBackground === 'rgb(23, 63, 54)', { loaded: details.stylesheetLoaded, margin: details.margin, brandBackground: details.brandBackground });
    check('F03_VIEWPORT', details.scroll <= details.client + 1, { client: details.client, scroll: details.scroll });
    const navigations = [];
    for (const [selector, path, heading, name] of [
      ['.button-primary', '/index.html', 'I turn complex information', 'PRIMARY'],
      ['.button-secondary', '/projects/workflow-intake-analysis.html', 'Workflow Intake Analysis Demo', 'SECONDARY'],
      ['.brand', '/index.html', 'I turn complex information', 'BRAND'],
    ]) {
      await navigate(url);
      const target = details.links.find(x => x.selector === selector).url;
      check('F03_' + name + '_TARGET', target === origin + path, target);
      const requestStart = requests.length;
      await evaluate('document.querySelector(' + JSON.stringify(selector) + ').click()');
      for (let i = 0; i < 100; i++) { await sleep(40); if (await evaluate('location.href===' + JSON.stringify(target) + '&&document.readyState==="complete"')) break; }
      const actual = await evaluate('({url:location.href,heading:document.querySelector("h1")?.textContent.replace(/\\s+/g," ").trim()})');
      const responses = requests.slice(requestStart).filter(x => x.path === new URL(target).pathname);
      check('F03_' + name + '_NAVIGATION', actual.url === origin + path && actual.heading?.includes(heading) && responses.some(x => x.status === 200 && x.mime.startsWith('text/html')), { target, actual, responses });
      navigations.push({ name, target, ...actual, responses });
    }
    const actualRequests = requests.slice(start);
    const unexpected = actualRequests.filter(r => r.status >= 400 && r.path !== route);
    const browserResponses = events.slice(eventStart).filter(e => e.method === 'Network.responseReceived');
    const unexpectedResponses = browserResponses.filter(e => e.params.response.status >= 400 && !(e.params.type === 'Document' && e.params.response.url === url && e.params.response.status === 404));
    const expected404Ids = new Set(browserResponses.filter(e => e.params.type === 'Document' && e.params.response.url === url && e.params.response.status === 404).map(e => e.params.requestId));
    const unexpectedLogErrors = events.slice(eventStart).filter(e => e.method === 'Log.entryAdded' && e.params.entry.level === 'error' && !expected404Ids.has(e.params.entry.networkRequestId));
    const loadingErrors = events.slice(eventStart).filter(e => e.method === 'Network.loadingFailed' && !(e.params.type === 'Document' && e.params.canceled));
    const runtime = events.slice(eventStart).filter(e => e.method === 'Runtime.exceptionThrown');
    check('F03_NO_UNEXPECTED_HTTP_ERRORS', unexpected.length === 0 && unexpectedResponses.length === 0 && unexpectedLogErrors.length === 0 && loadingErrors.length === 0, { unexpected, unexpectedResponses, unexpectedLogErrors, loadingErrors });
    check('F03_NO_RUNTIME_EXCEPTION', runtime.length === 0, runtime);
    const screenshot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    writeFileSync(join(evidence, id + '.png'), Buffer.from(screenshot.data, 'base64'));
    const row = { id, mode, route, width, utc: new Date().toISOString(), checks, failed_check_ids: checks.filter(c => !c.passed).map(c => c.id), details, navigations, requests: actualRequests, events: events.slice(eventStart) };
    observations.push(row);
    writeFileSync(join(evidence, 'f03-http-recovery.json'), JSON.stringify(observations, null, 2) + '\n');
    return row;
  }
  try {
    let port;
    for (let i = 0; i < 100; i++) {
      const active = join(profile, 'DevToolsActivePort');
      if (existsSync(active)) { try { port = Number(readFileSync(active, 'utf8').split('\n')[0]); if (port) break; } catch (e) { if (e.code !== 'EBUSY') throw e; } }
      assert.ok(!exited, 'F03_CHROME_STARTUP'); await sleep(80);
    }
    assert.ok(port, 'F03_CHROME_ENDPOINT');
    const tabs = await (await fetch('http://127.0.0.1:' + port + '/json/list')).json();
    ws = new WebSocket(tabs.find(x => x.type === 'page').webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
    ws.addEventListener('message', e => { const m = JSON.parse(e.data), p = pending.get(m.id); if (p) { pending.delete(m.id); m.error ? p.reject(Error(JSON.stringify(m.error))) : p.resolve(m.result || {}); } else if (['Runtime.exceptionThrown', 'Network.responseReceived', 'Network.loadingFailed', 'Log.entryAdded'].includes(m.method)) events.push(m); });
    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable'); await send('Network.setCacheDisabled', { cacheDisabled: true }); await send('Log.enable');
    for (const [name, route] of [['root', '/missing-document'], ['nested', '/nested/missing-document'], ['trailing', '/nested/missing-directory/']]) {
      for (const width of [1440, 390]) await t.test('F03 current ' + name + ' ' + width, async () => {
        const r = await probe('F03-current-' + name + '-' + width, route, width, 'current');
        assert.deepEqual(r.failed_check_ids, [], 'F03 actual HTTP 404 recovery failed: ' + r.failed_check_ids.join(','));
      });
    }
    await t.test('F03 rejects old relative-reference fixture', async () => {
      const r = await probe('F03-legacy-relative', '/nested/missing-directory/', 390, 'legacy');
      assert.ok(r.failed_check_ids.includes('F03_CSS_ORIGIN_ROOT'), 'Old asset URLs must fail');
      assert.ok(r.failed_check_ids.includes('F03_PRIMARY_TARGET') && r.failed_check_ids.includes('F03_SECONDARY_TARGET'), 'Old recovery URLs must fail');
    });
    await t.test('F03 rejects recovery-only relative mutant with working CSS', async () => {
      const r = await probe('F03-recovery-relative', '/nested/missing-directory/', 390, 'recovery');
      assert.ok(r.checks.find(c => c.id === 'F03_COMPUTED_STYLING').passed && r.checks.find(c => c.id === 'F03_CSS_RESPONSE').passed, 'Mutant must have real working CSS');
      assert.ok(r.failed_check_ids.includes('F03_PRIMARY_NAVIGATION') && r.failed_check_ids.includes('F03_SECONDARY_NAVIGATION'), 'Working styling cannot hide broken recovery navigation');
    });
  } finally {
    try { await send('Browser.close'); } catch {}
    try { ws?.close(); } catch {}
    for (let i = 0; i < 30 && !exited; i++) await sleep(100);
    if (!exited) { proc.kill(); for (let i = 0; i < 30 && !exited; i++) await sleep(100); }
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
    writeFileSync(join(evidence, 'f03-settlement.json'), JSON.stringify({ pid: proc.pid, exited, server_closed: !server.listening, origin, observations: observations.length, source_fixture: root }) + '\n');
    assert.ok(exited && !server.listening, 'F03 owned browser and HTTP fixture server must close');
  }
});
