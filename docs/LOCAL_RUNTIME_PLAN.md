# Local Runtime Implementation Plan

Date: 2026-10-26

Status: In progress on `codex/foundation`.

## Outcome

Turn the static workbench into a real local application that can ingest agent
events, persist them, rebuild a research projection, and resume a live browser
stream after a disconnect.

```text
agent hook / adapter
        |
        | POST validated event batch
        v
┌─────────────────────────────────────┐
│ local runtime                       │
│                                     │
│ validate -> append transaction      │
│                  |                  │
│                  +-> SQLite         │
│                  +-> live event bus │
└──────────────────┬──────────────────┘
                   |
                   | snapshot + SSE
                   v
             browser workbench
```

## Runtime contract

### Write path

`POST /api/runs/:runId/events`

- Accepts one event or a bounded array.
- Validates the complete request before opening a transaction.
- Requires URL run ID to match every event body.
- Treats an existing identical event as an idempotent retry.
- Rejects an existing event ID with different content.
- Rejects gaps and non-monotonic run sequences.
- Commits the full batch or none of it.
- Publishes only after commit.

### Read path

```text
GET /api/runs/:runId/events?after=<sequence>&limit=<n>
GET /api/runs/:runId/projection
GET /api/runs/:runId/stream?after=<sequence>
GET /api/runs
GET /health
```

The SSE stream first replays committed events after the supplied sequence, then
switches to live delivery. Event IDs use the run sequence so the browser can
reconnect with `Last-Event-ID` without inventing a second cursor system.

## Persistence model

```mermaid
erDiagram
    RUNS ||--o{ EVENTS : contains
    RUNS {
      text id PK
      text title
      text objective
      integer created_at_ms
      integer updated_at_ms
      integer last_sequence
    }
    EVENTS {
      text run_id PK
      integer sequence PK
      text event_id UK
      text event_type
      integer observed_at_ms
      text canonical_json
      text content_digest
    }
```

SQLite settings:

- WAL journal mode for readers during ingestion.
- Foreign keys enabled.
- Busy timeout for short concurrent bursts.
- Explicit transactions for every batch.
- Canonical JSON digest used to distinguish retries from conflicts.

## Failure behavior

```mermaid
flowchart TD
    I[Incoming batch] --> V{All events valid?}
    V -- no --> R[Reject without writes]
    V -- yes --> M{Run and sequences match?}
    M -- no --> R
    M -- yes --> T[Begin transaction]
    T --> D{Existing event ID?}
    D -- identical --> N[Idempotent no-op]
    D -- different --> X[Rollback conflict]
    D -- new --> A[Append]
    N --> C[Commit]
    A --> C
    C --> P[Publish committed events]
```

## Security and privacy

- Bind to `127.0.0.1` by default.
- Do not enable CORS globally; allow only the configured local UI origin.
- Cap request bytes, batch size, replay limits, and SSE clients.
- Do not log event payloads.
- Return human-readable errors without absolute paths or database internals.
- Database path is configurable and excluded from version control.

## Phase review checklist

- Store tests cover append, replay, idempotency, conflict, gaps, and rollback.
- API tests cover validation, projection, and reconnect replay.
- Browser can fall back to the synthetic in-memory scenario when the runtime is
  unavailable, with a clear status indicator.
- Fresh install requires only Node.js and `npm install`.
- Production build and the public-boundary scan remain clean.
