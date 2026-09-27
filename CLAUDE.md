# CLAUDE.md — Hynish ERP rebuild contract

This repository rebuilds **Hynish Clothing — Wholesale Ledger ERP v2.86.1** as a production-grade React + Firebase app. The rebuild **preserves business behavior** and **replaces technical weaknesses**.

## Read before any work
1. `docs/legacy/TECHNICAL-DOCUMENTATION.md`: the legacy functional source of truth ("TD").
2. `docs/LEGACY-COMPATIBILITY.md`: feature inventory (`LC-*`) and defaults (`DEF-*`).
3. `docs/BUSINESS-RULES.md`: testable rules (`BR-*`).
4. `docs/ARCHITECTURE.md`, `docs/DATA-MODEL.md`, `docs/SECURITY-ARCHITECTURE.md`, `docs/UI-UX-SYSTEM.md`, `docs/PWA-ARCHITECTURE.md`, `docs/MIGRATION-PLAN.md`.
5. `docs/OPEN-QUESTIONS.md`: don't implement anything that depends on an unresolved `OQ-*`. Ask instead.

## Mandatory order of work (every phase)
Read source documentation → inspect existing behavior → identify legacy defaults → identify business rules → identify dependencies → design → implement → test → compare against legacy behavior → fix regressions → document changes.

Never: design UI → guess business logic → build.

## Non-negotiables
- A New Bill opens as **Without GST** (DEF-016). GST and Non-GST invoice series are separate (BR-NUM-01).
- Never remove or simplify a legacy default, setting, validation, warning, workflow, calculation, numbering rule, permission, status, report or document behavior without a documented decision.
- If behavior isn't in the TD or legacy source, don't invent it. Add it to `docs/OPEN-QUESTIONS.md` as **REQUIRES DECISION**. Anything unverified is marked **NOT VERIFIED**.
- Numbering, stock, accounting, payments, GST totals, permissions and location access are **server-authoritative** (Cloud Functions + transactions + rules).
- Money is stored as **integer paise**. GST and other business math exists once, in `packages/domain`.
- No Firestore imports in `features/*` or UI components. UI → hooks/stores → services/repositories → Firebase.
- Strict TypeScript. No `any`, no unsafe casts, no magic strings or numbers (use `packages/domain/constants`), no hard-coded colors (use tokens).
- Don't copy known legacy bugs (LEGACY-COMPATIBILITY §49).

## Tech contract
React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Lucide React, Manrope, React Hook Form, Zod, Zustand, React Router, TanStack Table, Recharts, date-fns, Firebase SDK; Cloud Functions v2 (TS), Firestore, Auth, Storage, App Check, Hosting; GitHub Actions. Additional libraries need approval (OQ-13).

## Required section at the end of every phase report

```
LEGACY COMPATIBILITY CHECK
- Existing defaults preserved:        [list DEF-* touched → status]
- Existing settings preserved:        …
- Existing validations preserved:     …
- Existing calculations preserved:    [BR-* with test names]
- Existing workflows preserved:       …
- Existing permissions preserved:     …
- Existing document behavior preserved: …
- Existing reports preserved:         …
- Existing user-visible behavior preserved: …
- Deviations (with reason / OQ ref):  …
- NOT VERIFIED items touched:         …
```
