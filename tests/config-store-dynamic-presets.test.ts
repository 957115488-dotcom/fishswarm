import { describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  default: {
    app: {
      isPackaged: false,
      getPath: () => '/tmp',
      getVersion: () => '0.0.0',
    },
    ipcMain: { handle: vi.fn(), on: vi.fn(), removeHandler: vi.fn() },
    shell: {},
  },
  app: {
    isPackaged: false,
    getPath: () => '/tmp',
    getVersion: () => '0.0.0',
  },
  ipcMain: { handle: vi.fn(), on: vi.fn(), removeHandler: vi.fn() },
  shell: {},
}));

vi.mock('@mariozechner/pi-ai', () => ({
  getModels: (provider: string) => {
    if (provider === 'openai') {
      return [
        { id: 'gpt-5.4', name: 'GPT-5.4' },
        { id: 'gpt-5.4-mini', name: 'GPT-5.4 mini' },
        { id: 'gpt-5.4-nano', name: 'GPT-5.4 nano' },
      ];
    }
    return [];
  },
}));

import { getPiAiModelPresets } from '../src/main/config/config-store';

describe('getPiAiModelPresets', () => {
  it('keeps curated fallback models when the pi-ai registry is behind', async () => {
    const presets = await getPiAiModelPresets();
    const openaiIds = presets.openai.models.map((model) => model.id);

    expect(openaiIds).toContain('gpt-5.5');
    expect(openaiIds).toContain('gpt-5.4');
    expect(presets.openai.models.find((model) => model.id === 'gpt-5.4-mini')?.name).toBe(
      'GPT-5.4 mini'
    );
  });
});
