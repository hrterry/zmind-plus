# Zmind+

**The open-source interface for supervising agent research.**

Zmind+ turns sprawling agent sessions into a live, inspectable map of questions,
hypotheses, critiques, experiments, evidence, and decisions. It is local-first,
provider-neutral, and designed for humans who need to stay in control without
reading every token.

> See every hypothesis. Challenge every conclusion.

## Why Zmind+

Trace viewers are good at showing calls, latency, and failures. Research work has
a different shape: conclusions change, reviewers challenge assumptions, evidence
conflicts, and experiments invalidate earlier wins. Zmind+ preserves that shape.

```text
question
  ├─ hypothesis A ─ critique ─ experiment ─ evidence ─ supported
  ├─ hypothesis B ─ critique ─ experiment ─ evidence ─ refuted
  └─ open question ─ delegated expert ─ waiting for evidence
```

The default view answers three questions:

1. What are the agents doing now?
2. Where is the important disagreement?
3. Where does human judgment add the most value?

## Product principles

- **Local first:** raw transcripts and artifacts stay on the user's machine.
- **Human legibility:** show research meaning, not internal IDs or raw JSON.
- **Evidence over confidence:** every conclusion can be traced to its support.
- **Reversible projections:** immutable events produce graphs, timelines, and
  documents without destroying history.
- **Provider neutral:** adapters may support any agent runtime or event source.
- **Public-safe development:** the repository contains only synthetic scenarios.

## Project status

Zmind+ is in foundation development. The current milestone is a runnable local
workbench backed by a typed event protocol and a synthetic multi-agent research
scenario.

See [Product and architecture](docs/PRODUCT_AND_ARCHITECTURE.md) and
[Research notes](docs/RESEARCH_NOTES.md). The progressive-disclosure strategy
and scale budgets are documented in
[Graph scale plan](docs/GRAPH_SCALE_PLAN.md).

## Run the workbench

Requirements: Node.js 24 or newer.

```bash
git clone https://github.com/hrterry/zmind-plus.git
cd zmind-plus
git switch codex/foundation
npm install
npm run dev
```

Open [http://127.0.0.1:4310](http://127.0.0.1:4310). This starts both the local
runtime and the workbench. Until a run is ingested, the interface clearly stays
in Demo mode. To exercise the complete SQLite and SSE path, run this in a second
terminal:

```bash
npm run seed:demo
```

The included scenario is fully synthetic and demonstrates delegation, critique,
experimentation, evidence, conclusion reversal, and a human decision request.

Quality checks:

```bash
npm run format:check
npm run typecheck
npm test
npm run benchmark:graph
npx playwright install chromium
npm run test:e2e
npm run build
```

The graph benchmark generates provider-neutral corpora at 1k, 5k, and 20k
nodes. Browser binaries are cached on the development machine and are never
committed to the repository.

## License

[MIT](LICENSE)
