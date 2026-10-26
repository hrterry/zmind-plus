import { lazy, Suspense, useEffect, useMemo, useState } from "react";

import {
  createGraphView,
  projectEvents,
  type GraphViewNode,
  type ResearchEdge,
  type ResearchEvent,
  type ResearchNode,
} from "@zmind-plus/core";

import { useResearchRun } from "./useResearchRun";

const GraphCanvas = lazy(async () => {
  const module = await import("./GraphCanvas");
  return { default: module.GraphCanvas };
});

const statusLabel: Record<string, string> = {
  queued: "Queued",
  working: "Working",
  waiting: "Waiting",
  complete: "Complete",
  failed: "Failed",
};

const kindLabel: Record<string, string> = {
  question: "Question",
  hypothesis: "Hypothesis",
  proposal: "Proposal",
  critique: "Critique",
  experiment: "Experiment",
  evidence: "Evidence",
  decision: "Decision",
  claim: "Claim",
  lesson: "Lesson",
  artifact: "Artifact",
};

function runOptionLabel(title: string, updatedAt: string): string {
  const date = new Date(updatedAt);
  const timestamp = Number.isNaN(date.valueOf())
    ? "Local run"
    : new Intl.DateTimeFormat(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(date);
  return `${title} · ${timestamp}`;
}

interface RelatedNode {
  direction: "incoming" | "outgoing";
  edge: ResearchEdge;
  node: ResearchNode;
}

function eventLabel(event: ResearchEvent): string {
  switch (event.type) {
    case "run.started":
      return "Research run started";
    case "research.node.upserted":
      return `${kindLabel[event.payload.node.kind]} · ${event.payload.node.title}`;
    case "research.edge.upserted":
      return `Linked evidence · ${event.payload.edge.kind.replace("_", " ")}`;
    case "agent.status.changed":
      return `${event.payload.agent.label} · ${event.payload.focus}`;
    case "human.attention.requested":
      return `Human decision requested · ${event.payload.reason}`;
  }
}

function Inspector({
  node,
  viewNode,
  relatedNodes,
  onToggle,
}: {
  node: ResearchNode | undefined;
  viewNode: GraphViewNode | undefined;
  relatedNodes: RelatedNode[];
  onToggle: (nodeId: string, isCollapsed: boolean) => void;
}) {
  const [question, setQuestion] = useState("");
  const [askedQuestion, setAskedQuestion] = useState<string>();

  if (node === undefined) {
    return (
      <div className="empty-inspector">
        <span className="empty-mark">+</span>
        <p>Select a node to inspect its evidence and history.</p>
      </div>
    );
  }

  return (
    <div className="inspector-content">
      <div className="eyebrow-row">
        <span className={`kind-chip kind-${node.kind}`}>
          {kindLabel[node.kind]}
        </span>
        <span className={`status-chip status-${node.status}`}>
          {node.status}
        </span>
      </div>
      <h2>{node.title}</h2>
      <p className="node-summary">{node.summary}</p>

      {viewNode?.hasChildren === true && (
        <button
          className="branch-button"
          type="button"
          onClick={() => onToggle(node.id, viewNode.isCollapsed)}
        >
          <span>{viewNode.isCollapsed ? "+" : "−"}</span>
          {viewNode.isCollapsed
            ? `Show ${viewNode.hiddenDescendantCount} related nodes`
            : "Fold related nodes"}
        </button>
      )}

      {node.confidence !== undefined && (
        <section className="detail-section">
          <div className="section-heading">
            <span>Confidence</span>
            <strong>{Math.round(node.confidence * 100)}%</strong>
          </div>
          <div className="confidence-track">
            <span style={{ width: `${node.confidence * 100}%` }} />
          </div>
        </section>
      )}

      <section className="detail-section">
        <span className="detail-label">Provenance</span>
        <div className="provenance-card">
          <span>Source metadata</span>
          <strong>{node.provenance.locator}</strong>
          <small>Content remains local and was not captured.</small>
        </div>
      </section>

      <section className="detail-section">
        <span className="detail-label">Question the conclusion</span>
        {askedQuestion === undefined ? (
          <button
            className="ask-button"
            type="button"
            onClick={() => setAskedQuestion("Why is this current?")}
          >
            Ask why this is current
            <span>↗</span>
          </button>
        ) : (
          <div className="grounded-answer">
            <span>Evidence-linked answer</span>
            <strong>{askedQuestion}</strong>
            <p>
              This node has {relatedNodes.length} direct graph relationship
              {relatedNodes.length === 1 ? "" : "s"} in the current record.
            </p>
            {relatedNodes.length > 0 ? (
              <ul>
                {relatedNodes.map((related) => (
                  <li key={related.edge.id}>
                    <span>{related.edge.kind.replace("_", " ")}</span>
                    <strong>{related.node.title}</strong>
                    <small>
                      {related.direction} · {related.node.status}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <p>No direct evidence relationship has been recorded yet.</p>
            )}
            <small>
              Derived locally from recorded relationships. No question text was
              uploaded.
            </small>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                const nextQuestion = question.trim();
                if (nextQuestion.length > 0) {
                  setAskedQuestion(nextQuestion);
                  setQuestion("");
                }
              }}
            >
              <input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Ask a follow-up…"
                aria-label="Ask a follow-up about this node"
              />
              <button type="submit" disabled={question.trim().length === 0}>
                Ask
              </button>
            </form>
          </div>
        )}
      </section>
    </div>
  );
}

export function App() {
  const { events, mode, runs, selectedRunId, selectRun } = useResearchRun();
  const [visibleCount, setVisibleCount] = useState(events.length);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedId, setSelectedId] = useState<string | undefined>(
    "decision-event-log",
  );
  const [query, setQuery] = useState("");
  const [expandedNodeIds, setExpandedNodeIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [collapsedNodeIds, setCollapsedNodeIds] = useState<Set<string>>(
    () => new Set(),
  );

  const visibleEvents = useMemo(
    () => events.slice(0, visibleCount),
    [events, visibleCount],
  );
  const projection = useMemo(
    () => projectEvents(visibleEvents),
    [visibleEvents],
  );
  const revealNodeIds = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const revealed = new Set<string>();
    if (selectedId !== undefined) revealed.add(selectedId);
    if (normalized.length > 0) {
      for (const node of projection.nodes.values()) {
        if (
          node.title.toLowerCase().includes(normalized) ||
          node.summary.toLowerCase().includes(normalized) ||
          node.kind.includes(normalized)
        ) {
          revealed.add(node.id);
        }
      }
    }
    return revealed;
  }, [projection, query, selectedId]);
  const graphView = useMemo(
    () =>
      createGraphView(projection, {
        defaultExpandedDepth: projection.nodes.size > 120 ? 1 : Infinity,
        expandedNodeIds,
        collapsedNodeIds,
        revealNodeIds,
      }),
    [collapsedNodeIds, expandedNodeIds, projection, revealNodeIds],
  );
  const graphViewById = useMemo(
    () => new Map(graphView.nodes.map((entry) => [entry.node.id, entry])),
    [graphView],
  );
  const selectedNode =
    selectedId === undefined ? undefined : projection.nodes.get(selectedId);
  const relatedNodes = useMemo(() => {
    if (selectedId === undefined) return [];
    const related: RelatedNode[] = [];
    for (const edge of projection.edges.values()) {
      if (edge.source === selectedId) {
        const node = projection.nodes.get(edge.target);
        if (node !== undefined)
          related.push({ direction: "outgoing", edge, node });
      } else if (edge.target === selectedId) {
        const node = projection.nodes.get(edge.source);
        if (node !== undefined)
          related.push({ direction: "incoming", edge, node });
      }
    }
    return related.sort((left, right) =>
      left.edge.id.localeCompare(right.edge.id),
    );
  }, [projection, selectedId]);
  const activeAgents = [...projection.agents.values()];

  useEffect(() => {
    if (!isPlaying) setVisibleCount(events.length);
  }, [events.length, isPlaying]);

  useEffect(() => {
    setExpandedNodeIds(new Set());
    setCollapsedNodeIds(new Set());
    setSelectedId(projection.nodes.keys().next().value);
  }, [projection.runId]);

  useEffect(() => {
    if (!isPlaying) return;
    if (visibleCount >= events.length) {
      setIsPlaying(false);
      return;
    }

    const timer = window.setTimeout(() => {
      setVisibleCount((count) => Math.min(count + 1, events.length));
    }, 620);
    return () => window.clearTimeout(timer);
  }, [events.length, isPlaying, visibleCount]);

  function replay() {
    setSelectedId(projection.nodes.keys().next().value);
    setVisibleCount(Math.min(2, events.length));
    setIsPlaying(true);
  }

  function toggleBranch(nodeId: string, isCollapsed: boolean) {
    if (isCollapsed) {
      setCollapsedNodeIds((current) => {
        const next = new Set(current);
        next.delete(nodeId);
        return next;
      });
      setExpandedNodeIds((current) => new Set(current).add(nodeId));
      return;
    }

    setExpandedNodeIds((current) => {
      const next = new Set(current);
      next.delete(nodeId);
      return next;
    });
    setCollapsedNodeIds((current) => new Set(current).add(nodeId));
  }

  const connectionLabel = {
    connecting: "Connecting to local runtime…",
    live: "Live from local runtime",
    reconnecting: "Reconnecting · showing committed events",
    demo: "Local synthetic demo",
  }[mode];

  return (
    <main className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" aria-label="Zmind+ home">
          <span className="brand-glyph">Z</span>
          <span>
            Zmind<sup>+</sup>
          </span>
        </a>

        <div className="run-identity">
          <span className={`live-dot connection-${mode}`} />
          <div>
            {runs.length > 1 ? (
              <select
                aria-label="Select research run"
                value={selectedRunId}
                onChange={(event) => selectRun(event.target.value)}
              >
                {runs.map((run) => (
                  <option key={run.id} value={run.id}>
                    {runOptionLabel(run.title, run.updatedAt)}
                  </option>
                ))}
              </select>
            ) : (
              <strong>{projection.title ?? "Preparing research run"}</strong>
            )}
            <span>{connectionLabel}</span>
          </div>
        </div>

        <div className="top-actions">
          <button className="ghost-button" onClick={replay} type="button">
            <span>↻</span> Replay
          </button>
        </div>
      </header>

      <section className="attention-bar">
        <div>
          <span className="attention-icon">!</span>
          <strong>Human judgment requested</strong>
          <span>
            {projection.attention.at(-1)?.reason ??
              "The agents are gathering evidence. No decision is needed yet."}
          </span>
        </div>
        <button
          type="button"
          disabled={projection.attention.length === 0}
          onClick={() => setSelectedId(projection.attention.at(-1)?.nodeId)}
        >
          Review decision
        </button>
      </section>

      <div className="workspace-grid">
        <aside className="agents-panel panel">
          <div className="panel-heading">
            <div>
              <span className="overline">Live delegation</span>
              <h1>Workstreams</h1>
            </div>
            <span className="count-pill">{activeAgents.length}</span>
          </div>

          <div className="agent-list">
            {activeAgents.map((activity, index) => (
              <article className="agent-card" key={activity.agent.id}>
                <div className={`agent-avatar avatar-${index + 1}`}>
                  {activity.agent.label.slice(0, 1)}
                </div>
                <div className="agent-copy">
                  <div>
                    <strong>{activity.agent.label}</strong>
                    <span className={`agent-state state-${activity.status}`}>
                      {statusLabel[activity.status]}
                    </span>
                  </div>
                  <p>{activity.focus}</p>
                </div>
              </article>
            ))}
            {activeAgents.length === 0 && (
              <p className="quiet-copy">Waiting for delegation events…</p>
            )}
          </div>

          <div className="privacy-card">
            <span className="privacy-icon">◇</span>
            <div>
              <strong>Local by default</strong>
              <p>
                Raw content capture is off. Only source metadata is projected.
              </p>
            </div>
          </div>
        </aside>

        <section className="graph-panel panel">
          <div className="graph-toolbar">
            <div>
              <span className="overline">Living research graph</span>
              <strong>
                {projection.objective ?? "Waiting for the objective"}
              </strong>
              <span className="graph-count">
                {graphView.nodes.length} visible
                {graphView.hiddenNodeCount > 0
                  ? ` · ${graphView.hiddenNodeCount} folded`
                  : " · complete view"}
              </span>
            </div>
            <label className="search-box">
              <span>⌕</span>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Find evidence, critique, decision…"
                aria-label="Search research graph"
              />
              <kbd>⌘ K</kbd>
            </label>
          </div>

          <div className="graph-stage">
            <Suspense
              fallback={
                <div className="graph-loading" role="status">
                  <span />
                  <strong>Preparing the research graph…</strong>
                </div>
              }
            >
              <GraphCanvas
                view={graphView}
                query={query}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onToggle={toggleBranch}
              />
            </Suspense>
            <div className="graph-legend">
              <span>
                <i className="legend-dot dot-active" /> Active
              </span>
              <span>
                <i className="legend-dot dot-evidence" /> Evidence
              </span>
              <span>
                <i className="legend-line" /> Challenge / refute
              </span>
              <span className="legend-fold">Double border = folded branch</span>
            </div>
            <div className="zoom-hint">Scroll to zoom · drag to explore</div>
          </div>
        </section>

        <aside className="inspector-panel panel">
          <div className="panel-heading inspector-heading">
            <div>
              <span className="overline">Inspector</span>
              <h1>Why this matters</h1>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="Close inspector"
              onClick={() => setSelectedId(undefined)}
            >
              ×
            </button>
          </div>
          <Inspector
            key={selectedId ?? "empty"}
            node={selectedNode}
            viewNode={
              selectedId === undefined
                ? undefined
                : graphViewById.get(selectedId)
            }
            relatedNodes={relatedNodes}
            onToggle={toggleBranch}
          />
        </aside>
      </div>

      <footer className="timeline-panel panel">
        <div className="timeline-controls">
          <button
            className="play-button"
            type="button"
            onClick={() => setIsPlaying((playing) => !playing)}
            aria-label={isPlaying ? "Pause replay" : "Play replay"}
          >
            {isPlaying ? "Ⅱ" : "▶"}
          </button>
          <div>
            <span className="overline">Event replay</span>
            <strong>
              {visibleCount} / {events.length}
            </strong>
          </div>
        </div>
        <input
          className="timeline-range"
          type="range"
          min="1"
          max={Math.max(events.length, 1)}
          value={visibleCount}
          onChange={(event) => {
            setIsPlaying(false);
            setVisibleCount(Number(event.target.value));
          }}
          aria-label="Replay position"
        />
        <div className="latest-event">
          <span className="event-pulse" />
          <div>
            <span>Latest event</span>
            <strong>{eventLabel(visibleEvents.at(-1)!)}</strong>
          </div>
        </div>
      </footer>
    </main>
  );
}
