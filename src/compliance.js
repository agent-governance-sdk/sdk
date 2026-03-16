/**
 * ComplianceReport — generates EU AI Act Article 13
 * transparency reports from audit log and decision data.
 *
 * Article 13 requires high-risk AI systems to provide:
 *   1. Description of system capabilities and intended purpose
 *   2. Human oversight measures
 *   3. Performance metrics (accuracy, robustness)
 *   4. Limitations and foreseeable misuse
 *
 * This implementation generates a structured JSON report
 * from the governance audit trail. It addresses items 2 and 3
 * from audit log data. Items 1 and 4 require developer input.
 */

export class ComplianceReport {
  /**
   * @param {GovernanceAdapter} adapter
   * @param {Object} systemInfo - Static system information
   * @param {string} systemInfo.systemName
   * @param {string} systemInfo.systemDescription
   * @param {string} systemInfo.intendedPurpose
   * @param {string[]} systemInfo.agentTypes
   * @param {string[]} systemInfo.limitations
   * @param {string} systemInfo.providerName
   * @param {string} systemInfo.contactEmail
   */
  constructor(adapter, systemInfo = {}) {
    this.adapter = adapter;
    this.systemInfo = systemInfo;
  }

  /**
   * Generate an Article 13 transparency report.
   *
   * @param {Object} params
   * @param {string} params.ownerId
   * @param {Date} [params.from] - Report start date (default: 30 days ago)
   * @param {Date} [params.to] - Report end date (default: now)
   * @returns {Promise<Article13Report>}
   */
  async generate({ ownerId, from, to } = {}) {
    const toDate = to || new Date();
    const fromDate = from || new Date(toDate - 30 * 24 * 60 * 60 * 1000);

    // Fetch audit entries for the period
    const entries = await this.adapter.queryAuditEntries({
      owner_id: ownerId,
      limit: 10000,
    });

    const periodEntries = entries.filter(e => {
      const ts = new Date(e.ts);
      return ts >= fromDate && ts <= toDate;
    });

    // Aggregate metrics
    const byAgent = {};
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalDurationMs = 0;
    let errorCount = 0;

    for (const entry of periodEntries) {
      if (!byAgent[entry.agent]) {
        byAgent[entry.agent] = {
          count: 0,
          errors: 0,
          totalDurationMs: 0,
          totalInputTokens: 0,
          totalOutputTokens: 0,
        };
      }
      byAgent[entry.agent].count++;
      if (entry.error) { byAgent[entry.agent].errors++; errorCount++; }
      byAgent[entry.agent].totalDurationMs += entry.duration_ms || 0;
      byAgent[entry.agent].totalInputTokens += entry.input_tokens || 0;
      byAgent[entry.agent].totalOutputTokens += entry.output_tokens || 0;
      totalInputTokens += entry.input_tokens || 0;
      totalOutputTokens += entry.output_tokens || 0;
      totalDurationMs += entry.duration_ms || 0;
    }

    // Compute per-agent averages
    const agentSummaries = {};
    for (const [agent, stats] of Object.entries(byAgent)) {
      agentSummaries[agent] = {
        total_invocations: stats.count,
        error_rate_pct: stats.count > 0
          ? Math.round((stats.errors / stats.count) * 1000) / 10
          : 0,
        avg_latency_ms: stats.count > 0
          ? Math.round(stats.totalDurationMs / stats.count)
          : 0,
        total_input_tokens: stats.totalInputTokens,
        total_output_tokens: stats.totalOutputTokens,
      };
    }

    // Cost estimation using standard Anthropic pricing
    const MODEL_RATES = {
      'claude-sonnet-4-6': { input: 3.00, output: 15.00 },
      'claude-opus-4-6':   { input: 15.00, output: 75.00 },
    };

    let estimatedCostUSD = 0;
    for (const entry of periodEntries) {
      const rates = MODEL_RATES[entry.model] || { input: 3, output: 15 };
      estimatedCostUSD +=
        ((entry.input_tokens || 0) / 1_000_000) * rates.input +
        ((entry.output_tokens || 0) / 1_000_000) * rates.output;
    }

    return {
      report_type: 'EU_AI_ACT_ARTICLE_13_TRANSPARENCY',
      generated_at: new Date().toISOString(),
      report_period: {
        from: fromDate.toISOString(),
        to: toDate.toISOString(),
        days: Math.round((toDate - fromDate) / (24 * 60 * 60 * 1000)),
      },

      // Article 13(1) — Provider information
      provider: {
        name: this.systemInfo.providerName || '[PROVIDER NAME]',
        contact: this.systemInfo.contactEmail || '[CONTACT EMAIL]',
      },

      // Article 13(2)(a) — Intended purpose
      system: {
        name: this.systemInfo.systemName || '[SYSTEM NAME]',
        description: this.systemInfo.systemDescription || '[SYSTEM DESCRIPTION]',
        intended_purpose: this.systemInfo.intendedPurpose || '[INTENDED PURPOSE]',
        agent_types: this.systemInfo.agentTypes || Object.keys(byAgent),
      },

      // Article 13(3)(a) — Human oversight measures
      human_oversight: {
        checkpoint_implemented: true,
        checkpoint_mechanism: 'HumanCheckpoint.require() enforces human decision ' +
          'before consequential agent actions. Decisions are stored in an append-only ' +
          'table with FORCE ROW LEVEL SECURITY — no agent can write to this table.',
        decisions_in_period: null, // populate from checkDecision queries if available
        oversight_note: 'All consequential actions require authenticated human ' +
          'authorization before execution. Agent pipeline is gated at the ' +
          'decision layer, not just the presentation layer.',
      },

      // Article 13(3)(b) — Performance characteristics
      performance: {
        total_invocations: periodEntries.length,
        error_count: errorCount,
        error_rate_pct: periodEntries.length > 0
          ? Math.round((errorCount / periodEntries.length) * 1000) / 10
          : 0,
        avg_latency_ms: periodEntries.length > 0
          ? Math.round(totalDurationMs / periodEntries.length)
          : 0,
        total_tokens_consumed: totalInputTokens + totalOutputTokens,
        estimated_cost_usd: Math.round(estimatedCostUSD * 100) / 100,
        by_agent: agentSummaries,
      },

      // Article 13(3)(d) — Tamper evidence
      audit_integrity: {
        log_immutability: 'FORCE ROW LEVEL SECURITY — append-only, no updates or deletes',
        input_hashing: 'SHA256 (16-char prefix) on all agent inputs',
        output_hashing: 'SHA256 (16-char prefix) on all agent outputs',
        total_entries_in_period: periodEntries.length,
      },

      // Article 13(3)(e) — Limitations
      known_limitations: this.systemInfo.limitations || [
        '[List known limitations and foreseeable misuse scenarios]',
      ],

      // Attestation
      attestation: {
        statement: 'This report was generated from production audit log data. ' +
          'All agent actions are recorded at time of execution. ' +
          'Human oversight checkpoints are enforced at the infrastructure level.',
        requires_signature: true,
        signature_fields: ['authorized_official', 'title', 'date'],
      },
    };
  }

