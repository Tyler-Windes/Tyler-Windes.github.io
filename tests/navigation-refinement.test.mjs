import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import {dirname, resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const pages=['index.html','irw/index.html','projects/workflow-intake-analysis.html','projects/saas-integration-reliability-support-troubleshooting.html'];
const destinations=['/irw/','/projects/workflow-intake-analysis.html','/projects/saas-integration-reliability-support-troubleshooting.html'];
const labels=['Implementation readiness','Data quality','Integration reliability'];
const read=p=>readFileSync(join(root,'src',p),'utf8');
const clean=s=>s.replace(/<[^>]+>/g,'').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const anchors=s=>[...s.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/g)].map(m=>({href:/\bhref="([^"]*)"/.exec(m[1])?.[1],text:clean(m[2]),current:/\baria-current="([^"]*)"/.exec(m[1])?.[1]}));
const nav=(s,label)=>[...s.matchAll(/<nav\b([^>]*)>([\s\S]*?)<\/nav>/g)].find(m=>m[1].includes(`aria-label="${label}"`))?.[2]??'';
const target=(href,page)=>new URL(href,`https://tyler-windes.com/${page}`).pathname.replace(/index\.html$/,'');
const artifactSets=[
 ['irw/index.html','implementation-readiness-support-transition',['evidence/uat-cases-results.csv','evidence/defect-retests.csv']],
 ['projects/workflow-intake-analysis.html','workflow-intake-analysis-demo',['reports/examples/sql/summary_metrics.csv','reports/examples/sql/review_required_records.csv']],
 ['projects/saas-integration-reliability-support-troubleshooting.html','saas-integration-reliability-support-troubleshooting',['evidence/execution-and-reconciliation.json','evidence/structured-execution-trace.jsonl']]
];
for(const [i,page] of pages.entries()){
 test(`direct consistent primary navigation: ${page}`,()=>{const html=read(page),links=anchors(nav(html,'Primary navigation'));assert.equal(links.length,3);assert.deepEqual(links.map(a=>a.text),labels);assert.deepEqual(links.map(a=>target(a.href,page)),destinations);assert.ok(links.every(a=>!a.href.startsWith('#')));assert.deepEqual(links.filter(a=>a.current==='page').map(a=>target(a.href,page)),i?[destinations[i-1]]:[]);});
 test(`professional destinations stay separate: ${page}`,()=>{assert.deepEqual(anchors(nav(read(page),'Professional links')).map(a=>a.href),['https://www.linkedin.com/in/tylerwindes','https://github.com/Tyler-Windes']);});
 test(`local outline has actual fragment targets: ${page}`,()=>{const h=read(page),links=anchors(nav(h,'On this page'));assert.ok(links.length>=5);for(const a of links){assert.ok(a.href.startsWith('#'));assert.ok(h.includes(`id="${a.href.slice(1)}"`));}});
}
test('homepage outline matches section order including independent work',()=>assert.deepEqual(anchors(nav(read('index.html'),'On this page')).map(a=>a.href),['#background','#independent-work','#work','#approach','#learning','#connect']));
test('homepage opening action opens flagship; secondary explicitly jumps',()=>{const h=read('index.html'),part=/<div class="hero-actions">([\s\S]*?)<\/div>/.exec(h)?.[1]??'',a=anchors(part);assert.equal(target(a[0]?.href,'index.html'),'/irw/');assert.match(a[0].text,/Read the implementation-readiness case/);assert.equal(a[1]?.href,'#work');assert.match(a[1]?.text,/on this page/);});
test('three homepage cards expose two direct case links and one source action each',()=>{const h=read('index.html'),cards=[...h.matchAll(/<article\b[^>]*aria-labelledby="(?:featured|data|integration)-title"[^>]*>([\s\S]*?)<\/article>/g)];assert.equal(cards.length,3);for(let i=0;i<3;i++){const a=anchors(cards[i][1]);assert.equal(a.filter(a=>target(a.href,'index.html')===destinations[i]).length,2);const actions=cards[i][1].indexOf('class="case-actions');assert.ok(actions>=0);if(i>0)assert.ok(actions<cards[i][1].indexOf('<figure'));assert.ok(a.some(a=>/View .+ evidence on GitHub/.test(a.text)));}});
for(const [page,repo,paths] of artifactSets)test(`two exact evidence files linked: ${page}`,()=>{const a=anchors(read(page));for(const p of paths){const matches=a.filter(x=>x.href===`https://github.com/Tyler-Windes/${repo}/blob/main/${p}`);assert.equal(matches.length,1);assert.match(matches[0].text,/\((CSV|JSON|JSONL)\)/);}});
test('foundation files are explicitly separated from ten-case IRW evidence',()=>{const h=read('irw/index.html'),block=/<div class="artifact-links" id="foundation-artifacts">([\s\S]*?)<\/div>/.exec(h)?.[1]??'';assert.match(block,/eight-case/i);assert.match(block,/separate ten-case/i);assert.match(block,/platform-neutral/);});
test('no literal or encoded em dashes in site HTML or metadata',()=>{for(const p of [...pages,'404.html','projects/implementation-readiness-support-transition.html'])assert.doesNotMatch(read(p),/\u2014|&mdash;|&#0*8212;|&#x0*2014;/i,p);});
test('new cross-case links do not pass through old redirect',()=>{for(const p of pages)assert.ok(anchors(read(p)).every(a=>!a.href?.includes('implementation-readiness-support-transition.html')),p);assert.match(read('projects/implementation-readiness-support-transition.html'),/http-equiv="refresh" content="0; url=\.\.\/irw\/"/);});
test('approved simpler labels and planned status retained',()=>{assert.match(read('projects/workflow-intake-analysis.html'),/>Scope and limitations<\/h2>/);assert.match(read(pages[3]),/>Local implementation<\/dt>/);assert.match(read('irw/index.html'),/>Planned extensions<\/dt>/);assert.match(read('irw/index.html'),/>Planned reporting and Forge extensions<\/h2>/);assert.match(read('irw/index.html'),/remain planned, not implemented or deployed/);});
test('approved intro and failure-history wording are exact',()=>{const h=clean(read('index.html'));assert.ok(h.includes('I started building Amkha Seed LLC in 2016. I later managed its customer requests, vendor relationships, inventory, orders and day-to-day operations.'));assert.ok(h.includes('I kept Validation separate from Done and preserved failed tests until the corrections had been retested.'));});
