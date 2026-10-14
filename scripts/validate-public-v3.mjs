import { runPortableValidation } from './validation-core-v3.mjs';

const report = runPortableValidation();
process.stdout.write(`${report.terminal}: ${report.passed_count}/${report.check_count} checks passed.\n`);
for (const check of report.checks.filter(c => c.result === 'FAIL')) {
  process.stderr.write(`${check.id}: ${check.detail}\n`);
}
process.exitCode = report.result === 'PASS' ? 0 : 1;
