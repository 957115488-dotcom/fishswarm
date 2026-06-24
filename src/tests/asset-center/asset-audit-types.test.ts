import { describe, expect, it } from 'vitest';
import { createAssetAuditEvent } from '../../main/asset-center/asset-audit-types';

describe('asset audit types', () => {
  it('creates audit events with stable required fields and timestamp default', () => {
    const event = createAssetAuditEvent({
      eventId: 'event-1',
      requestId: 'request-1',
      subject: 'agent:implementation-engineer',
      action: 'patch.apply',
      resource: 'patch:proposal-1',
      result: 'prompted',
      reason: 'Human approval required.',
      policyId: 'asset-policy.mvp',
      policyVersion: 1,
      assetId: 'patch-proposal:1',
      approvalId: 'gate-1',
      contentHash: 'a'.repeat(64),
    });

    expect(event.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(event.action).toBe('patch.apply');
    expect(event.result).toBe('prompted');
  });
});
