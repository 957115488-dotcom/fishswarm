import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const completeSimpleMock = vi.hoisted(() => vi.fn());

vi.mock('@mariozechner/pi-ai', () => ({
  completeSimple: completeSimpleMock,
  getModel: vi.fn(() => undefined),
}));

vi.mock('../../main/claude/shared-auth', () => ({
  getSharedAuthStorage: () => ({
    setRuntimeApiKey: vi.fn(),
  }),
  ModelRegistry: vi.fn(),
}));

import type { AppConfig } from '../../main/config/config-store';
import {
  buildXiaoyuRoleModelSystemPrompt,
  runPiAiOneShot,
  runXiaoyuRoleModelTurn,
} from '../../main/claude/claude-sdk-one-shot';

function makeConfig(): AppConfig {
  return {
    provider: 'custom',
    customProtocol: 'openai',
    apiKey: 'test-key',
    baseUrl: 'https://example.test/v1',
    model: 'test-model',
    activeProfileKey: 'custom:openai',
    profiles: {},
    activeConfigSetId: 'default',
    configSets: [],
    claudeCodePath: '',
    defaultWorkdir: '',
    globalSkillsPath: '',
    enableDevLogs: false,
    theme: 'light',
    sandboxEnabled: false,
    memoryEnabled: true,
    memoryRuntime: {
      llm: {
        inheritFromActive: true,
        apiKey: '',
        baseUrl: '',
        model: '',
        timeoutMs: 180000,
      },
      embedding: {
        inheritFromActive: true,
        apiKey: '',
        baseUrl: '',
        model: 'text-embedding-3-small',
        timeoutMs: 180000,
      },
      useEmbedding: false,
      maxNavSteps: 2,
      ingestionConcurrency: 4,
      storageRoot: '',
      evalEnabled: false,
      evalWorkspaces: [],
      evalMaxRounds: 12,
      evalArtifactsRoot: '',
      promptIterationRounds: 2,
    },
    enableThinking: false,
    isConfigured: true,
  };
}

describe('runPiAiOneShot', () => {
  beforeEach(() => {
    completeSimpleMock.mockReset();
    vi.useRealTimers();
    completeSimpleMock.mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      stopReason: 'stop',
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes generation options through to completeSimple', async () => {
    await runPiAiOneShot('hello', 'system', makeConfig(), {
      temperature: 0.2,
      maxTokens: 1234,
    });

    expect(completeSimpleMock).toHaveBeenCalledTimes(1);
    expect(completeSimpleMock.mock.calls[0][2]).toMatchObject({
      apiKey: 'test-key',
      temperature: 0.2,
      maxTokens: 1234,
    });
    expect(completeSimpleMock.mock.calls[0][2].signal).toBeInstanceOf(AbortSignal);
  });

  it('times out stuck one-shot calls and aborts the provider request', async () => {
    vi.useFakeTimers();
    completeSimpleMock.mockImplementation(() => new Promise(() => {}));

    const pending = runPiAiOneShot('hello', 'system', makeConfig(), {
      timeoutMs: 10,
    });
    const assertion = expect(pending).rejects.toThrow(
      'One-shot model request timed out after 5000ms'
    );

    await vi.advanceTimersByTimeAsync(5000);

    await assertion;
    expect(completeSimpleMock.mock.calls[0][2].signal.aborted).toBe(true);
  });

  it('runs role turns through the Xiaoyu model route with mounted role identity', async () => {
    await runXiaoyuRoleModelTurn({
      mountedPrompt: 'mounted role prompt',
      role: { id: 'implementation-engineer', name: 'Implementation Engineer' },
      config: makeConfig(),
      options: { temperature: 0.2, maxTokens: 1800 },
    });

    expect(completeSimpleMock).toHaveBeenCalledTimes(1);
    expect(completeSimpleMock.mock.calls[0][1]).toMatchObject({
      systemPrompt: expect.stringContaining('Xiaoyu'),
      messages: [expect.objectContaining({ content: 'mounted role prompt' })],
    });
    expect(completeSimpleMock.mock.calls[0][1].systemPrompt).toContain(
      'Implementation Engineer (implementation-engineer)'
    );
    expect(completeSimpleMock.mock.calls[0][1].systemPrompt).toContain('answer as that role');
  });

  it('preserves thinking blocks from delegated role model turns', async () => {
    completeSimpleMock.mockResolvedValueOnce({
      content: [
        { type: 'thinking', thinking: 'role is inspecting scope and acceptance criteria' },
        { type: 'text', text: '{"status":"completed","summary":"ready"}' },
      ],
      stopReason: 'stop',
    });

    const result = await runXiaoyuRoleModelTurn({
      mountedPrompt: 'mounted role prompt',
      role: { id: 'product-strategist', name: 'Product Strategist' },
      config: makeConfig(),
    });

    expect(result.text).toBe('{"status":"completed","summary":"ready"}');
    expect(result.thinking).toBe('role is inspecting scope and acceptance criteria');
    expect(result.hasThinking).toBe(true);
  });

  it('builds a JSON-only system prompt for role handoffs back to Xiaoyu', () => {
    const prompt = buildXiaoyuRoleModelSystemPrompt({
      id: 'product-strategist',
      name: 'Product Strategist',
    });

    expect(prompt).toContain('Xiaoyu');
    expect(prompt).toContain('Product Strategist (product-strategist)');
    expect(prompt).toContain('Return the role result back to Xiaoyu as JSON only');
    expect(prompt).toContain('not as Xiaoyu');
  });
});
