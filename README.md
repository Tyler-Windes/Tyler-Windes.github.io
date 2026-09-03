# Tyler Windes Portfolio - Three Project Site

Source for [tyler-windes.com](https://tyler-windes.com/), a static site that brings three related work samples into one consistent project path.

The site presents:

- **Workflow Intake Analysis Demo** - workflow analysis, data validation, Python, SQL, API contracts, testing, and traceability
- **Implementation Readiness and Support Transition** - a platform-neutral foundation connected to the IRW Jira and Confluence implementation, including requirements, UAT, Bug correction, readiness, rollback, and handoff
- **SaaS Integration Reliability and Support Troubleshooting** - local API contracts, mapping, idempotency, retry, dead letter, replay, reconciliation, and troubleshooting

All project data and scenarios are fictional. The site does not claim customer work, production deployment, measured outcomes, or tools that were not actually implemented and tested.

## Canonical project routes

- `https://tyler-windes.com/projects/workflow-intake-analysis.html`
- `https://tyler-windes.com/irw/`
- `https://tyler-windes.com/projects/saas-integration-reliability-support-troubleshooting.html`

The previous implementation-readiness route remains as a redirect to `/irw/` so existing links continue to work.

## Project repositories

- `https://github.com/Tyler-Windes/workflow-intake-analysis-demo`
- `https://github.com/Tyler-Windes/implementation-readiness-support-transition`
- `https://github.com/Tyler-Windes/saas-integration-reliability-support-troubleshooting`

The implementation-readiness repository contains the platform-neutral foundation. The live IRW Jira and Confluence workspace is the Atlassian implementation layer of the same project area. The foundation uses eight synthetic validation cases; IRW uses a separate ten-requirement and ten-test model.

## Local use

Node.js 24.18.1 is the reviewed runtime. The site has no package dependencies, client-side JavaScript, analytics, forms, cookies, trackers, runtime APIs, or third-party assets.

```text
npm run build
npm run validate
npm run dev
```

The build copies committed static source and assets to `dist`, resolves `{{SITE_BASE_URL}}` from `content/site/site-config.json`, generates `robots.txt` and `sitemap.xml`, and writes a deterministic manifest to `validation/build-manifest.json`.

## Content and validation

`content/schemas/public-project-content.schema.json` is the shared project-content contract. The validation scripts check:

- The exact public input and build file sets
- Canonical URLs and social metadata
- Internal and approved external links
- The three-project homepage structure
- The two-layer implementation-readiness narrative
- The canonical `/irw/` route and legacy redirect
- Fictional and non-production scope boundaries
- Accessible page structure
- Deterministic build parity and file hashes
- Absence of local paths, unresolved tokens, and review-stage residue

## Site address

`content/site/site-config.json` controls the public base URL. The current value is `https://tyler-windes.com`.

For a later domain move, change only `site_base_url`, then run the full validation, deployment, redirect, and signed-out review process. DNS, Cloudflare, and GitHub Pages settings remain separate infrastructure actions.

## Deployment

GitHub Pages deploys only from validated pushes to `main`. Pull requests run the same public validation without deploying. The workflow uses least-privilege permissions, the `github-pages` environment, deployment concurrency, and immutable action commit pins.

## Current roadmap

The IRW core v1.0 work is complete. The next phase contains:

- Jira saved filters and a small status dashboard
- A read-only Forge readiness component

The Forge design is complete, and the certification path and hands-on preparation are in progress. No Forge source, app identity, build, deployment, installation, or runtime result is claimed yet.

## Scope

This repository controls the static site source. Jira and Confluence configuration, DNS, Cloudflare, LinkedIn, resumes, email, and other career materials remain separately managed.

## License

The site source is available under the [MIT License](LICENSE).
