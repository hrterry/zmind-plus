import cytoscape, { type Core, type ElementDefinition } from "cytoscape";
import { useEffect, useRef } from "react";

import type { ResearchProjection } from "@zmind-plus/core";

interface GraphCanvasProps {
  projection: ResearchProjection;
  query: string;
  selectedId?: string;
  onSelect: (nodeId: string) => void;
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

function elementsFor(projection: ResearchProjection): ElementDefinition[] {
  const nodes: ElementDefinition[] = [...projection.nodes.values()].map(
    (node) => ({
      data: {
        id: node.id,
        label: node.title,
        kind: node.kind,
        status: node.status,
        color: kindColors[node.kind] ?? "#eef1f4",
      },
    }),
  );

  const edges: ElementDefinition[] = [...projection.edges.values()].map(
    (edge) => ({
      data: {
        id: edge.id,
        source: edge.source,
        target: edge.target,
        kind: edge.kind,
      },
    }),
  );

  return [...nodes, ...edges];
}

export function GraphCanvas({
  projection,
  query,
  selectedId,
  onSelect,
}: GraphCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<Core | null>(null);
  const onSelectRef = useRef(onSelect);

  onSelectRef.current = onSelect;

  useEffect(() => {
    if (containerRef.current === null) return;

    const graph = cytoscape({
      container: containerRef.current,
      elements: elementsFor(projection),
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
      onSelectRef.current(event.target.id());
    });

    graphRef.current = graph;

    return () => {
      graph.destroy();
      graphRef.current = null;
    };
  }, [projection]);

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
        const kind = String(node.data("kind")).toLowerCase();
        return label.includes(normalized) || kind.includes(normalized);
      });
      graph.elements().addClass("dimmed");
      matches.removeClass("dimmed").addClass("matched");
      matches.connectedEdges().removeClass("dimmed");
      matches.neighborhood("node").removeClass("dimmed");
    }
  }, [query, selectedId]);

  return (
    <div
      className="graph-canvas"
      ref={containerRef}
      aria-label="Research graph"
    />
  );
}
