/**
 * LangChain integration example — agent-governance-sdk
 *
 * Requires: npm install @langchain/anthropic
 * Set ANTHROPIC_API_KEY in your environment.
 */

import { ChatAnthropic } from '@langchain/anthropic';
import { createGovernance, MemoryAdapter } from '../../src/index.js';
import { withGovernance } from '../../src/adapters/langchain.js';

const adapter = new MemoryAdapter();
const { auditLog, checkpoint } = createGovernance(adapter, {
  ownerId: 'user-demo',
});

// Wrap LangChain model with governance
const model = new ChatAnthropic({ model: 'claude-sonnet-4-6' });
const governedModel = withGovernance(model, auditLog, {
  agent: 'scoring',
  resourceId: 'rfp-001',
});

// Use exactly like the original — governance is transparent
const response = await governedModel.invoke([
  { role: 'user', content: 'Summarize this RFP opportunity.' },
]);

console.log('Response:', response.content);
console.log('Audit entries:', adapter.auditEntries.length);
