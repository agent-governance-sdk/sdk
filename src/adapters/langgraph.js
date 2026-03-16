/**
 * LangGraph integration helper.
 * Wraps LangGraph node execution in governance audit entries.
 *
 * @example
 * import { governedNode } from 'agent-governance-sdk/adapters/langgraph';
 *
 * const scoringNode = governedNode(auditLog, {
 *   agent: 'scoring',
 *   model: 'claude-sonnet-4-6',
 * }, async (state) => {
 *   const result = await model.invoke(state.messages);
 *   return { messages: [result] };
 * });
 *
 * const graph = new StateGraph({ channels })
 *   .addNode('scoring', scoringNode)
 *   .compile();
 */

export function governedNode(auditLog, options = {}, nodeFunction) {
  return async (state, config) => {
    return auditLog.wrap({
      agent: options.agent || 'langgraph',
      eventType: options.eventType || 'node_complete',
      model: options.model || 'unknown',
      input: state,
      resourceId: options.resourceId || state?.resourceId,
      metadata: options.metadata,
      action: () => nodeFunction(state, config),
    });
  };
}
