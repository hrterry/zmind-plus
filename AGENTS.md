# Repository Instructions

## Product boundary

Zmind+ is a generic, local-first interface for supervising agent research. Do
not add real project transcripts, customer data, unpublished research results,
absolute workstation paths, credentials, or screenshots containing private
material. Examples and tests must use synthetic, provider-neutral scenarios.

## Workflow

1. Plan non-trivial changes in `docs/` with an ASCII diagram and Mermaid flow.
2. Keep ingestion events immutable; derive UI projections from those events.
3. Use TypeScript strict mode and validate every external payload at runtime.
4. Review each phase, run its focused tests, and commit with Conventional
   Commits.
5. Do not bundle raw prompt or response content into telemetry by default.

## User experience

- Show outcomes and decisions before implementation detail.
- Keep internal identifiers, protocol fields, and raw JSON behind inspection
  controls.
- Make the current activity, unresolved conflict, and requested human decision
  visible without navigation.
- Every destructive or externally visible action requires an explicit user
  gesture.
