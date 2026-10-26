# Foundation Research Notes

Date: 2026-10-26

## Research question

What should a local-first interface add beyond existing agent observability and
trace tools?

## Finding 1: execution traces are necessary, but not sufficient

OpenTelemetry's GenAI conventions standardize operations, models, token usage,
finish reasons, tool calls, and optional message content. This is the right
interoperability layer, but it describes execution rather than the lifecycle of
a research claim.

Zmind+ therefore accepts trace-shaped input while maintaining a separate
research domain model. `invoke_agent`, `chat`, and `execute_tool` events can
support a higher-level chain such as `hypothesis → critique → experiment →
evidence → decision`.

Sources:

- [OpenTelemetry semantic conventions](https://opentelemetry.io/docs/specs/semconv/)
- [GenAI observability walkthrough](https://opentelemetry.io/blog/2026/genai-observability/)

## Finding 2: current self-hosted tools optimize for engineering observability

Phoenix provides traces, evaluations, datasets, experiments, prompt iteration,
and local SQLite deployment. Langfuse provides a broad self-hosted observability
stack. Both validate the demand for local ownership and standard telemetry.

The product opportunity is not a weaker copy of either system. Zmind+ focuses on
human supervision of multi-agent inquiry: disagreement, evidence lineage,
conclusion reversal, and the point at which human judgment is requested.

Sources:

- [Phoenix architecture](https://arize.com/docs/phoenix/self-hosting/deployment)
- [Phoenix workflow overview](https://arize.com/docs/phoenix/quickstart)
- [Langfuse self-hosting](https://langfuse.com/faq/all/self-hosting-langfuse)

## Finding 3: content capture must be opt-in

Prompts, completions, tool inputs, tool results, and file content are valuable
for debugging but may be large or sensitive. OpenTelemetry treats full GenAI
message content as optional. Zmind+ should ingest metadata and stable digests by
default, with explicit local content capture and export redaction policies.

Source:

- [OpenTelemetry convention design guidance](https://opentelemetry.io/docs/specs/semconv/how-to-write-conventions/)

## Finding 4: one graph renderer may not cover every scale

Cytoscape.js provides mature graph interaction and compound nodes, which match
collapsible workstreams. Its documentation also identifies compound-node and
edge-selector costs. Sigma.js uses WebGL and targets graphs with thousands of
nodes and edges, but offers a lower-level interaction model.

The first implementation should place graph operations behind a renderer
adapter and benchmark real interaction patterns before committing permanently.

Sources:

- [Cytoscape.js documentation](https://js.cytoscape.org/)
- [Sigma.js documentation](https://www.sigmajs.org/)

## Product gap

```text
                        execution detail   research meaning   human control
Trace/observability           high               low              medium
Workflow builders             medium             low              high
Static research maps          low                high             low
Zmind+ target                 high               high             high
```

The defensible unit is the **living research graph**: a deterministic,
source-addressable projection that joins runtime activity with structured
claims, evidence, critiques, and revisions.

