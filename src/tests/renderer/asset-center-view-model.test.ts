import { describe, expect, it } from 'vitest';
import type { AssetCenterSnapshot } from '../../renderer/types/asset-center';
import {
  buildAssetCenterViewModel,
  formatAssetKindLabel,
  getAssetGroupId,
  getAssetStatusTone,
} from '../../renderer/utils/asset-center-view-model';

const snapshot: AssetCenterSnapshot = {
  schemaVersion: 1,
  generatedAt: '2026-06-25T00:00:00.000Z',
  warnings: ['adapter warning'],
  stats: {},
  items: [
    {
      id: 'lowcode-concept:asset-center',
      kind: 'concept.lowcode',
      source: 'built-in',
      scope: 'app',
      status: 'available',
      title: 'Asset Center',
      summary: 'Unified read-only assets',
      tags: ['lowcode', 'assets'],
      sourceRef: { type: 'generated', id: 'asset-center' },
      schemaVersion: 1,
      actions: ['viewDetails'],
      warnings: [],
    },
    {
      id: 'role:qa-release-steward',
      kind: 'role',
      source: 'built-in',
      scope: 'app',
      status: 'enabled',
      title: 'QA Release Steward',
      summary: 'Release quality role',
      tags: ['role', 'qa'],
      sourceRef: { type: 'generated', id: 'qa-release-steward' },
      schemaVersion: 1,
      actions: ['viewDetails'],
      warnings: ['Needs review before automation.'],
    },
    {
      id: 'workflow.artifact:review_gate:12345678',
      kind: 'workflow.artifact',
      source: 'generated',
      scope: 'workspace',
      status: 'needsSetup',
      title: 'Review Gate',
      summary: 'Review artifact',
      tags: ['workflow', 'review'],
      sourceRef: { type: 'generated', id: '12345678' },
      schemaVersion: 1,
      actions: ['viewDetails'],
      warnings: [],
    },
  ],
};

describe('asset center view model', () => {
  it('maps asset kinds into the three planned groups', () => {
    expect(getAssetGroupId('concept.lowcode')).toBe('creation');
    expect(getAssetGroupId('role')).toBe('capabilities');
    expect(getAssetGroupId('workflow.artifact')).toBe('delivery');
  });

  it('formats labels and status tones for display', () => {
    expect(formatAssetKindLabel('ai.modelPreset')).toBe('AI Model Preset');
    expect(getAssetStatusTone('enabled')).toBe('success');
    expect(getAssetStatusTone('needsSetup')).toBe('warning');
    expect(getAssetStatusTone('unavailable')).toBe('danger');
  });

  it('builds grouped, searchable, filterable view data', () => {
    const model = buildAssetCenterViewModel(snapshot, { keyword: 'release' });

    expect(model.stats.total).toBe(3);
    expect(model.stats.filtered).toBe(1);
    expect(model.stats.warnings).toBe(2);
    expect(model.items[0]?.id).toBe('role:qa-release-steward');
    expect(model.groups.find((group) => group.id === 'capabilities')?.count).toBe(1);
  });

  it('filters by group, kind, source, and status without mutating base options', () => {
    const model = buildAssetCenterViewModel(snapshot, {
      groupId: 'delivery',
      kind: 'workflow.artifact',
      source: 'generated',
      status: 'needsSetup',
    });

    expect(model.items.map((item) => item.id)).toEqual(['workflow.artifact:review_gate:12345678']);
    expect(model.kindOptions.map((option) => option.value)).toContain('concept.lowcode');
    expect(model.statusOptions.find((option) => option.value === 'needsSetup')?.tone).toBe(
      'warning'
    );
  });
});
