import { describe, it, expect, beforeEach } from 'vitest';
import { MemoryAdapter } from '../src/adapters/memory.js';
import { GovernanceAdapter } from '../src/adapters/index.js';
import { PostgresAdapter } from '../src/adapters/postgres.js';

describe('GovernanceAdapter base class', () => {
  it('throws on unimplemented methods', async () => {
    const adapter = new GovernanceAdapter();
    await expect(adapter.insertAuditEntry({})).rejects.toThrow('not implemented');
    await expect(adapter.queryAuditEntries({})).rejects.toThrow('not implemented');
    await expect(adapter.insertDecision({})).rejects.toThrow('not implemented');
    await expect(adapter.checkDecision({})).rejects.toThrow('not implemented');
    await expect(adapter.generateReport({})).rejects.toThrow('not implemented');
  });
});

describe('MemoryAdapter', () => {
  let adapter;

  beforeEach(() => {
    adapter = new MemoryAdapter();
  });

  it('inserts and queries audit entries', async () => {
    await adapter.insertAuditEntry({ agent: 'test', owner_id: 'u1', event_type: 'a' });
    await adapter.insertAuditEntry({ agent: 'test', owner_id: 'u2', event_type: 'b' });

    const all = await adapter.queryAuditEntries({});
    expect(all).toHaveLength(2);

    const u1 = await adapter.queryAuditEntries({ owner_id: 'u1' });
    expect(u1).toHaveLength(1);
    expect(u1[0].owner_id).toBe('u1');
  });

  it('inserts and checks decisions', async () => {
    await adapter.insertDecision({ resource_id: 'r1', owner_id: 'u1', decision: 'bid' });

    expect(await adapter.checkDecision({ resource_id: 'r1', owner_id: 'u1' })).toBe(true);
    expect(await adapter.checkDecision({ resource_id: 'r1', owner_id: 'u1', required_decision: 'bid' })).toBe(true);
    expect(await adapter.checkDecision({ resource_id: 'r1', owner_id: 'u1', required_decision: 'no_bid' })).toBe(false);
    expect(await adapter.checkDecision({ resource_id: 'r2', owner_id: 'u1' })).toBe(false);
  });

  it('clears all data', async () => {
    await adapter.insertAuditEntry({ agent: 'test', event_type: 'a' });
    await adapter.insertDecision({ resource_id: 'r1', decision: 'bid' });

    adapter.clear();

    expect(adapter.auditEntries).toHaveLength(0);
    expect(adapter.decisions).toHaveLength(0);
  });

  it('respects limit parameter', async () => {
    for (let i = 0; i < 10; i++) {
      await adapter.insertAuditEntry({ agent: 'test', event_type: `e${i}` });
    }

    const limited = await adapter.queryAuditEntries({ limit: 3 });
    expect(limited).toHaveLength(3);
  });
});

describe('PostgresAdapter', () => {
  it('throws when neither client nor pool provided', () => {
    expect(() => new PostgresAdapter({})).toThrow('requires either a Supabase client or pg Pool');
  });
});