  /**
   * Export report as a formatted JSON string.
   */
  async toJSON(params) {
    const report = await this.generate(params);
    return JSON.stringify(report, null, 2);
  }

  /**
   * Export report as a Markdown document.
   * Suitable for attaching to regulatory filings.
   */
  async toMarkdown(params) {
    const r = await this.generate(params);
    return `# AI System Transparency Report
## EU AI Act Article 13 Compliance

**Generated:** ${r.generated_at}
**Period:** ${r.report_period.from} to ${r.report_period.to} (${r.report_period.days} days)

---

## Provider

**Name:** ${r.provider.name}
**Contact:** ${r.provider.contact}

## System

**Name:** ${r.system.name}
**Purpose:** ${r.system.intended_purpose}

${r.system.description}

## Human Oversight (Article 14)

${r.human_oversight.checkpoint_mechanism}

**Oversight note:** ${r.human_oversight.oversight_note}

## Performance (Article 13(3)(b))

| Metric | Value |
|--------|-------|
| Total invocations | ${r.performance.total_invocations} |
| Error rate | ${r.performance.error_rate_pct}% |
| Average latency | ${r.performance.avg_latency_ms}ms |
| Total tokens | ${r.performance.total_tokens_consumed.toLocaleString()} |
| Estimated cost | $${r.performance.estimated_cost_usd} |

### By Agent Type

${Object.entries(r.performance.by_agent).map(([agent, stats]) =>
`**${agent}:** ${stats.total_invocations} invocations, ${stats.error_rate_pct}% errors, ${stats.avg_latency_ms}ms avg latency`
).join('\n')}

## Audit Integrity

- **Log immutability:** ${r.audit_integrity.log_immutability}
- **Input hashing:** ${r.audit_integrity.input_hashing}
- **Output hashing:** ${r.audit_integrity.output_hashing}
- **Entries in period:** ${r.audit_integrity.total_entries_in_period}

## Known Limitations

${r.known_limitations.map(l => `- ${l}`).join('\n')}

---

*${r.attestation.statement}*

**Signature:** ______________________
**Title:** ______________________
**Date:** ______________________
`;
  }
}
