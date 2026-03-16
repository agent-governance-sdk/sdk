import { describe, it, expect, beforeEach } from 'vitest';
import { AuditLog } from '../src/audit.js';
import { MemoryAdapter } from '../src/adapters/memory.js';

describe('AuditLog', () => {
  let adapter;
  let auditLog;

  beforeEach(() => {
    adapter = new MemoryAdapter();
    auditLog = new AuditLog(adapter, { ownerId: 'user-123' });
  });

  it('records a successful action', async () => {
    const result = await auditLog.wrap({
      agent: 'scoring',
      eventType: 'score_complete',
      model: 'claude-sonnet-4-6',
      input: { text: 'test rfp' },
      resourceId: 'rfp-456',
      action: async () => ({ fit_score: 82 }),
    });

    expect(result).toEqual({ fit_score: 82 });

    const entries = adapter.auditEntries;
    expect(entries).toHaveLength(1);
    expect(entries[0].agent).toBe('scoring');
    expect(entries[0].event_type).toBe('score_complete');
    expect(entries[0].owner_id).toBe('user-123');
    expect(entries[0].resource_id).toBe('rfp-456');
    expect(entries[0].input_hash).toBeTruthy();
    expect(entries[0].error).toBeNull();
  });

  it('records a failed action and re-throws', async () => {
    const error = new Error('Claude API error');
    await expect(
      auditLog.wrap({
        agent: 'draft',
        eventType: 'draft_failed',
        model: 'claude-opus-4-6',
        input: { rfpId: '123' },
        action: async () => { throw error; },
      })
    ).rejects.toThrow('Claude API error');

    const entries = adapter.auditEntries;
    expect(entries).toHaveLength(1);
    expect(entries[0].error).toBe('Claude API error');
  });

  it('does not throw when adapter write fails', async () => {
    const failingAdapter = new MemoryAdapter();
    failingAdapter.insertAuditEntry = async () => {
      throw new Error('DB connection failed');
    };
    const log = new AuditLog(failingAdapter, { ownerId: 'user-123' });

    // Should not throw — governance failures are non-fatal
    const result = await log.wrap({
      agent: 'scoring',
      eventType: 'test',
      action: async () => 'success',
    });

    expect(result).toBe('success');
  });

  it('hashes input and output by default', async () => {
    await auditLog.wrap({
      agent: 'scoring',
      eventType: 'test',
      input: { sensitive: 'data' },
      action: async () => ({ output: 'result' }),
    });

    const entry = adapter.auditEntries[0];
    expect(entry.input_hash).toHaveLength(16);
    expect(entry.output_hash).toHaveLength(16);
    // Input data itself is not stored
    expect(JSON.stringify(entry)).not.toContain('sensitive');
  });

  it('records duration_ms', async () => {
    await auditLog.wrap({
      agent: 'scoring',
      eventType: 'test',
      action: async () => {
        await new Promise(r => setTimeout(r, 50));
        return 'done';
      },
    });

    const entry = adapter.auditEntries[0];
    expect(entry.duration_ms).toBeGreaterThanOrEqual(40);
  });
});
