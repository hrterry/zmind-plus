import { useMemo, useState } from "react";

import type { ResearchNode } from "@zmind-plus/core";

import { createResearchBrief } from "./researchBrief";

const INITIAL_SECTION_LIMIT = 6;

export function ResearchBrief({
  nodes,
  objective,
  query,
  onSelect,
}: {
  nodes: Iterable<ResearchNode>;
  objective: string | undefined;
  query: string;
  onSelect: (nodeId: string) => void;
}) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    () => new Set(),
  );
  const sections = useMemo(
    () => createResearchBrief(nodes, query),
    [nodes, query],
  );
  const visibleCount = sections.reduce(
    (total, section) => total + section.nodes.length,
    0,
  );

  return (
    <div className="brief-stage">
      <article
        className="research-brief"
        aria-label="Structured research brief"
      >
        <header className="brief-header">
          <span className="overline">Live structured document</span>
          <h2>Research brief</h2>
          <p>{objective ?? "Waiting for the research objective."}</p>
          <div className="brief-summary">
            <span>{sections.length} sections</span>
            <span>{visibleCount} matching records</span>
            <span>Derived locally</span>
          </div>
        </header>

        {query.trim().length > 0 && visibleCount === 0 && (
          <div className="brief-no-results" role="status">
            <strong>No brief item matches “{query.trim()}”.</strong>
            <span>Try a node title, status, kind, or tag.</span>
          </div>
        )}

        <div className="brief-sections">
          {sections.map((section, sectionIndex) => {
            const isExpanded = expandedSections.has(section.id);
            const visibleNodes = isExpanded
              ? section.nodes
              : section.nodes.slice(0, INITIAL_SECTION_LIMIT);
            return (
              <section className="brief-section" key={section.id}>
                <div className="brief-section-heading">
                  <span>{String(sectionIndex + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{section.title}</h3>
                    <p>{section.description}</p>
                  </div>
                  <strong>{section.nodes.length}</strong>
                </div>

                {visibleNodes.length > 0 ? (
                  <div className="brief-items">
                    {visibleNodes.map((node) => (
                      <button
                        className="brief-item"
                        type="button"
                        key={node.id}
                        onClick={() => onSelect(node.id)}
                      >
                        <span className={`brief-status status-${node.status}`}>
                          {node.status}
                        </span>
                        <div>
                          <strong>{node.title}</strong>
                          <p>{node.summary || "No summary was recorded."}</p>
                          <small>
                            {node.kind}
                            {node.confidence === undefined
                              ? ""
                              : ` · ${Math.round(node.confidence * 100)}% confidence`}
                          </small>
                        </div>
                        <span aria-hidden="true">↗</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="brief-empty">{section.emptyMessage}</p>
                )}

                {section.nodes.length > INITIAL_SECTION_LIMIT && (
                  <button
                    className="brief-expand"
                    type="button"
                    onClick={() =>
                      setExpandedSections((current) => {
                        const next = new Set(current);
                        if (next.has(section.id)) next.delete(section.id);
                        else next.add(section.id);
                        return next;
                      })
                    }
                  >
                    {isExpanded
                      ? "Show less"
                      : `Show ${section.nodes.length - INITIAL_SECTION_LIMIT} more`}
                  </button>
                )}
              </section>
            );
          })}
        </div>
      </article>
    </div>
  );
}
