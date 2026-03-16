import { createHash } from 'crypto';

/**
 * AuditLog — immutable audit logging for AI agent actions.
 *
 * Records every agent action with:
 *   - Tamper-evident hashes of inputs and outputs
 *   - Token counts and latency for cost attribution
 *   - Model and agent type metadata
 *   - Human-readable event classification
 *
 * Designed to satisfy EU AI Act Article 13 logging requirements
 * for AI systems deployed in regulated contexts.
 *
 * IMPORTANT: AuditLog failures are NON-FATAL by design.
 * A governance log write should never break the pipeline
 * it governs. All errors are caught and logged to stderr.
 */

function sha256(value) {
  if (!value) return null;
  const str = typeof value === 'string' ? value : JSON.stringify(value);
  return createHash('sha256').update(str).digest('hex').slice(0, 16);
}

export class AuditLog {
  /**
   * @param {GovernanceAdapter} adapter
   * @param {Object} options
   * @param {string} options.ownerId - The authenticated user ID
   * @param {boolean} options.hashInputs - Hash input data (default: true)
   * @param {boolean} options.hashOutputs - Hash output data (default: true)
   */
  constructor(adapter, options = {}) {
    this.adapter = adapter;
    this.ownerId = options.ownerId;
    this.hashInputs = options.hashInputs !== false;
    this.hashOutputs = options.hashOutputs !== false;
  }

  /**
   * Wrap an agent action in an audit log entry.
   *
   * @param {Object} params
   * @param {string} params.agent - Agent identifier (e.g., 'scoring', 'draft')
   * @param {string} params.eventType - Event description (e.g., 'score_complete')
   * @param {string} params.model - Model used (e.g., 'claude-sonnet-4-6')
   * @param {any} params.input - Agent input (will be hashed, not stored)
   * @param {string} [params.resourceId] - ID of the resource being processed
   * @param {Object} [params.metadata] - Additional structured metadata
   * @param {Function} params.action - The async agent action to execute
   * @returns {Promise<any>} The result of the action
   *
   * @example
   * const result = await auditLog.wrap({
   *   agent: 'scoring',
   *   eventType: 'score_complete',
   *   model: 'claude-sonnet-4-6',
   *   input: { rfpText, kbEntries },
   *   resourceId: rfpId,
   *   action: () => scoringAgent.run(rfpText, kbEntries),
   * });
   */
  async wrap({ agent, eventType, model, input, resourceId, metadata, action }) {
    const startTime = Date.now();
    let output = null;
    let error = null;
    let inputTokens = 0;
    let outputTokens = 0;

    try {
      output = await action();

      // Extract token counts if the output has them
      // (Anthropic SDK format)
      if (output?.usage) {
        inputTokens = output.usage.input_tokens ?? 0;
        outputTokens = output.usage.output_tokens ?? 0;
      }

      return output;
    } catch (err) {
      error = err;
      throw err;
    } finally {
      // Fire-and-forget — never await in a finally block
      // to avoid masking errors from the action itself
      const entry = {
        ts: new Date().toISOString(),
        event_type: eventType,
        agent,
        model: model || null,
        resource_id: resourceId || null,
        owner_id: this.ownerId || null,
        input_hash: this.hashInputs ? sha256(input) : null,
        output_hash: this.hashOutputs ? sha256(output) : null,
        input_tokens: inputTokens || null,
        output_tokens: outputTokens || null,
        duration_ms: Date.now() - startTime,
        metadata: metadata || null,
        error: error?.message || null,
      };

      this.adapter.insertAuditEntry(entry).catch(err => {
        console.error('[@agent-governance-sdk/sdk] Audit log write failed:', err.message);
      });
    }
  }

  /**
   * Write a manual audit entry without wrapping an action.
   * Use for events that don't fit the wrap() pattern.
   */
  async record({ agent, eventType, model, resourceId, metadata, error }) {
    const entry = {
      ts: new Date().toISOString(),
      event_type: eventType,
      agent,
      model: model || null,
      resource_id: resourceId || null,
      owner_id: this.ownerId || null,
      metadata: metadata || null,
      error: error?.message || null,
    };

    await this.adapter.insertAuditEntry(entry).catch(err => {
      console.error('[@agent-governance-sdk/sdk] Audit log write failed:', err.message);
    });
  }

  /**
   * Retrieve audit entries for this owner.
   */
  async query({ resourceId, agent, limit } = {}) {
    return this.adapter.queryAuditEntries({
      owner_id: this.ownerId,
      resource_id: resourceId,
      agent,
      limit,
    });
  }
}
