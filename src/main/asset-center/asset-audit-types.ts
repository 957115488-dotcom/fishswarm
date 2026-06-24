import type { AssetPolicyAction } from './asset-policy-types';

export type AssetAuditResult = 'allowed' | 'denied' | 'prompted' | 'failed';

export interface AssetAuditEvent {
  eventId: string;
  requestId: string;
  subject: string;
  action: AssetPolicyAction;
  resource: string;
  result: AssetAuditResult;
  reason: string;
  policyId: string;
  policyVersion: number;
  sessionId?: string;
  assetId?: string;
  approvalId?: string;
  timestamp: string;
  contentHash?: string;
}

export function createAssetAuditEvent(
  input: Omit<AssetAuditEvent, 'timestamp'> & { timestamp?: string }
): AssetAuditEvent {
  return {
    ...input,
    timestamp: input.timestamp || new Date().toISOString(),
  };
}
