/**
 * CrewAI integration helper.
 * Wraps CrewAI task execution in governance audit entries.
 *
 * @example
 * import { withGovernance } from 'agent-governance-sdk/adapters/crewai';
 *
 * const crew = new Crew({ agents, tasks });
 * const governedCrew = withGovernance(crew, auditLog, {
 *   agent: 'crewai',
 *   model: 'claude-sonnet-4-6',
 * });
 *
 * const result = await governedCrew.kickoff();
 */

export function withGovernance(crewInstance, auditLog, options = {}) {
  return new Proxy(crewInstance, {
    get(target, prop) {
      if (prop === 'kickoff' || prop === 'run') {
        return async (...args) => {
          return auditLog.wrap({
            agent: options.agent || 'crewai',
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
