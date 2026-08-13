# Tyler Windes Portfolio

Source for [tyler-windes.com](https://tyler-windes.com/), a static professional portfolio focused on systems analysis, workflow validation, SQL-backed evidence, and implementation-ready documentation. The GitHub Pages hosting repository remains `Tyler-Windes/Tyler-Windes.github.io`; that repository identity is distinct from the public website identity.

The site currently includes:

- a role-led portfolio home page;
- a verified [Workflow Intake Analysis Demo](https://tyler-windes.com/projects/workflow-intake-analysis.html) case study;
- accessible, responsive HTML and CSS with no client-side JavaScript;
- no analytics, forms, cookies, trackers, runtime APIs, external assets, or direct contact collection.

## Local use

Node.js 24.18.1 is the reviewed runtime. The project has no package dependencies.

```text
npm run build
npm run validate
npm run dev
```

`npm run build` copies the committed static source and assets byte-for-byte into `dist/`. `npm run validate` rebuilds the site and checks the source contract, exact source/build parity, route and fragment integrity, canonical and social metadata, robots and sitemap files, accessibility structure, responsive CSS, public URL allowlist, and privacy boundaries.

## Site address authority

`content/site/site-config.json` is the one committed authority for the public site base URL. The build derives canonical URLs, `og:url`, absolute `og:image` URLs, `robots.txt`, `sitemap.xml`, and public schema identifiers from `site_base_url`; validation reads the same authority and checks the generated result. The current value is `https://tyler-windes.com`.

For the later separately authorized move to `https://tylerwindes.com`, change only `site_base_url`, then run the full validation, deployment, redirect, and signed-out readback gates. DNS, Cloudflare, and GitHub Pages domain settings remain separate infrastructure actions. No redirect for `tylerwindes.com` is configured here.

The homepage education section is controlled by `content/site/education.json` and the closed `content/schemas/public-education-content.schema.json` contract. The contract records the University of Denver boot camp as completed technical training and preserves Colorado State University and University of Northern Colorado as coursework, not degrees.

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

The featured project uses synthetic data and is a professional-quality demonstration, not a production deployment or a claim of measured business outcomes. The repository publishes no résumé or direct contact route.

## License

The site source is available under the [MIT License](LICENSE).
