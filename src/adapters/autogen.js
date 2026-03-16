/**
 * AutoGen integration helper.
 * Wraps AutoGen agent message handling in governance audit entries.
 *
 * @example
 * import { withGovernance } from '@agent-governance-sdk/sdk/adapters/autogen';
 *
 * const agent = new AssistantAgent({ name: 'scoring', llm_config });
 * const governedAgent = withGovernance(agent, auditLog, {
 *   agent: 'scoring',
 *   model: 'claude-sonnet-4-6',
 * });
 */

export function withGovernance(autogenAgent, auditLog, options = {}) {
  return new Proxy(autogenAgent, {
    get(target, prop) {
      if (prop === 'generate_reply' || prop === 'run' || prop === 'send') {
        return async (...args) => {
          return auditLog.wrap({
            agent: options.agent || target.name || 'autogen',
            eventType: `${prop}_complete`,
            model: options.model || 'unknown',
            input: args[0],
            resourceId: options.resourceId,
            metadata: options.metadata,
            action: () => target[prop](...args),
          });
        };
      }
      return target[prop];
    }
  });
}
