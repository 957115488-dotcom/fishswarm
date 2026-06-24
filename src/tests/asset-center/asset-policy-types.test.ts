import { describe, expect, it } from 'vitest';
import {
  ASSET_POLICY_ACTIONS,
  isAssetPolicyAction,
  type AssetPolicyAction,
} from '../../main/asset-center/asset-policy-types';

const expectedActions: AssetPolicyAction[] = [
  'asset.view',
  'asset.install',
  'asset.enable',
  'asset.run',
  'asset.export',
  'command.preview',
  'command.exec.approved',
  'network.http.fetch',
  'network.websocket',
  'secret.read',
  'secret.write',
  'secret.export',
  'browser.navigate',
  'browser.injectScript',
  'file.openSource',
  'patch.apply',
  'rollback.restore',
];

describe('asset policy types', () => {
  it('defines the complete MVP policy action registry', () => {
    expect([...ASSET_POLICY_ACTIONS]).toEqual(expectedActions);
    expect(isAssetPolicyAction('patch.apply')).toBe(true);
    expect(isAssetPolicyAction('asset.install.unsafely')).toBe(false);
  });
});
