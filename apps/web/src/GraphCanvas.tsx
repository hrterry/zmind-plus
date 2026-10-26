import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import { useEffect, useRef } from "react";

import type { GraphView } from "@zmind-plus/core";

interface GraphCanvasProps {
  view: GraphView;
  query: string;
  selectedId: string | undefined;
  onSelect: (nodeId: string) => void;
  onToggle: (nodeId: string, isCollapsed: boolean) => void;
}

const kindColors: Record<string, string> = {
  question: "#f4f1ff",
  hypothesis: "#e8efff",
  critique: "#ffe9e6",
  experiment: "#fff2d6",
  evidence: "#dcf9ec",
  decision: "#d9f6f1",
  proposal: "#eaf0ff",
  claim: "#ecf7ff",
  lesson: "#f2ecff",
  artifact: "#eef1f4",
};

function elementsFor(view: GraphView): ElementDefinition[] {
  const nodes: ElementDefinition[] = view.nodes.map(
    ({ node, hasChildren, isCollapsed, hiddenDescendantCount }) => ({
      data: {
        id: node.id,
        label: isCollapsed
          ? `${node.title}\n+${hiddenDescendantCount} hidden`
          : node.title,
        summary: node.summary,
        kind: node.kind,
        status: node.status,
        color: kindColors[node.kind] ?? "#eef1f4",
        hasChildren,
        isCollapsed,
      },
    }),
  );

  const edges: ElementDefinition[] = view.edges.map((edge) => ({
    data: {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      kind: edge.kind,
    },
  }));

  return [...nodes, ...edges];
}

export function GraphCanvas({
  view,
  query,
  selectedId,
  onSelect,
  onToggle,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Core | null>(null);
  const onSelectRef = useRef(onSelect);
  const onToggleRef = useRef(onToggle);

  onSelectRef.current = onSelect;
  onToggleRef.current = onToggle;

  function activateNode(
    nodeId: string,
    hasChildren: boolean,
    isCollapsed: boolean,
  ) {
    onSelect(nodeId);
    if (hasChildren) onToggle(nodeId, isCollapsed);
  }

  useEffect(() => {
    if (containerRef.current === null) return;

    const graph = cytoscape({
      container: containerRef.current,
      elements: elementsFor(view),
      minZoom: 0.35,
      maxZoom: 2.2,
      pixelRatio: 1,
      style: [
        {
          selector: "node",
          style: {
            "background-color": "data(color)",
            "border-color": "#9aa6b5",
            "border-width": 1,
            color: "#17212b",
            "font-family": "Inter, ui-sans-serif, system-ui",
            "font-size": 12,
            "font-weight": 600,
            height: 68,
            label: "data(label)",
            padding: "10px",
            shape: "round-rectangle",
            "text-halign": "center",
            "text-max-width": "156px",
            "text-overflow-wrap": "anywhere",
            "text-wrap": "wrap",
            "text-valign": "center",
            width: 182,
          },
        },
        {
          selector: "node[status = 'refuted']",
          style: {
            "border-color": "#ec6b5e",
            "border-style": "dashed",
            "border-width": 2,
            opacity: 0.72,
          },
        },
        {
          selector: "node[status = 'active']",
          style: {
            "border-color": "#6d5ce7",
            "border-width": 2,
          },
        },
        {
          selector: "node[?isCollapsed]",
          style: {
            "border-color": "#6d5ce7",
            "border-style": "double",
            "border-width": 4,
          },
        },
        {
          selector: "edge",
          style: {
            "curve-style": "bezier",
            "line-color": "#c5cbd3",
            "target-arrow-color": "#aab3be",
            "target-arrow-shape": "triangle",
            width: 1.5,
          },
        },
        {
          selector: "edge[kind = 'challenges'], edge[kind = 'refutes']",
          style: {
            "line-color": "#ed8277",
            "line-style": "dashed",
            "target-arrow-color": "#ed8277",
          },
        },
        {
          selector: ".selected",
          style: {
            "border-color": "#17212b",
            "border-width": 3,
            "overlay-color": "#6d5ce7",
            "overlay-opacity": 0.08,
            "overlay-padding": 8,
          },
        },
        {
          selector: ".dimmed",
          style: { opacity: 0.12 },
        },
        {
          selector: ".matched",
          style: {
            "border-color": "#6d5ce7",
            "border-width": 3,
          },
        },
      ],
      layout: {
        name: "breadthfirst",
        directed: true,
        spacingFactor: 1.1,
        padding: 28,
        animate: false,
      },
    });

    graph.on("tap", "node", (event) => {
      const nodeId = event.target.id();
      const hasChildren = event.target.data("hasChildren") === true;
      const isCollapsed = event.target.data("isCollapsed") === true;
      onSelectRef.current(nodeId);
      if (hasChildren) onToggleRef.current(nodeId, isCollapsed);
    });

    graphRef.current = graph;

    return () => {
      graph.destroy();
      graphRef.current = null;
    };
  }, [view]);

  useEffect(() => {
    const graph = graphRef.current;
    if (graph === null) return;

    graph.nodes().removeClass("selected dimmed matched");
    graph.edges().removeClass("dimmed");

    if (selectedId !== undefined) {
      graph.getElementById(selectedId).addClass("selected");
    }

    const normalized = query.trim().toLowerCase();
    if (normalized.length > 0) {
      const matches = graph.nodes().filter((node) => {
        const label = String(node.data("label")).toLowerCase();
        const summary = String(node.data("summary")).toLowerCase();
        const kind = String(node.data("kind")).toLowerCase();
        return (
          label.includes(normalized) ||
          summary.includes(normalized) ||
          kind.includes(normalized)
        );
      });
      graph.elements().addClass("dimmed");
      matches.removeClass("dimmed").addClass("matched");
      matches.connectedEdges().removeClass("dimmed");
      matches.neighborhood("node").removeClass("dimmed");
    }
  }, [query, selectedId]);

  return (
    <>
      <div
        className="graph-canvas"
        ref={containerRef}
        aria-label={`Research graph showing ${view.nodes.length} of ${view.totalNodeCount} nodes`}
      />
      <nav className="graph-keyboard-nav" aria-label="Visible research nodes">
        <span>Keyboard graph controls</span>
        {view.nodes.map(({ node, hasChildren, isCollapsed }) => (
          <button
            key={node.id}
            type="button"
            onClick={() => activateNode(node.id, hasChildren, isCollapsed)}
          >
            {hasChildren
              ? `${isCollapsed ? "Expand" : "Fold"} branch: ${node.title}`
              : `Inspect: ${node.title}`}
          </button>
        ))}
      </nav>
    </>
  );
}
