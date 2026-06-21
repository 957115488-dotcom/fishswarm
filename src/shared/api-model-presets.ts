export type SharedProviderType =
  | 'openrouter'
  | 'anthropic'
  | 'custom'
  | 'openai'
  | 'gemini'
  | 'ollama';

export type SharedCustomProtocolType = 'anthropic' | 'openai' | 'gemini';

export interface SharedProviderPreset {
  name: string;
  baseUrl: string;
  models: Array<{ id: string; name: string }>;
  keyPlaceholder: string;
  keyHint: string;
}

export interface SharedProviderPresets {
  openrouter: SharedProviderPreset;
  anthropic: SharedProviderPreset;
  custom: SharedProviderPreset;
  openai: SharedProviderPreset;
  gemini: SharedProviderPreset;
  ollama: SharedProviderPreset;
}

export interface ModelInputGuidance {
  placeholder: string;
  hint: string;
}

export const API_PROVIDER_PRESETS: SharedProviderPresets = {
  openrouter: {
    name: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    models: [
      { id: 'anthropic/claude-fable-5', name: 'anthropic/claude-fable-5' },
      { id: 'anthropic/claude-opus-4.8', name: 'anthropic/claude-opus-4.8' },
      { id: 'anthropic/claude-sonnet-4.6', name: 'anthropic/claude-sonnet-4.6' },
      { id: 'anthropic/claude-haiku-4.5', name: 'anthropic/claude-haiku-4.5' },
      { id: 'openai/gpt-5.5-pro', name: 'openai/gpt-5.5-pro' },
      { id: 'openai/gpt-5.5', name: 'openai/gpt-5.5' },
      { id: 'openai/gpt-5.4', name: 'openai/gpt-5.4' },
      { id: 'openai/gpt-5.4-mini', name: 'openai/gpt-5.4-mini' },
      { id: 'google/gemini-3.1-pro-preview', name: 'google/gemini-3.1-pro-preview' },
      { id: 'google/gemini-3.5-flash', name: 'google/gemini-3.5-flash' },
      { id: 'google/gemini-3-flash-preview', name: 'google/gemini-3-flash-preview' },
      { id: 'google/gemini-3.1-flash-lite', name: 'google/gemini-3.1-flash-lite' },
    ],
    keyPlaceholder: 'sk-or-v1-...',
    keyHint: '从 openrouter.ai/keys 获取',
  },
  anthropic: {
    name: 'Anthropic',
    baseUrl: 'https://api.anthropic.com',
    models: [
      { id: 'claude-fable-5', name: 'claude-fable-5' },
      { id: 'claude-opus-4-8', name: 'claude-opus-4-8' },
      { id: 'claude-sonnet-4-6', name: 'claude-sonnet-4-6' },
      { id: 'claude-haiku-4-5', name: 'claude-haiku-4-5' },
    ],
    keyPlaceholder: 'sk-ant-...',
    keyHint: '从 console.anthropic.com 获取',
  },
  openai: {
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-5.5', name: 'gpt-5.5' },
      { id: 'gpt-5.4', name: 'gpt-5.4' },
      { id: 'gpt-5.4-mini', name: 'gpt-5.4-mini' },
      { id: 'gpt-5.4-nano', name: 'gpt-5.4-nano' },
    ],
    keyPlaceholder: 'sk-...',
    keyHint: '从 platform.openai.com 获取',
  },
  gemini: {
    name: 'Gemini',
    baseUrl: 'https://generativelanguage.googleapis.com',
    models: [
      { id: 'gemini-3.1-pro-preview', name: 'gemini-3.1-pro-preview' },
      { id: 'gemini-3.5-flash', name: 'gemini-3.5-flash' },
      { id: 'gemini-3-flash-preview', name: 'gemini-3-flash-preview' },
      { id: 'gemini-3.1-flash-lite', name: 'gemini-3.1-flash-lite' },
      { id: 'gemini-2.5-pro', name: 'gemini-2.5-pro' },
      { id: 'gemini-2.5-flash', name: 'gemini-2.5-flash' },
      { id: 'gemini-2.5-flash-lite', name: 'gemini-2.5-flash-lite' },
    ],
    keyPlaceholder: 'AIza...',
    keyHint: '从 aistudio.google.com 获取',
  },
  ollama: {
    name: 'Ollama',
    baseUrl: 'http://localhost:11434/v1',
    models: [
      { id: 'qwen3.5:0.8b', name: 'qwen3.5:0.8b' },
      { id: 'llama3.2:latest', name: 'llama3.2:latest' },
      { id: 'deepseek-r1:latest', name: 'deepseek-r1:latest' },
    ],
    keyPlaceholder: '可留空',
    keyHint: '多数 Ollama 部署可留空；如果你的代理层要求鉴权，也可以填写 Key',
  },
  custom: {
    name: '更多模型',
    baseUrl: '',
    models: [
      { id: 'deepseek-chat', name: 'deepseek-chat' },
      { id: 'deepseek-reasoner', name: 'deepseek-reasoner' },
      { id: 'deepseek-v4-pro', name: 'deepseek-v4-pro' },
      { id: 'agnes-2.0-flash', name: 'agnes-2.0-flash' },
      { id: 'kimi-k2-thinking', name: 'kimi-k2-thinking' },
      { id: 'glm-5', name: 'glm-5' },
      { id: 'MiniMax-M2.5', name: 'MiniMax-M2.5' },
      { id: 'qwen-max', name: 'qwen-max' },
      { id: 'grok-code-fast-1', name: 'grok-code-fast-1' },
      { id: 'mistral-large-latest', name: 'mistral-large-latest' },
    ],
    keyPlaceholder: 'sk-xxx',
    keyHint: '输入你的 API Key',
  },
};

