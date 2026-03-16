/**
 * HumanCheckpoint — enforces human oversight before AI agent
 * actions with consequential outcomes.
 *
 * This is the core governance primitive. No agent in the pipeline
 * can take a consequential action without a verified human decision.
 *
 * Implements the human oversight requirement of:
 *   - EU AI Act Article 14 (human oversight)
 *   - NIST AI RMF (GOVERN 1.2, GOVERN 4.2)
 *   - CMMC Human Review principle
 *
 * The pattern proven in production: Aptum's bid/no-bid gate
 * at app.getaptum.app — no proposal draft can be generated
 * without an authenticated human recording a bid decision.
 * This is enforced at both the API layer and the database layer
 * (FORCE ROW LEVEL SECURITY prevents agent writes to the
 * decisions table).
 */

export class HumanCheckpointError extends Error {
  constructor(message, resourceId) {
    super(message);
    this.name = 'HumanCheckpointError';
    this.resourceId = resourceId;
    this.code = 'CHECKPOINT_REQUIRED';
  }
}

export class HumanCheckpoint {
  /**
   * @param {GovernanceAdapter} adapter
   * @param {Object} options
   * @param {string} options.ownerId - The authenticated user ID
   * @param {number} [options.timeoutHours] - Decision expiry window
   */
  constructor(adapter, options = {}) {
    this.adapter = adapter;
    this.ownerId = options.ownerId;
    this.timeoutHours = options.timeoutHours ?? null;
  }

  /**
   * Require a human decision before proceeding.
   * Throws HumanCheckpointError if no decision exists.
   *
   * @param {Object} params
   * @param {string} params.resourceId - ID of the resource requiring decision
   * @param {string} [params.requiredDecision] - The specific decision required
   *   (e.g., 'approve', 'bid', 'proceed'). If omitted, any decision passes.
   * @param {string} [params.errorMessage] - Custom error message if check fails
   * @throws {HumanCheckpointError}
   *
   * @example
   * // In your agent pipeline, before taking a consequential action:
   * await checkpoint.require({
   *   resourceId: rfpId,
   *   requiredDecision: 'bid',
   *   errorMessage: 'A human must review and approve this opportunity before drafting.',
   * });
   * // If no decision exists → throws HumanCheckpointError
   * // If decision exists but is 'no_bid' → throws HumanCheckpointError
   * // If decision is 'bid' → continues
   */
  async require({ resourceId, requiredDecision, errorMessage }) {
    const approved = await this.adapter.checkDecision({
      resource_id: resourceId,
      owner_id: this.ownerId,
      required_decision: requiredDecision,
    });

    if (!approved) {
      throw new HumanCheckpointError(
        errorMessage ||
          `Human approval required for resource ${resourceId}` +
          (requiredDecision ? ` (required decision: ${requiredDecision})` : ''),
        resourceId
      );
    }
  }

  /**
   * Record a human decision for a resource.
   * Call this when a human makes a decision — from your UI,
   * API endpoint, or notification handler.
   *
   * @param {Object} params
   * @param {string} params.resourceId
   * @param {string} params.decision - The human's decision value
   * @param {string} [params.rationale] - Human's explanation
   * @param {Object} [params.context] - Additional context at time of decision
   *   (e.g., the AI's recommendation, the score, flags raised)
   * @returns {Promise<{ id: string }>}
   */
  async record({ resourceId, decision, rationale, context }) {
    return this.adapter.insertDecision({
      resource_id: resourceId,
      owner_id: this.ownerId,
      decision,
      rationale: rationale || null,
      context: context || null,
      decided_at: new Date().toISOString(),
    });
  }

  /**
   * Check if a decision exists without throwing.
   * Returns the decision record or null.
   */
  async check(resourceId) {
    return this.adapter.checkDecision({
      resource_id: resourceId,
      owner_id: this.ownerId,
    });
  }
}
