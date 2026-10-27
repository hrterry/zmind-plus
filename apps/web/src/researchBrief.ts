import type { ResearchNode } from "@zmind-plus/core";

export type ResearchBriefSectionId =
  "decision" | "evidence" | "reversals" | "challenges" | "experiments";

export interface ResearchBriefSection {
  id: ResearchBriefSectionId;
  title: string;
  description: string;
  emptyMessage: string;
  nodes: ResearchNode[];
}

const sectionCopy: Record<
  ResearchBriefSectionId,
  Pick<ResearchBriefSection, "title" | "description" | "emptyMessage">
> = {
  decision: {
    title: "Current decision",
    description: "The conclusion currently supported by the recorded work.",
    emptyMessage: "No supported decision has been recorded yet.",
  },
  evidence: {
    title: "Evidence",
    description: "The strongest observations supporting the current state.",
    emptyMessage: "No supported evidence has been recorded yet.",
  },
  reversals: {
    title: "Reversals",
    description: "Ideas the research has refuted or superseded.",
    emptyMessage: "No idea has been overturned in this run.",
  },
  challenges: {
    title: "Open challenges",
    description: "Questions and critiques that still need resolution.",
    emptyMessage: "No unresolved challenge is currently recorded.",
  },
  experiments: {
    title: "Experiments",
    description: "Tests that can change or strengthen the conclusion.",
    emptyMessage: "No experiment has been recorded yet.",
  },
};

const unresolvedStatuses = new Set(["active", "blocked", "contested"]);

export function matchesResearchNode(
  node: ResearchNode,
  query: string,
): boolean {
  const normalized = query.trim().toLowerCase();
  if (normalized.length === 0) return true;
  return [node.title, node.summary, node.kind, node.status, ...node.tags].some(
    (value) => value.toLowerCase().includes(normalized),
  );
}

function compareNodes(left: ResearchNode, right: ResearchNode): number {
  return (
    (right.confidence ?? -1) - (left.confidence ?? -1) ||
    left.title.localeCompare(right.title)
  );
}

function toSection(
  id: ResearchBriefSectionId,
  nodes: readonly ResearchNode[],
  predicate: (node: ResearchNode) => boolean,
  query: string,
): ResearchBriefSection {
  const copy = sectionCopy[id];
  return {
    id,
    ...copy,
    nodes: nodes
      .filter((node) => predicate(node) && matchesResearchNode(node, query))
      .sort(compareNodes),
  };
}

export function createResearchBrief(
  nodes: Iterable<ResearchNode>,
  query = "",
): ResearchBriefSection[] {
  const allNodes = [...nodes];
  return [
    toSection(
      "decision",
      allNodes,
      (node) =>
        (node.kind === "decision" &&
          node.status !== "refuted" &&
          node.status !== "superseded") ||
        (node.kind === "claim" && node.status === "supported"),
      query,
    ),
    toSection(
      "evidence",
      allNodes,
      (node) =>
        node.kind === "evidence" &&
        (node.status === "supported" || node.status === "complete"),
      query,
    ),
    toSection(
      "reversals",
      allNodes,
      (node) => node.status === "refuted" || node.status === "superseded",
      query,
    ),
    toSection(
      "challenges",
      allNodes,
      (node) =>
        (node.kind === "critique" || node.kind === "question") &&
        unresolvedStatuses.has(node.status),
      query,
    ),
    toSection(
      "experiments",
      allNodes,
      (node) => node.kind === "experiment",
      query,
    ),
  ];
}
