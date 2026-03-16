# agent-governance-sdk

Production-grade audit logging, human oversight gates, and EU AI Act
compliance reporting for AI agent deployments.

**The EU AI Act requires governance infrastructure for AI agents by
August 2026.** This SDK provides the three primitives you need in
under 30 minutes: an immutable audit log, a human oversight gate,
and an Article 13 compliance report generator.

**Production proof:** [app.getaptum.app/audit](https://app.getaptum.app/audit)
— a live deployment using this exact pattern, processing real
government procurement data.

## Install

```bash
npm install agent-governance-sdk
```

## Quickstart

```javascript
import { createGovernance, MemoryAdapter, HumanCheckpointError } from 'agent-governance-sdk';

const adapter = new MemoryAdapter();
const { auditLog, checkpoint, compliance } = createGovernance(adapter, {
  ownerId: 'user-123',
});

// 1. Wrap any agent action in an audit log entry
const result = await auditLog.wrap({
  agent: 'scoring',
  eventType: 'score_complete',
  model: 'claude-sonnet-4-6',
  input: { text: 'Analyze this document' },
  resourceId: 'doc-001',
  action: async () => ({ score: 87 }),
});

// 2. Gate consequential actions on human approval
try {
  await checkpoint.require({ resourceId: 'doc-001', requiredDecision: 'approve' });
} catch (err) {
  // HumanCheckpointError — no human has approved yet
}

// 3. Record human decision, then proceed
await checkpoint.record({ resourceId: 'doc-001', decision: 'approve', rationale: 'Looks good' });
await checkpoint.require({ resourceId: 'doc-001', requiredDecision: 'approve' }); // passes

// 4. Generate an EU AI Act Article 13 compliance report
const report = await compliance.generate({ ownerId: 'user-123' });
```

## The Three Primitives

### AuditLog.wrap()

```javascript
const result = await auditLog.wrap({
  agent: 'scoring',
  eventType: 'score_complete',
  model: 'claude-sonnet-4-6',
  input: { rfpText, kbEntries },      // hashed, never stored
  resourceId: rfpId,
  metadata: { version: '2.1' },
  action: () => scoringAgent.run(rfpText, kbEntries),
});
// Automatically records: timestamp, duration, token counts,
// input/output SHA256 hashes, errors. Fire-and-forget —
// audit failures never break your pipeline.
```

### HumanCheckpoint.require()

```javascript
await checkpoint.require({
  resourceId: rfpId,
  requiredDecision: 'bid',
  errorMessage: 'A human must approve before drafting.',
});
// Throws HumanCheckpointError if no matching decision exists.
// Enforces human oversight at the code level — not just the UI.
```

### ComplianceReport.generate()

```javascript
const report = await compliance.generate({ ownerId: 'user-123' });
// Returns structured JSON: provider info, system description,
// human oversight measures, performance metrics, token costs,
// tamper evidence, known limitations, attestation fields.

const markdown = await compliance.toMarkdown({ ownerId: 'user-123' });
// Formatted for regulatory filings.
```

## Production Setup (Supabase / PostgreSQL)

Apply the migration — the same tables used in production at getaptum.app:

```sql
-- sql/schema.sql (included in this package)
create table agent_audit_log (
  id             uuid primary key default gen_random_uuid(),
  ts             timestamptz not null default now(),
  event_type     text not null,
  agent          text not null,
  model          text,
  resource_id    text,
  owner_id       text,
  input_hash     text,
  output_hash    text,
  input_tokens   integer,
  output_tokens  integer,
  duration_ms    integer,
  metadata       jsonb,
  error          text
);

alter table agent_audit_log enable row level security;
alter table agent_audit_log force row level security;
-- No UPDATE or DELETE policies — immutable by design
```

```javascript
import { createGovernance, PostgresAdapter } from 'agent-governance-sdk';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(url, serviceRoleKey);
const adapter = new PostgresAdapter({ client: supabase });

const { auditLog, checkpoint, compliance } = createGovernance(adapter, {
  ownerId: user.id,
});
```

Or with a raw `pg` Pool:

```javascript
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PostgresAdapter({ pool });
```

## Framework Integrations

### LangChain

```javascript
import { withGovernance } from 'agent-governance-sdk/adapters/langchain';
import { ChatAnthropic } from '@langchain/anthropic';

const model = new ChatAnthropic({ model: 'claude-sonnet-4-6' });
const governed = withGovernance(model, auditLog, { agent: 'scoring', resourceId });
const response = await governed.invoke(messages);
```

### LangGraph

```javascript
import { governedNode } from 'agent-governance-sdk/adapters/langgraph';

const scoringNode = governedNode(auditLog, { agent: 'scoring', model: 'claude-sonnet-4-6' },
  async (state) => {
    const result = await model.invoke(state.messages);
    return { messages: [result] };
  }
);
const graph = new StateGraph({ channels }).addNode('scoring', scoringNode).compile();
```

### AutoGen

```javascript
import { withGovernance } from 'agent-governance-sdk/adapters/autogen';

const agent = new AssistantAgent({ name: 'scoring', llm_config });
const governed = withGovernance(agent, auditLog, { agent: 'scoring' });
```

### CrewAI

```javascript
import { withGovernance } from 'agent-governance-sdk/adapters/crewai';

const crew = new Crew({ agents, tasks });
const governed = withGovernance(crew, auditLog, { agent: 'crewai' });
const result = await governed.kickoff();
```

## EU AI Act Reference

| SDK Feature | EU AI Act Article |
|---|---|
| AuditLog (immutable) | Article 12 — Record keeping |
| HumanCheckpoint | Article 14 — Human oversight |
| ComplianceReport | Article 13 — Transparency |
| Input/output hashing | Article 12(1) — Logging sufficient to assess performance |

## Architecture

This SDK was extracted from the governance layer of [Aptum](https://getaptum.app), a production proposal intelligence platform for government contractors. The `agent_audit_log` table has been immutable since deployment, accumulating a tamper-evident record of every agent action. The human decision gate has processed real bid/no-bid decisions on federal procurement opportunities. This is not a reference implementation — it is a production pattern.

Zero runtime dependencies. The library uses your application's existing database client (Supabase, pg, or any adapter you implement). Governance infrastructure should not add dependency surface area to the applications it governs.

## Roadmap

**v0.1 (current):** Core primitives, PostgreSQL/SQLite/memory adapters,
framework helpers, Article 13 report generator.

**v0.2:** Cloud-hosted compliance dashboard, webhook support for
human checkpoint notifications (Slack, email, PagerDuty),
confidence score logging.

**v1.0:** Formal EU AI Act Article mapping certification,
NIST AI RMF alignment documentation, enterprise support.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).
