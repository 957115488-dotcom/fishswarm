import type {
  AssetPolicyDecision,
  AssetPolicyRequest,
  AssetPolicyResource,
  AssetPolicySubject,
} from './asset-policy-types';

const POLICY_ID = 'asset-policy.mvp';
const POLICY_VERSION = 1;

const PROMPT_REQUIRED_ACTIONS = new Set([
  'asset.install',
  'asset.enable',
  'asset.run',
  'asset.export',
  'command.exec.approved',
  'network.http.fetch',
  'network.websocket',
  'secret.read',
  'secret.write',
  'browser.navigate',
  'browser.injectScript',
  'patch.apply',
  'rollback.restore',
]);

function normalizeSubject(input: AssetPolicyRequest['subject']): AssetPolicySubject {
  return {
    type: input?.type || 'agent',
    id: input?.id || 'unknown-agent',
    displayName: input?.displayName,
  };
}

function normalizeResource(input: AssetPolicyRequest['resource']): AssetPolicyResource {
  return {
    type: input?.type || 'asset',
    id: input?.id || 'unknown-resource',
    assetId: input?.assetId,
    path: input?.path,
    uri: input?.uri,
  };
}

function decision(input: {
  request: AssetPolicyRequest;
  effect: AssetPolicyDecision['effect'];
  reason: string;
  risk: AssetPolicyDecision['risk'];
}): AssetPolicyDecision {
  return {
    effect: input.effect,
    action: input.request.action,
    subject: normalizeSubject(input.request.subject),
    resource: normalizeResource(input.request.resource),
    reason: input.reason,
    risk: input.risk,
    policyId: POLICY_ID,
    policyVersion: POLICY_VERSION,
    requiresHumanApproval: input.effect === 'prompt',
    createdAt: (input.request.now || new Date()).toISOString(),
  };
}

export function decideAssetPolicy(request: AssetPolicyRequest): AssetPolicyDecision {
  if (
    request.action === 'asset.view' ||
    request.action === 'command.preview' ||
    request.action === 'file.openSource'
  ) {
    return decision({
      request,
      effect: 'allow',
      reason: 'Read-only asset inspection is allowed in the MVP policy.',
      risk: 'low',
    });
  }

  if (request.action === 'secret.export') {
    return decision({
      request,
      effect: 'deny',
      reason: 'Exporting secrets is explicitly denied.',
      risk: 'critical',
    });
  }

  if (PROMPT_REQUIRED_ACTIONS.has(request.action)) {
    return decision({
      request,
      effect: 'prompt',
      reason: 'This action requires explicit human approval before execution.',
      risk:
        request.action.startsWith('secret.') || request.action === 'patch.apply'
          ? 'high'
          : 'medium',
    });
  }

  return decision({
    request,
    effect: 'deny',
    reason: 'No explicit MVP policy allows this action.',
    risk: 'high',
  });
}
