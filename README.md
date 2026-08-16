# Tyler Windes Portfolio — Three-Project Publication Source

Source for [tyler-windes.com](https://tyler-windes.com/), the public narrative layer for three distinct technical and implementation work samples. The GitHub Pages hosting repository remains `Tyler-Windes/Tyler-Windes.github.io`; that repository identity is distinct from the public website identity.

This static-site source brings three distinct work samples into one recruiter-facing portfolio:

- **Workflow Intake Analysis Demo** — workflow analysis, data validation, Python, SQL, API contracts, testing, and traceability;
- **Implementation Readiness & Support Transition** — requirements, readiness, synthetic UAT, retest judgment, rollback, enablement, and support handoff; and
- **SaaS Integration Reliability & Support Troubleshooting** — local API contracts, mapping, idempotency, retry, dead letter, replay, reconciliation, and operator troubleshooting.

All project data and scenarios are synthetic. The site does not claim client work, employer implementation, production operation, real UAT, real go-live, measured outcomes, or n8n proficiency.

## Verified project repositories

The published project pages link to the verified public repositories:

- `https://github.com/Tyler-Windes/implementation-readiness-support-transition`
- `https://github.com/Tyler-Windes/saas-integration-reliability-support-troubleshooting`

`npm run validate` performs the complete public-source gate and fails closed if either repository URL is missing or if an unresolved publication token remains.

## Local use

Node.js 24.18.1 is the reviewed runtime. The site has no package dependencies, client-side JavaScript, analytics, forms, cookies, trackers, runtime APIs, or third-party assets.

```text
npm run build
npm run validate
npm run dev
```

The build copies committed static source and assets to `dist`, resolves `{{SITE_BASE_URL}}` from `content/site/site-config.json`, generates `robots.txt` and `sitemap.xml`, and writes a deterministic manifest to `validation/build-manifest.json`.

## Content contracts

`content/schemas/public-project-content.schema.json` is the shared project-content contract. Version 2 preserves the existing Workflow Intake Analysis content shape and adds the published case-study shape used by the readiness and integration projects. Their project IDs and exact published-state vocabulary remain structured metadata and are not rendered in the employer-facing pages.

Education remains controlled by `content/site/education.json` and `content/schemas/public-education-content.schema.json`. It distinguishes the completed University of Denver technical-training program from degrees and preserves Colorado State University and the University of Northern Colorado as coursework only.

## Site address authority

`content/site/site-config.json` is the committed authority for the employer-facing base URL. The build derives canonical URLs, `og:url`, absolute social-preview URLs, robots, and sitemap entries from `site_base_url`. The current value is `https://tyler-windes.com`.

For any later separately authorized domain move, change only `site_base_url`, then run the full validation, deployment, redirect, and signed-out readback gates. DNS, Cloudflare, and GitHub Pages settings remain separate infrastructure actions.

## Deployment

GitHub Pages deploys only from validated pushes to `main`. Pull requests run the same public validation without deploying. The workflow uses least-privilege job permissions, the `github-pages` environment, deployment concurrency, and immutable action commit pins.

Action pins reviewed on 2026-08-13:

| Action | Reviewed release | Commit SHA |
| --- | --- | --- |
| `actions/checkout` | `v7.0.1` | `3d3c42e5aac5ba805825da76410c181273ba90b1` |
| `actions/setup-node` | `v7.0.0` | `820762786026740c76f36085b0efc47a31fe5020` |
| `actions/configure-pages` | `v6.0.0` | `45bfe0192ca1faeb007ade9deae92b16b8254a0d` |
| `actions/upload-pages-artifact` | `v5.0.0` | `fc324d3547104276b827a68afc52ff2a11cc49c9` |
| `actions/deploy-pages` | `v5.0.0` | `cd2ce8fcbc39b97be8ca5fce6e763baed58fa128` |

## Scope

This repository controls the static site source. Deployment, DNS, Cloudflare, profiles, Job Search, résumés, email, and messaging remain separately governed surfaces.

## License

The site source is available under the [MIT License](LICENSE).
