# Hynish Clothing — Wholesale Ledger ERP (rebuild)

This is a production-grade rebuild of the legacy Hynish Clothing ERP (v2.86.1). It is a React + TypeScript PWA, and Firebase Cloud Functions are authoritative for numbering, stock, accounting and permissions.

**Status: Phase 0 (specification and compatibility contract).** No application code yet.

## Documents

| Document | Purpose |
|---|---|
| [docs/legacy/TECHNICAL-DOCUMENTATION.md](docs/legacy/TECHNICAL-DOCUMENTATION.md) | Legacy app reference (source of truth) |
| [docs/LEGACY-COMPATIBILITY.md](docs/LEGACY-COMPATIBILITY.md) | Inventory of every legacy feature and default, and how it is carried forward |
| [docs/BUSINESS-RULES.md](docs/BUSINESS-RULES.md) | Testable business rules (GST, numbering, stock, accounting, …) |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Target architecture, Cloud Functions, realtime, testing, deployment |
| [docs/DATA-MODEL.md](docs/DATA-MODEL.md) | Firestore data model, money in paise, invariants |
| [docs/SECURITY-ARCHITECTURE.md](docs/SECURITY-ARCHITECTURE.md) | Auth, membership, permissions, location enforcement, rules, App Check |
| [docs/UI-UX-SYSTEM.md](docs/UI-UX-SYSTEM.md) | Design tokens, light/dark/system theme, components, responsive patterns |
| [docs/PWA-ARCHITECTURE.md](docs/PWA-ARCHITECTURE.md) | Manifest, service worker, updates, install UX, safe areas |
| [docs/MIGRATION-PLAN.md](docs/MIGRATION-PLAN.md) | Legacy → new data migration, verification, rollback |
| [docs/OPEN-QUESTIONS.md](docs/OPEN-QUESTIONS.md) | Decisions needed before the phases they block |

Contributor and agent rules are in [CLAUDE.md](CLAUDE.md).
