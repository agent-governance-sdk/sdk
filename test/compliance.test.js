import { describe, it, expect, beforeEach } from 'vitest';
import { ComplianceReport } from '../src/compliance.js';
import { MemoryAdapter } from '../src/adapters/memory.js';

describe('ComplianceReport', () => {
  let adapter;
  let report;

  beforeEach(async () => {
    adapter = new MemoryAdapter();
    report = new ComplianceReport(adapter, {
      systemName: 'Test AI System',
      intendedPurpose: 'Automated document analysis',
      providerName: 'Test Corp',
      contactEmail: 'ai@testcorp.com',
      limitations: ['Cannot process documents over 100MB'],
    });

    // Seed audit entries
    await adapter.insertAuditEntry({
      ts: new Date().toISOString(),
      event_type: 'score_complete',
      agent: 'scoring',
      model: 'claude-sonnet-4-6',
      owner_id: 'user-123',
      input_tokens: 1000,
      output_tokens: 200,
      duration_ms: 3200,
      error: null,
    });
    await adapter.insertAuditEntry({
      ts: new Date().toISOString(),
      event_type: 'score_complete',
      agent: 'scoring',
      model: 'claude-sonnet-4-6',
      owner_id: 'user-123',
      input_tokens: 800,
      output_tokens: 180,
      duration_ms: 2900,
      error: null,
    });
    await adapter.insertAuditEntry({
      ts: new Date().toISOString(),
      event_type: 'draft_complete',
      agent: 'draft',
      model: 'claude-opus-4-6',
      owner_id: 'user-123',
      input_tokens: 5000,
      output_tokens: 2000,
      duration_ms: 45000,
      error: null,
    });
  });

  it('generates a valid Article 13 report', async () => {
    const r = await report.generate({ ownerId: 'user-123' });

    expect(r.report_type).toBe('EU_AI_ACT_ARTICLE_13_TRANSPARENCY');
    expect(r.system.name).toBe('Test AI System');
    expect(r.performance.total_invocations).toBe(3);
    expect(r.performance.error_rate_pct).toBe(0);
    expect(r.performance.by_agent.scoring.total_invocations).toBe(2);
    expect(r.performance.by_agent.draft.total_invocations).toBe(1);
    expect(r.human_oversight.checkpoint_implemented).toBe(true);
    expect(r.audit_integrity.log_immutability).toBeTruthy();
  });

  it('calculates cost estimates correctly', async () => {
    const r = await report.generate({ ownerId: 'user-123' });
    // 1800 sonnet input tokens * $3/M = $0.0054
    // 380 sonnet output tokens * $15/M = $0.0057
    // 5000 opus input tokens * $15/M = $0.075
    // 2000 opus output tokens * $75/M = $0.15
    // Total ≈ $0.236
    expect(r.performance.estimated_cost_usd).toBeGreaterThan(0);
    expect(r.performance.estimated_cost_usd).toBeLessThan(1);
  });

  it('exports valid Markdown', async () => {
    const md = await report.toMarkdown({ ownerId: 'user-123' });
    expect(md).toContain('# AI System Transparency Report');
    expect(md).toContain('EU AI Act Article 13');
    expect(md).toContain('Test AI System');
    expect(md).toContain('Human Oversight');
  });

  it('filters entries by date range', async () => {
    const past = new Date(Date.now() - 60 * 60 * 1000); // 1 hour ago
    const future = new Date(Date.now() + 60 * 60 * 1000);
    const r = await report.generate({
      ownerId: 'user-123',
      from: past,
      to: future,
    });
    expect(r.performance.total_invocations).toBe(3);
  });
});
