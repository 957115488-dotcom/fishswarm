export const ASSET_POLICY_ACTIONS = [
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
] as const;

export type AssetPolicyAction = (typeof ASSET_POLICY_ACTIONS)[number];
export type AssetPolicyEffect = 'allow' | 'deny' | 'prompt';
export type AssetPolicyRisk = 'low' | 'medium' | 'high' | 'critical';

export interface AssetPolicySubject {
  type: 'user' | 'agent' | 'system';
  id: string;
  displayName?: string;
}

export interface AssetPolicyResource {
  type: 'asset' | 'secret' | 'command' | 'network' | 'browser' | 'file' | 'patch' | 'rollback';
  id: string;
  assetId?: string;
  path?: string;
  uri?: string;
}

export interface AssetPolicyDecision {
  effect: AssetPolicyEffect;
  action: AssetPolicyAction;
  subject: AssetPolicySubject;
  resource: AssetPolicyResource;
  reason: string;
  risk: AssetPolicyRisk;
  policyId: string;
  policyVersion: number;
  requiresHumanApproval: boolean;
  createdAt: string;
}

export interface AssetPolicyRequest {
  action: AssetPolicyAction;
  subject?: Partial<AssetPolicySubject>;
  resource?: Partial<AssetPolicyResource>;
  now?: Date;
}

export function isAssetPolicyAction(value: string): value is AssetPolicyAction {
  return (ASSET_POLICY_ACTIONS as readonly string[]).includes(value);
}
