import { runPublicationValidation } from "./validation-core.mjs";

const report = runPublicationValidation({ allowRepositoryTokens: true });
process.stdout.write(`${report.terminal}: ${report.passed_count}/${report.check_count} checks passed.\n`);
if (report.result !== "PASS") {
  for (const check of report.checks.filter((item) => item.result === "FAIL")) {
    process.stderr.write(`${check.id}: ${check.detail}\n`);
  }
  process.exitCode = 1;
}
