import { AuditLog } from './audit.js';
import { HumanCheckpoint, HumanCheckpointError } from './checkpoint.js';
import { ComplianceReport } from './compliance.js';
import { GovernanceAdapter } from './adapters/index.js';
import { PostgresAdapter } from './adapters/postgres.js';
import { MemoryAdapter } from './adapters/memory.js';

export {
  AuditLog,
  HumanCheckpoint,
  HumanCheckpointError,
  ComplianceReport,
  GovernanceAdapter,
  PostgresAdapter,
  MemoryAdapter,
};

/**
 * Create a governance bundle — all three primitives
 * sharing one adapter instance.
 *
 * @param {GovernanceAdapter} adapter
 * @param {Object} options
 * @param {string} options.ownerId
 * @param {Object} [options.systemInfo] - For ComplianceReport
 * @returns {{ auditLog, checkpoint, compliance }}
 *
 * @example
 * import { createGovernance, PostgresAdapter } from '@agent-governance-sdk/sdk';
 *
 * const adapter = new PostgresAdapter({ client: supabase });
 * const { auditLog, checkpoint, compliance } = createGovernance(adapter, {
 *   ownerId: user.id,
 *   systemInfo: {
 *     systemName: 'My AI Agent',
 *     intendedPurpose: 'Automated document processing',
 *   }
 * });
 */
export function createGovernance(adapter, options = {}) {
  return {
    auditLog: new AuditLog(adapter, options),
    checkpoint: new HumanCheckpoint(adapter, options),
    compliance: new ComplianceReport(adapter, options.systemInfo),
  };
}