export const PI_AI_CURATED_PRESETS: Record<string, { piProvider: string; pick: string[] }> = {
  openrouter: {
    piProvider: 'openrouter',
    pick: [
      'anthropic/claude-fable-5',
      'anthropic/claude-opus-4.8',
      'anthropic/claude-sonnet-4.6',
      'anthropic/claude-haiku-4.5',
      'openai/gpt-5.5-pro',
      'openai/gpt-5.5',
      'openai/gpt-5.4',
      'openai/gpt-5.4-mini',
      'google/gemini-3.1-pro-preview',
      'google/gemini-3.5-flash',
      'google/gemini-3-flash-preview',
      'google/gemini-3.1-flash-lite',
    ],
  },
  anthropic: {
    piProvider: 'anthropic',
    pick: ['claude-fable-5', 'claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
  },
  openai: {
    piProvider: 'openai',
    pick: ['gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-5.4-nano'],
  },
  gemini: {
    piProvider: 'google',
    pick: [
      'gemini-3.1-pro-preview',
      'gemini-3.5-flash',
      'gemini-3-flash-preview',
      'gemini-3.1-flash-lite',
      'gemini-2.5-pro',
      'gemini-2.5-flash',
      'gemini-2.5-flash-lite',
    ],
  },
};

export function getModelInputGuidance(
  provider: SharedProviderType,
  customProtocol: SharedCustomProtocolType = 'anthropic'
): ModelInputGuidance {
  if (provider === 'openrouter') {
    return {
      placeholder: 'openai/gpt-5.5, anthropic/claude-fable-5, google/gemini-3.5-flash',
      hint: 'Use the exact model ID for the selected protocol or endpoint.',
    };
  }

  if (provider === 'custom' && customProtocol === 'openai') {
    return {
      placeholder: 'agnes-2.0-flash, deepseek-chat, qwen-max, gpt-5.5',
      hint: 'Use the exact model ID for the selected protocol or endpoint.',
    };
  }

  if (provider === 'custom' && customProtocol === 'gemini') {
    return {
      placeholder: 'gemini-3.1-pro-preview, gemini-3.5-flash, gemini-3-flash-preview',
      hint: 'Use the exact model ID for the selected protocol or endpoint.',
    };
  }

  if (provider === 'custom') {
    return {
      placeholder: 'glm-5, kimi-k2-thinking, claude-fable-5',
      hint: 'Use the exact model ID for the selected protocol or endpoint.',
    };
  }

  if (provider === 'openai') {
    return {
      placeholder: 'gpt-5.5, gpt-5.4-mini, gpt-5.4-nano',
      hint: 'Use the exact model ID for the selected protocol or endpoint.',
    };
  }

  if (provider === 'ollama') {
    return {
      placeholder: 'qwen3.5:0.8b, llama3.2:latest, deepseek-r1:latest',
      hint: 'Use the exact model ID returned by your Ollama server.',
    };
  }

  if (provider === 'gemini') {
    return {
      placeholder: 'gemini-3.1-pro-preview, gemini-3.5-flash, gemini-3-flash-preview',
      hint: 'Use the exact model ID for the selected protocol or endpoint.',
    };
  }

  return {
    placeholder: 'claude-fable-5, claude-opus-4-8, claude-sonnet-4-6',
    hint: 'Use the exact model ID for the selected protocol or endpoint.',
  };
}
