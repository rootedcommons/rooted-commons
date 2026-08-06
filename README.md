# Rooted Commons v2.9.15

Rooted Commons is an Astro website backed by Baserow. Baserow is the operational source of truth; the web host stores no authoritative business state. Xero can be used as the source for reconciled member payments.

This package has been reorganised so that documentation describes the **current release**, rather than retaining a separate setup note for every historical version. Historical changes remain in `CHANGELOG.md` and Git history.

## Start here

1. Read [`docs/GETTING-STARTED.md`](docs/GETTING-STARTED.md).
2. Build or verify Baserow using [`docs/BASEROW-SETUP.md`](docs/BASEROW-SETUP.md).
3. Configure and deploy using [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).
4. Use [`docs/OPERATIONS.md`](docs/OPERATIONS.md) for the live weekly workflow.
5. Use [`docs/TECHNICAL-REFERENCE.md`](docs/TECHNICAL-REFERENCE.md) for architecture, CMS options and testing.

## Application

Requirements: Node.js 22 and npm.

```bash
npm install
cp .env.example .env
npm run dev
```

Production build:

```bash
npm run build
```

The existing `baserow-imports/` and `baserow-table-specification/` folders are retained unchanged in this housekeeping release. They will be rebuilt from clean live exports for v3.0.
