import type { AssetCenterItem } from './asset-center-types';

export type IntegrationDecision = 'adopt' | 'adapt' | 'defer' | 'avoid';

export interface LowcodeConcept {
  lowcodeKey: string;
  lowcodeName: string;
  fishSwarmName: string;
  decision: IntegrationDecision;
  rationale: string;
  artifactKinds: string[];
}

export const LOWCODE_CONCEPTS: LowcodeConcept[] = [
  {
    lowcodeKey: 'asset-center',
    lowcodeName: '资产中心',
    fishSwarmName: '资源库 / Assets',
    decision: 'adopt',
    rationale:
      'Use as the unified discovery and reuse surface for skills, roles, connectors, workflows, templates, and exports.',
    artifactKinds: ['concept_library_item'],
  },
  {
    lowcodeKey: 'page-design',
    lowcodeName: '页面设计 / 组件库',
    fishSwarmName: '组件蓝图 / Component Blueprints',
    decision: 'adapt',
    rationale:
      'Use as reusable blueprints and promptable UI primitives, not as a full runtime page builder.',
    artifactKinds: ['component_tree_draft', 'component.blueprint'],
  },
  {
    lowcodeKey: 'logic-design',
    lowcodeName: '逻辑设计',
    fishSwarmName: 'LogicFlow 草稿 / LogicFlow Drafts',
    decision: 'adapt',
    rationale: 'Compile to reviewable workflow artifacts; do not execute directly.',
    artifactKinds: ['logic_flow_draft', 'implementation_plan_dsl'],
  },
  {
    lowcodeKey: 'process-design',
    lowcodeName: '流程设计',
    fishSwarmName: 'Agent 工作流模板 / Agent Workflow Templates',
    decision: 'adapt',
    rationale:
      'Represent as role-driven templates that create plan artifacts for existing runner workflows.',
    artifactKinds: ['workflow.template', 'feature_blueprint'],
  },
  {
    lowcodeKey: 'data-model',
    lowcodeName: '数据模型',
    fishSwarmName: '业务数据模型 / Domain Data Models',
    decision: 'adapt',
    rationale: 'Treat as business/domain data drafts, not AI model provider configuration.',
    artifactKinds: ['data_model_draft'],
  },
  {
    lowcodeKey: 'interface-integration',
    lowcodeName: '接口集成',
    fishSwarmName: '连接器、MCP、IPC/API 合约、Provider 设置方案',
    decision: 'adapt',
    rationale: 'Model integrations as assets with explicit setup, credential, and policy metadata.',
    artifactKinds: ['api_contract_draft', 'mcp.server', 'ai.providerSetup'],
  },
  {
    lowcodeKey: 'source-export',
    lowcodeName: '源码导出 / 独立部署',
    fishSwarmName: '可审计导出包 / Auditable Export Package',
    decision: 'adapt',
    rationale: 'Export source and artifacts with manifest, checksums, redaction, and provenance.',
    artifactKinds: ['export.package', 'release_summary'],
  },
];

export function getLowcodeConceptAssets(): AssetCenterItem[] {
  return LOWCODE_CONCEPTS.map((concept) => ({
    id: `lowcode-concept:${concept.lowcodeKey}`,
    kind: 'concept.lowcode',
    source: 'built-in',
    scope: 'app',
    status: concept.decision === 'avoid' ? 'unavailable' : 'available',
    title: concept.fishSwarmName,
    summary: `${concept.lowcodeName} -> ${concept.fishSwarmName}. ${concept.rationale}`,
    tags: ['lowcode', concept.decision, concept.lowcodeKey, ...concept.artifactKinds],
    sourceRef: { type: 'generated', id: concept.lowcodeKey },
    schemaVersion: 1,
    actions: ['viewDetails'],
    warnings: concept.decision === 'avoid' ? ['Avoid direct runtime port.'] : [],
  }));
}
