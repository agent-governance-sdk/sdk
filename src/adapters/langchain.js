/**
 * LangChain integration helper.
 * Wraps LangChain BaseLLM or ChatModel calls in governance audit entries.
 *
 * @example
 * import { ChatAnthropic } from '@langchain/anthropic';
 * import { withGovernance } from '@agent-governance-sdk/sdk/adapters/langchain';
 *
 * const model = new ChatAnthropic({ model: 'claude-sonnet-4-6' });
 * const governedModel = withGovernance(model, auditLog, {
 *   agent: 'scoring',
 *   resourceId: rfpId,
 * });
 *
 * // Use governedModel exactly like the original — governance is transparent
 * const response = await governedModel.invoke(messages);
 */

export function withGovernance(langchainModel, auditLog, options = {}) {
  return new Proxy(langchainModel, {
    get(target, prop) {
      if (prop === 'invoke' || prop === 'call' || prop === 'predict') {
        return async (...args) => {
          return auditLog.wrap({
            agent: options.agent || 'langchain',
            eventType: `${prop}_complete`,
            model: target.modelName || target.model || 'unknown',
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
