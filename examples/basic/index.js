/**
 * Basic example — agent-governance-sdk
 *
 * Run: node examples/basic/index.js
 * No database required — uses the in-memory adapter.
 */

import {
  createGovernance,
  MemoryAdapter,
  HumanCheckpointError,
} from '../../src/index.js';

const adapter = new MemoryAdapter();
const { auditLog, checkpoint, compliance } = createGovernance(adapter, {
  ownerId: 'user-demo',
  systemInfo: {
    systemName: 'Demo Agent',
    intendedPurpose: 'Example of governance primitives',
    providerName: 'Demo Corp',
    contactEmail: 'demo@example.com',
  },
});

// 1. Wrap an agent action in audit logging
console.log('--- Step 1: Audit-wrapped agent action ---');
const result = await auditLog.wrap({
  agent: 'scoring',
  eventType: 'score_complete',
  model: 'claude-sonnet-4-6',
  input: { text: 'Sample RFP for IT modernization services' },
  resourceId: 'rfp-001',
  action: async () => {
    // Simulate agent work
    await new Promise(r => setTimeout(r, 100));
    return { fit_score: 82, recommendation: 'pursue' };
  },
});
console.log('Agent result:', result);

// 2. Try to proceed without human approval — should fail
console.log('\n--- Step 2: Checkpoint without decision (should fail) ---');
try {
  await checkpoint.require({
    resourceId: 'rfp-001',
    requiredDecision: 'bid',
  });
} catch (err) {
  if (err instanceof HumanCheckpointError) {
    console.log('Blocked:', err.message);
    console.log('Error code:', err.code);
  }
}

// 3. Record human decision, then retry
console.log('\n--- Step 3: Record human decision and retry ---');
await checkpoint.record({
  resourceId: 'rfp-001',
  decision: 'bid',
  rationale: 'Strong technical fit, good past performance',
  context: { fit_score: 82 },
});

await checkpoint.require({
  resourceId: 'rfp-001',
  requiredDecision: 'bid',
});
console.log('Checkpoint passed — human approved.');

// 4. Generate compliance report
console.log('\n--- Step 4: Compliance report ---');
const report = await compliance.generate({ ownerId: 'user-demo' });
console.log('Report type:', report.report_type);
console.log('Total invocations:', report.performance.total_invocations);
console.log('Human oversight:', report.human_oversight.checkpoint_implemented);
