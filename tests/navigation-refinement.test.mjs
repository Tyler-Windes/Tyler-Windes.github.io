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
test('approved intro and failure-history wording are exact',()=>{const h=clean(read('index.html'));assert.ok(h.includes('I design, build and improve AI-enabled workflows and tools for document processing, information organization and practical automation. Running Amkha Seed LLC gave me the business perspective to connect that technical work with customer needs, operating constraints and dependable handoffs.'));assert.ok(h.includes('I kept Validation separate from Done and preserved failed tests until the corrections had been retested.'));});


// IRW portable companion: public reader, exact static PDF and real preview HTTP.
test('IRW companion card distinguishes public reader, PDF and authenticated workspace',()=>{
  const card=/<div class="project-link-list">([\s\S]*?)<\/div>/.exec(read('irw/index.html'))?.[1]??'';
  const links=anchors(card);
  assert.ok(links.some(a=>a.href==='https://tyler-windes.atlassian.net/wiki/external/ZTAyNWZlYmYyYTJiNGUwMzkyNGEyZWY4YmI3NGNhOTM'&&a.text==='Read the Atlassian case study - no sign-in'),'IRW_PUBLIC_READER_MISSING');
  assert.ok(links.some(a=>a.href==='../assets/documents/IRW_Case_Study_and_Selected_Evidence.pdf'&&a.text==='Download the case study and selected evidence (PDF)'),'IRW_PDF_LINK_MISSING');
  assert.ok(links.some(a=>a.href==='https://github.com/Tyler-Windes/implementation-readiness-support-transition'),'IRW_FOUNDATION_LINK');
  assert.ok(links.some(a=>a.href==='https://tyler-windes.atlassian.net/wiki/spaces/~7120203b004a0c07184b39860e66e497b78dd0/pages/426169'&&/workspace.*sign-in required/i.test(a.text)),'IRW_AUTHENTICATED_WORKSPACE_LABEL');
});
test('IRW companion is a seven-page static PDF source copied exactly by build',()=>{
  let pdf;try{pdf=readFileSync(join(root,'assets/documents/IRW_Case_Study_and_Selected_Evidence.pdf'));}catch{assert.fail('IRW_PDF_SOURCE_MISSING');}
  assert.equal(pdf.subarray(0,5).toString(),'%PDF-','IRW_PDF_MAGIC');
  assert.match(pdf.subarray(-32).toString(),/%%EOF\s*$/,'IRW_PDF_EOF');
  assert.equal((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g)||[]).length,7,'IRW_PDF_SEVEN_PAGES');
  assert.deepEqual(readFileSync(join(root,'dist/assets/documents/IRW_Case_Study_and_Selected_Evidence.pdf')),pdf,'IRW_PDF_BUILD_PARITY');
});
test('IRW PDF preview serves application/pdf with exact bytes and nosniff',async()=>{
  const {createServer}=await import('node:net');const {spawn}=await import('node:child_process');
  const reservation=createServer();await new Promise(r=>reservation.listen(0,'127.0.0.1',r));const port=reservation.address().port;await new Promise(r=>reservation.close(r));
  const proc=spawn(process.execPath,[join(root,'scripts/serve.mjs'),'--root',join(root,'dist'),'--port',String(port)],{stdio:['ignore','pipe','pipe'],windowsHide:true});
  let stdout='',stderr='';proc.stdout.on('data',b=>{stdout+=b});proc.stderr.on('data',b=>{stderr+=b});let closed=false;proc.once('exit',()=>closed=true);
  try{
    for(let i=0;i<100&&!stdout.includes('Local URL:')&&!closed;i++)await new Promise(r=>setTimeout(r,20));
    assert.ok(stdout.includes('Local URL:'),'IRW_PREVIEW_START '+stderr);
    const response=await fetch(`http://127.0.0.1:${port}/assets/documents/IRW_Case_Study_and_Selected_Evidence.pdf`);
    assert.equal(response.status,200,'IRW_PDF_HTTP_STATUS');assert.match(response.headers.get('content-type'),/^application\/pdf(?:;|$)/,'IRW_PDF_HTTP_MIME');
    assert.equal(response.headers.get('x-content-type-options'),'nosniff');
    assert.deepEqual(Buffer.from(await response.arrayBuffer()),readFileSync(join(root,'assets/documents/IRW_Case_Study_and_Selected_Evidence.pdf')),'IRW_PDF_HTTP_BYTES');
  }finally{if(!closed)proc.kill();for(let i=0;i<100&&!closed;i++)await new Promise(r=>setTimeout(r,20));assert.ok(closed,'IRW_OWNED_PREVIEW_CLOSED');}
});

import {readFileSync as fileRead,writeFileSync as fileWrite} from 'node:fs';

for (const [name, mutate, expected] of [
  ['missing authenticated label',r=>{const p=join(r,'src/irw/index.html');fileWrite(p,fileRead(p,'utf8').replace('Open the Atlassian workspace - sign-in required','Open the Atlassian workspace'));},'V3_IRW_COMPANION_ACCESS'],
  ['wrong public reader',r=>{const p=join(r,'src/irw/index.html');fileWrite(p,fileRead(p,'utf8').replace('wiki/external/ZTAyNWZlYmYyYTJiNGUwMzkyNGEyZWY4YmI3NGNhOTM','wiki/external/unapproved-reader'));},'V3_IRW_COMPANION_ACCESS'],
  ['corrupted PDF bytes',r=>fileWrite(join(r,'assets/documents/IRW_Case_Study_and_Selected_Evidence.pdf'),'not a PDF'),'V3_IRW_PDF_ASSET'],
]) test('IRW validator rejects '+name,async()=>{
  const {cpSync,mkdtempSync,mkdirSync}=await import('node:fs');const {spawnSync}=await import('node:child_process');
  assert.ok(process.env.PORTFOLIO_FIXTURE_ROOT&&process.env.PORTFOLIO_TEST_EVIDENCE,'Isolated D fixture/evidence paths required');
  mkdirSync(process.env.PORTFOLIO_FIXTURE_ROOT,{recursive:true});const r=mkdtempSync(join(process.env.PORTFOLIO_FIXTURE_ROOT,'irw-'));
  cpSync(root,r,{recursive:true,filter:p=>!/(?:^|[\\/])(?:dist|validation|node_modules|\.git)(?:[\\/]|$)/.test(p)});
  mutate(r);const build=spawnSync(process.execPath,['scripts/build.mjs'],{cwd:r,encoding:'utf8',windowsHide:true});assert.equal(build.status,0,build.stderr);
  const result=spawnSync(process.execPath,['scripts/validate-public-v3.mjs'],{cwd:r,encoding:'utf8',windowsHide:true});
  const report=JSON.parse(fileRead(join(r,'validation/portable-v3/public-validation.json'),'utf8'));const failed=report.checks.filter(c=>c.result==='FAIL').map(c=>c.id);
  assert.notEqual(result.status,0,'Invalid companion must fail closed');assert.ok(failed.includes(expected),'Missing rejection '+expected+': '+failed);
  fileWrite(join(process.env.PORTFOLIO_TEST_EVIDENCE,'irw-'+name.replaceAll(' ','-')+'.json'),JSON.stringify({name,exit_code:result.status,failed_check_ids:failed,run_id:report.run_id,report,stdout:result.stdout,stderr:result.stderr},null,2)+'\n');
});
