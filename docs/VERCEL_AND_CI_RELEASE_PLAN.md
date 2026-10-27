# Vercel Demo and CI Release Plan

## Outcome

Publish the full Zmind+ product story on Vercel while keeping the local runtime
boundary honest. CI must verify both the static public demo and the complete
containerized self-host path before the feature branch is merged.

## Deployment split

```text
                         one shared React application
                                     │
                 ┌───────────────────┴───────────────────┐
                 │                                       │
          Vercel public demo                      local self-host
          ─────────────────                      ───────────────
          landing page                           landing page
          synthetic workbench                    live workbench
          Graph / Brief / replay                 hooks + MCP + JSONL
          no runtime polling                     SSE + SQLite
          no private content                     local persistence
```

The public deployment demonstrates the interaction model. It never claims to
host the user's local runtime, accept private agent events, or persist research.

## Build and routing flow

```mermaid
flowchart LR
  Repo[GitHub repository] --> VBuild[Vercel Vite build]
  VBuild --> Static[apps/web/dist]
  Static --> Landing[/ landing]
  Static --> Workbench[/workbench synthetic demo]

  Repo --> CI[GitHub Actions]
  CI --> Quality[format lint type tests build audit privacy]
  CI --> Containers[Compose build and health checks]
  Containers --> Local[local runtime + SQLite + Nginx]
```

## Product decisions

| Concern       | Decision                     | Reason                                                     |
| ------------- | ---------------------------- | ---------------------------------------------------------- |
| Vercel output | `apps/web/dist`              | Deploy only the browser application                        |
| Public mode   | Compile-time demo-only flag  | Avoid polling or implying a cloud runtime                  |
| Deep links    | SPA fallback to `index.html` | `/workbench` must survive direct navigation                |
| Backend       | Not deployed to Vercel       | The default runtime is stateful, local, and SQLite-backed  |
| Full product  | Docker Compose               | Preserves local gateway, SSE, volume, and privacy boundary |
| CI            | Quality and container jobs   | Validate both public assets and complete self-hosting      |

## Acceptance checks

1. A clean Vercel-style build emits the landing page and workbench assets.
2. Demo-only mode never requests `/api/runs` or opens an SSE connection.
3. `/workbench` is covered by the SPA rewrite.
4. CI runs formatting, type-aware lint, strict types, tests, scale benchmark,
   production build, audit, public-boundary scan, browser checks, and Compose.
5. The container job verifies both the proxied runtime health endpoint and the
   rendered landing-page shell.
6. The workflow is pushed, observed to completion, and only then merged.

## Implementation review

- Root-level Vercel configuration builds only the web workspace and publishes
  `apps/web/dist` with an SPA fallback for `/workbench`.
- A compile-time public-demo boundary prevents run discovery, replay fetches,
  and SSE connections rather than relying on failed network requests.
- Public mode replaces the nonfunctional Import/Export controls with one honest
  Self-host action; the local build retains full data portability.
- A dedicated production-preview browser test opens `/workbench` directly,
  waits beyond the normal discovery interval, and proves zero runtime requests.
- CI includes type-aware lint and the Vercel-mode browser contract in addition
  to the existing quality, scale, privacy, and container gates.
