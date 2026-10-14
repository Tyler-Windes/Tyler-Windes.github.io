import test from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';

// This regression catches a broken workflow entrypoint, not a surrogate validator.
// Run against an isolated input copy so the build never changes the source fixture.
test('the actual npm run validate accepts the approved portfolio candidate', () => {
  assert.ok(process.env.PORTFOLIO_TEST_ROOT, 'Set PORTFOLIO_TEST_ROOT to an isolated site copy');
  assert.ok(process.env.PORTFOLIO_TEST_EVIDENCE, 'Set PORTFOLIO_TEST_EVIDENCE to an evidence directory');
  const cwd = resolve(process.env.PORTFOLIO_TEST_ROOT);
  const evidence = resolve(process.env.PORTFOLIO_TEST_EVIDENCE);
  mkdirSync(evidence, { recursive: true });
  const started = new Date().toISOString();
  let status = 0, stdout = '', stderr = '';
  try {
    stdout = execSync('npm run validate', { cwd, encoding: 'utf8', timeout: 60000,
      stdio: 'pipe', windowsHide: true });
  } catch (error) {
    status = error.status ?? -1;
    stdout = String(error.stdout ?? '');
    stderr = String(error.stderr ?? error.message);
  }
  writeFileSync(join(evidence, 'npm-validate.stdout.log'), stdout);
  writeFileSync(join(evidence, 'npm-validate.stderr.log'), stderr);
  writeFileSync(join(evidence, 'entrypoint.json'), JSON.stringify({
    command: 'npm run validate', cwd, started, completed: new Date().toISOString(),
    exit_code: status, node: process.version, platform: process.platform,
  }, null, 2) + '\n');
  assert.equal(status, 0, `The actual CI entrypoint rejected the accepted candidate:\n${stdout}\n${stderr}`);
});
