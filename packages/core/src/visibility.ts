import type { ResearchEdge, ResearchNode } from "./schema";
import type { ResearchProjection } from "./projector";

const structuralKinds = new Set<ResearchEdge["kind"]>([
  "decomposes",
  "proposes",
  "challenges",
  "tests",
  "produces",
]);

export interface GraphViewNode {
  node: ResearchNode;
  depth: number;
  hasChildren: boolean;
  isCollapsed: boolean;
  hiddenDescendantCount: number;
}

export interface GraphView {
  nodes: GraphViewNode[];
  edges: ResearchEdge[];
  roots: string[];
  totalNodeCount: number;
  hiddenNodeCount: number;
}

export interface GraphViewOptions {
  defaultExpandedDepth?: number;
  expandedNodeIds?: ReadonlySet<string>;
  collapsedNodeIds?: ReadonlySet<string>;
  revealNodeIds?: ReadonlySet<string>;
}

interface DisplayForest {
  roots: string[];
  parentById: Map<string, string>;
  childrenById: Map<string, string[]>;
  depthById: Map<string, number>;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function sortedNodeIds(projection: ResearchProjection): string[] {
  return [...projection.nodes.keys()].sort(compareText);
}

function buildDisplayForest(projection: ResearchProjection): DisplayForest {
  const nodeIds = sortedNodeIds(projection);
  const structuralEdges = [...projection.edges.values()]
    .filter(
      (edge) =>
        structuralKinds.has(edge.kind) &&
        projection.nodes.has(edge.source) &&
        projection.nodes.has(edge.target),
    )
    .sort((left, right) => compareText(left.id, right.id));

  const candidates = new Map<string, string[]>();
  const incoming = new Map(nodeIds.map((id) => [id, 0]));
  for (const edge of structuralEdges) {
    const children = candidates.get(edge.source) ?? [];
    children.push(edge.target);
    candidates.set(edge.source, children);
    incoming.set(edge.target, (incoming.get(edge.target) ?? 0) + 1);
  }
  for (const children of candidates.values()) children.sort();

  const naturalRoots = nodeIds.filter((id) => incoming.get(id) === 0);
  const roots: string[] = [];
  const parentById = new Map<string, string>();
  const childrenById = new Map<string, string[]>();
  const depthById = new Map<string, number>();
  const visited = new Set<string>();

  function grow(rootId: string): void {
    if (visited.has(rootId)) return;
    roots.push(rootId);
    visited.add(rootId);
    depthById.set(rootId, 0);
    const queue = [rootId];

    for (let index = 0; index < queue.length; index += 1) {
      const parentId = queue[index]!;
      const parentDepth = depthById.get(parentId)!;
      for (const childId of candidates.get(parentId) ?? []) {
        if (visited.has(childId)) continue;
        visited.add(childId);
        parentById.set(childId, parentId);
        depthById.set(childId, parentDepth + 1);
        const children = childrenById.get(parentId) ?? [];
        children.push(childId);
        childrenById.set(parentId, children);
        queue.push(childId);
      }
    }
  }

  for (const rootId of naturalRoots) grow(rootId);
  for (const nodeId of nodeIds) grow(nodeId);

  return { roots, parentById, childrenById, depthById };
}

function subtreeSizes(forest: DisplayForest): Map<string, number> {
  const sizes = new Map<string, number>();
  const ordered = [...forest.depthById.entries()].sort(
    (left, right) => right[1] - left[1],
  );

  for (const [nodeId] of ordered) {
    let size = 1;
    for (const childId of forest.childrenById.get(nodeId) ?? []) {
      size += sizes.get(childId) ?? 1;
    }
    sizes.set(nodeId, size);
  }
  return sizes;
}

function revealedAncestors(
  revealNodeIds: ReadonlySet<string>,
  parentById: ReadonlyMap<string, string>,
): Set<string> {
  const ancestors = new Set<string>();
  for (const nodeId of revealNodeIds) {
    let current = parentById.get(nodeId);
    const visited = new Set<string>();
    while (current !== undefined && !visited.has(current)) {
      visited.add(current);
      ancestors.add(current);
      current = parentById.get(current);
    }
  }
  return ancestors;
}

export function createGraphView(
  projection: ResearchProjection,
  options: GraphViewOptions = {},
): GraphView {
  const forest = buildDisplayForest(projection);
  const sizes = subtreeSizes(forest);
  const defaultExpandedDepth = options.defaultExpandedDepth ?? Infinity;
  const expanded = options.expandedNodeIds ?? new Set<string>();
  const collapsed = options.collapsedNodeIds ?? new Set<string>();
  const reveal = options.revealNodeIds ?? new Set<string>();
  const forcedOpen = revealedAncestors(reveal, forest.parentById);
  const nodes: GraphViewNode[] = [];
  const visibleIds = new Set<string>();

  function visit(nodeId: string): void {
    const node = projection.nodes.get(nodeId);
    if (node === undefined) return;
    const children = forest.childrenById.get(nodeId) ?? [];
    const depth = forest.depthById.get(nodeId) ?? 0;
    const explicitlyCollapsed =
      collapsed.has(nodeId) && !forcedOpen.has(nodeId);
    const automaticallyCollapsed =
      depth >= defaultExpandedDepth &&
      !expanded.has(nodeId) &&
      !forcedOpen.has(nodeId);
    const isCollapsed =
      children.length > 0 && (explicitlyCollapsed || automaticallyCollapsed);

    visibleIds.add(nodeId);
    nodes.push({
      node,
      depth,
      hasChildren: children.length > 0,
      isCollapsed,
      hiddenDescendantCount: isCollapsed ? (sizes.get(nodeId) ?? 1) - 1 : 0,
    });
    if (!isCollapsed) {
      for (const childId of children) visit(childId);
    }
  }

  for (const rootId of forest.roots) visit(rootId);

  const edges = [...projection.edges.values()]
    .filter(
      (edge) => visibleIds.has(edge.source) && visibleIds.has(edge.target),
    )
    .sort((left, right) => compareText(left.id, right.id));

  return {
    nodes,
    edges,
    roots: forest.roots,
    totalNodeCount: projection.nodes.size,
    hiddenNodeCount: projection.nodes.size - nodes.length,
  };
}
