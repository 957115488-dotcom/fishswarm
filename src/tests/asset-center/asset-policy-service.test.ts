import { describe, expect, it } from 'vitest';
import { decideAssetPolicy } from '../../main/asset-center/asset-policy-service';

describe('asset policy service', () => {
  it('allows read-only asset inspection', () => {
    const decision = decideAssetPolicy({
      action: 'asset.view',
      subject: { id: 'agent-1' },
      resource: { id: 'lowcode-concept:asset-center', assetId: 'lowcode-concept:asset-center' },
      now: new Date('2026-06-25T00:00:00.000Z'),
    });

    expect(decision).toMatchObject({
      effect: 'allow',
      requiresHumanApproval: false,
      risk: 'low',
      policyId: 'asset-policy.mvp',
    });
    expect(decision.createdAt).toBe('2026-06-25T00:00:00.000Z');
  });

  it('denies secret export unconditionally', () => {
    const decision = decideAssetPolicy({
      action: 'secret.export',
      resource: { type: 'secret', id: 'provider-key' },
    });

    expect(decision.effect).toBe('deny');
    expect(decision.risk).toBe('critical');
  });

  it('requires human approval for install, run, export, and apply actions', () => {
    for (const action of ['asset.install', 'asset.run', 'asset.export', 'patch.apply'] as const) {
      const decision = decideAssetPolicy({ action, resource: { id: 'asset-1' } });
      expect(decision.effect).toBe('prompt');
      expect(decision.requiresHumanApproval).toBe(true);
    }
  });
});
