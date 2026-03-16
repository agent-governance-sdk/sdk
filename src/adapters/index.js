/**
 * Adapter interface for @agent-governance-sdk/sdk storage.
 *
 * Implement this interface to use any storage backend.
 * The SDK ships three adapters: postgres, sqlite, memory.
 *
 * All methods are async and must resolve/reject cleanly.
 * The SDK will never throw on audit log failures — it logs
 * to console.error and continues. Governance must not break
 * the pipeline it governs.
 */

export class GovernanceAdapter {
  /**
   * Insert an audit log entry.
   * @param {AuditEntry} entry
   * @returns {Promise<{ id: string }>}
   */
  async insertAuditEntry(entry) {
    throw new Error('GovernanceAdapter.insertAuditEntry not implemented');
  }

  /**
   * Query audit entries for a given resource.
   * @param {Object} filters - { owner_id, resource_id, agent, limit }
   * @returns {Promise<AuditEntry[]>}
   */
  async queryAuditEntries(filters) {
    throw new Error('GovernanceAdapter.queryAuditEntries not implemented');
  }

  /**
   * Insert a human decision record.
   * @param {HumanDecision} decision
   * @returns {Promise<{ id: string }>}
   */
  async insertDecision(decision) {
    throw new Error('GovernanceAdapter.insertDecision not implemented');
  }

  /**
   * Check if a human decision exists for a resource.
   * @param {Object} params - { resource_id, owner_id, required_decision }
   * @returns {Promise<boolean>}
   */
  async checkDecision(params) {
    throw new Error('GovernanceAdapter.checkDecision not implemented');
  }

  /**
   * Generate a compliance report for a given owner/session.
   * @param {Object} params - { owner_id, from, to }
   * @returns {Promise<ComplianceReport>}
   */
  async generateReport(params) {
    throw new Error('GovernanceAdapter.generateReport not implemented');
  }
}
