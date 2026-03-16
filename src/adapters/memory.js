import { GovernanceAdapter } from './index.js';

/**
 * In-memory adapter for testing and local development.
 * All data is lost when the process exits.
 * Do not use in production.
 */
export class MemoryAdapter extends GovernanceAdapter {
  constructor() {
    super();
    this._audit = [];
    this._decisions = [];
  }

  async insertAuditEntry(entry) {
    const id = Math.random().toString(36).slice(2);
    this._audit.push({ id, ...entry });
    return { id };
  }

  async queryAuditEntries({ owner_id, resource_id, agent, limit = 50 }) {
    return this._audit
      .filter(e =>
        (!owner_id    || e.owner_id    === owner_id) &&
        (!resource_id || e.resource_id === resource_id) &&
        (!agent       || e.agent       === agent)
      )
      .slice(-limit)
      .reverse();
  }

  async insertDecision(decision) {
    const id = Math.random().toString(36).slice(2);
    this._decisions.push({ id, ...decision });
    return { id };
  }

  async checkDecision({ resource_id, owner_id, required_decision }) {
    const d = this._decisions.find(d =>
      d.resource_id === resource_id &&
      (!owner_id || d.owner_id === owner_id)
    );
    if (!d) return false;
    if (required_decision && d.decision !== required_decision) return false;
    return true;
  }

  // Expose for testing
  get auditEntries() { return [...this._audit]; }
  get decisions() { return [...this._decisions]; }
  clear() { this._audit = []; this._decisions = []; }
}
