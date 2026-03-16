import { describe, it, expect, beforeEach } from 'vitest';
import { HumanCheckpoint, HumanCheckpointError }
  from '../src/checkpoint.js';
import { MemoryAdapter } from '../src/adapters/memory.js';

describe('HumanCheckpoint', () => {
  let adapter;
  let checkpoint;

  beforeEach(() => {
    adapter = new MemoryAdapter();
    checkpoint = new HumanCheckpoint(adapter, {
      ownerId: 'user-123'
    });
  });

  it('throws HumanCheckpointError when no decision exists', async () => {
    await expect(
      checkpoint.require({ resourceId: 'rfp-456' })
    ).rejects.toThrow(HumanCheckpointError);
  });

  it('throws with resource ID in error', async () => {
    try {
      await checkpoint.require({ resourceId: 'rfp-456' });
    } catch (err) {
      expect(err).toBeInstanceOf(HumanCheckpointError);
      expect(err.resourceId).toBe('rfp-456');
      expect(err.code).toBe('CHECKPOINT_REQUIRED');
    }
  });

  it('passes when a decision exists', async () => {
    await checkpoint.record({
      resourceId: 'rfp-456',
      decision: 'approve',
      rationale: 'Strong fit',
    });

    // Should not throw
    await checkpoint.require({ resourceId: 'rfp-456' });
  });

  it('passes when required decision matches', async () => {
    await checkpoint.record({
      resourceId: 'rfp-456',
      decision: 'bid',
    });

    await checkpoint.require({
      resourceId: 'rfp-456',
      requiredDecision: 'bid',
    });
  });

  it('throws when decision exists but does not match required', async () => {
    await checkpoint.record({
      resourceId: 'rfp-456',
      decision: 'no_bid',
    });

    await expect(
      checkpoint.require({
        resourceId: 'rfp-456',
        requiredDecision: 'bid',
      })
    ).rejects.toThrow(HumanCheckpointError);
  });

  it('records decision with context', async () => {
    await checkpoint.record({
      resourceId: 'rfp-456',
      decision: 'approve',
      rationale: 'Strong technical fit',
      context: { fit_score: 87, recommendation: 'pursue' },
    });

    const decisions = adapter.decisions;
    expect(decisions[0].decision).toBe('approve');
    expect(decisions[0].rationale).toBe('Strong technical fit');
    expect(decisions[0].context.fit_score).toBe(87);
  });
});
