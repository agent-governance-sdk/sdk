/**
 * Express API example — agent-governance-sdk
 *
 * Requires: npm install express
 * Shows governance middleware for an Express API.
 */

import express from 'express';
import {
  createGovernance,
  MemoryAdapter,
  HumanCheckpointError,
} from '../../src/index.js';

const app = express();
app.use(express.json());

const adapter = new MemoryAdapter();

// Governance middleware — creates per-request governance instance
app.use((req, res, next) => {
  const ownerId = req.headers['x-user-id'] || 'anonymous';
  req.governance = createGovernance(adapter, { ownerId });
  next();
});

// Agent endpoint — audit-logged
app.post('/api/score', async (req, res) => {
  try {
    const result = await req.governance.auditLog.wrap({
      agent: 'scoring',
      eventType: 'score_complete',
      model: 'claude-sonnet-4-6',
      input: req.body,
      resourceId: req.body.resourceId,
      action: async () => {
        // Your agent logic here
        return { fit_score: 82, recommendation: 'pursue' };
      },
    });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Human decision endpoint
app.post('/api/decide', async (req, res) => {
  try {
    const { resourceId, decision, rationale } = req.body;
    await req.governance.checkpoint.record({ resourceId, decision, rationale });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Gated agent endpoint — requires human approval
app.post('/api/draft', async (req, res) => {
  try {
    await req.governance.checkpoint.require({
      resourceId: req.body.resourceId,
      requiredDecision: 'bid',
    });

    const result = await req.governance.auditLog.wrap({
      agent: 'draft',
      eventType: 'draft_complete',
      model: 'claude-opus-4-6',
      input: req.body,
      resourceId: req.body.resourceId,
      action: async () => {
        return { draft: 'Generated proposal draft...' };
      },
    });

    res.json(result);
  } catch (err) {
    if (err instanceof HumanCheckpointError) {
      return res.status(403).json({ error: err.message, code: err.code });
    }
    res.status(500).json({ error: err.message });
  }
});

// Compliance report endpoint
app.get('/api/compliance-report', async (req, res) => {
  const report = await req.governance.compliance.generate({
    ownerId: req.headers['x-user-id'],
  });
  res.json(report);
});

app.listen(3000, () => console.log('Listening on :3000'));
