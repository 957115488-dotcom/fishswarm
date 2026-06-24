import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const agentRunnerPath = path.resolve(process.cwd(), 'src/main/claude/agent-runner.ts');
const agentRunnerContent = readFileSync(agentRunnerPath, 'utf8');
const roleRuntimeStorePath = path.resolve(process.cwd(), 'src/main/roles/role-runtime-store.ts');
const roleRuntimeStoreContent = readFileSync(roleRuntimeStorePath, 'utf8');
const roleRuntimeServicePath = path.resolve(
  process.cwd(),
  'src/main/roles/role-runtime-service.ts'
);
const roleRuntimeServiceContent = readFileSync(roleRuntimeServicePath, 'utf8');

describe('ClaudeAgentRunner FishSwarm SDK integration', () => {
  it('avoids dynamic re-import shadowing for config store singletons', () => {
    expect(agentRunnerContent).toContain(
      "import { mcpConfigStore } from '../mcp/mcp-config-store'"
    );
    expect(agentRunnerContent).not.toContain(
      "const { configStore } = await import('../config/config-store')"
    );
    expect(agentRunnerContent).not.toContain(
      "const { mcpConfigStore } = await import('../mcp/mcp-config-store')"
    );
  });

  it('keeps MCP config build resilient', () => {
    expect(agentRunnerContent).toContain('function safeStringify');
    expect(agentRunnerContent).toContain('Failed to prepare MCP server config, skipping server');
  });

  it('uses standard markdown link guidance for sources citations', () => {
    expect(agentRunnerContent).toContain(
      'otherwise use standard Markdown links: [Title](https://claude.ai/chat/URL)'
    );
  });

  it('avoids duplicating the current user prompt in contextual history assembly', () => {
    expect(agentRunnerContent).toContain('const conversationMessages = existingMessages');
    // Image-containing messages are filtered out individually (not skipping entire history)
    expect(agentRunnerContent).toContain('const textOnlyMessages = conversationMessages');
    expect(agentRunnerContent).toContain('textOnlyMessages.slice(0, -1)');
    expect(agentRunnerContent).toContain(
      "textOnlyMessages[textOnlyMessages.length - 1]?.role === 'user'"
    );
  });

  it('keeps MCP server logging compact unless full debug logging is enabled', () => {
    expect(agentRunnerContent).toContain("log('[ClaudeAgentRunner] Final mcpServers summary:'");
    expect(agentRunnerContent).toContain('process.env.FISHSWARM_LOG_SDK_MESSAGES_FULL ||');
    expect(agentRunnerContent).toContain("process.env.COWORK_LOG_SDK_MESSAGES_FULL) === '1'");
    expect(agentRunnerContent).toContain("log('[ClaudeAgentRunner] Final mcpServers config:'");
  });

  it('summarizes noisy SDK message updates instead of logging every text delta', () => {
    expect(agentRunnerContent).toContain('const streamEventCounts = new Map<string, number>();');
    expect(agentRunnerContent).toContain(
      "if (updateType !== 'text_delta' && updateType !== 'thinking_delta') {"
    );
    expect(agentRunnerContent).toContain("'[ClaudeAgentRunner] Event: message_end'");
    expect(agentRunnerContent).toContain('messageUpdateCounts: getStreamEventSummary()');
    expect(agentRunnerContent).toContain('process.env.FISHSWARM_LOG_SDK_MESSAGES_FULL ||');
    expect(agentRunnerContent).toContain("process.env.COWORK_LOG_SDK_MESSAGES_FULL) === '1'");
    expect(agentRunnerContent).toContain("'[ClaudeAgentRunner] message_end raw message:'");
  });

  it('reuses the shared user-facing error helper', () => {
    expect(agentRunnerContent).toContain("from './agent-runner-message-end'");
    expect(agentRunnerContent).toContain('resolveMessageEndPayload');
    expect(agentRunnerContent).toContain('toUserFacingErrorText');
    expect(agentRunnerContent).toContain(
      'const errorText = toUserFacingErrorText(toErrorText(error));'
    );
  });

  it('uses pi DefaultResourceLoader with additionalSkillPaths and appendSystemPrompt', () => {
    expect(agentRunnerContent).toContain('additionalSkillPaths: skillPaths');
    expect(agentRunnerContent).toContain('appendSystemPrompt: fishSwarmAppendPrompt');
    expect(agentRunnerContent).not.toContain('systemPromptOverride');
  });

  it('recreates cached pi sessions when the runtime signature changes', () => {
    expect(agentRunnerContent).toContain(
      "import { buildPiSessionRuntimeSignature } from './pi-session-runtime'"
    );
    expect(agentRunnerContent).toContain(
      'const sessionRuntimeSignature = buildPiSessionRuntimeSignature({'
    );
    expect(agentRunnerContent).toContain(
      'cachedSession.runtimeSignature !== sessionRuntimeSignature'
    );
    expect(agentRunnerContent).toContain('Runtime changed, recreating cached pi session:');
    expect(agentRunnerContent).toContain('runtimeSignature: sessionRuntimeSignature');
  });

  it('uses the normalized route protocol so openrouter follows the openai-compatible path', () => {
    expect(agentRunnerContent).toContain('resolvePiRouteProtocol');
    expect(agentRunnerContent).toContain('const configProtocol = resolvePiRouteProtocol(');
    expect(agentRunnerContent).toContain('resolveSyntheticPiModelFallback');
  });

  it('nudges the model to proceed with reasonable assumptions', () => {
    expect(agentRunnerContent).toContain('proceed immediately with reasonable assumptions');
    expect(agentRunnerContent).toContain('within two days');
    expect(agentRunnerContent).toContain('most recent two relevant publication days');
  });

  it('routes MCP image results through structured helpers instead of stringifying base64 into text', () => {
    expect(agentRunnerContent).toContain(
      "import {\n  normalizeMcpToolResultForModel,\n  normalizeToolExecutionResultForUi,\n} from './tool-result-utils'"
    );
    expect(agentRunnerContent).toContain(
      'const normalizedResult = normalizeMcpToolResultForModel(result);'
    );
    expect(agentRunnerContent).toContain(
      'const normalizedToolResult = normalizeToolExecutionResultForUi(event.result);'
    );
    expect(agentRunnerContent).not.toContain('else textParts.push(JSON.stringify(part));');
    expect(agentRunnerContent).not.toContain(": JSON.stringify(event.result || '');");
  });

  it('persists assistant model metadata for pi-ai thinking replay', () => {
    expect(agentRunnerContent).toContain('api: piModel.api');
    expect(agentRunnerContent).toContain('provider: piModel.provider');
    expect(agentRunnerContent).toContain('model: piModel.id');
  });

  it('does not reference removed AskUserQuestion or TodoWrite tools', () => {
    expect(agentRunnerContent).not.toContain('AskUserQuestion');
    expect(agentRunnerContent).not.toContain('TodoWrite');
    expect(agentRunnerContent).not.toContain('pendingQuestions');
  });

  it('chat-first behavioral rules are present', () => {
    expect(agentRunnerContent).toContain('CHAT FIRST');
    expect(agentRunnerContent).toContain(
      'Do NOT create, write, or edit files unless the user explicitly asks'
    );
    expect(agentRunnerContent).toContain('START DOING IT');
  });

  it('enforces mandatory role delegation instead of advisory role output', () => {
    expect(agentRunnerContent).toContain('XIAOYU FIRST: You are Xiaoyu');
    expect(agentRunnerContent).toContain('two-step visible protocol');
    expect(agentRunnerContent).toContain('After every role handoff');
    expect(agentRunnerContent).toContain('send it back for rework');
    expect(agentRunnerContent).toContain('Implementation Engineer');
    expect(agentRunnerContent).toContain('IMPLEMENTATION EXECUTION ROLE ACTIVE');
    expect(agentRunnerContent).toContain('Xiaoyu must not personally write files');
    expect(agentRunnerContent).toContain('Xiaoyu must not personally claim the execution');
    expect(agentRunnerContent).toContain("this.sendToRenderer({ type: 'swarm.event'");
    expect(agentRunnerContent).toContain('emitRoleThinkingSwarmEvent');
    expect(agentRunnerContent).toContain("type: 'role.thinking'");
    expect(roleRuntimeStoreContent).toContain('这个任务交给你处理');
    expect(roleRuntimeStoreContent).toContain('收到');
    expect(roleRuntimeStoreContent).toContain('预计交付给你');
    expect(roleRuntimeStoreContent).toContain('验收通过');
    expect(roleRuntimeStoreContent).toContain('需要返工');
    expect(roleRuntimeServiceContent).toContain('这版我先打回');
    expect(roleRuntimeServiceContent).toContain('先不交给下一个角色');
    expect(agentRunnerContent).not.toContain('ROLE_DIALOGUE_MESSAGE_DELAY_MS');
    expect(agentRunnerContent).not.toContain('splitVisibleRoleDialogueMessage');
    expect(agentRunnerContent).not.toContain('queueRoleDialogueMessages');
    expect(agentRunnerContent).not.toContain('flushRoleDialogueQueue');
    expect(agentRunnerContent).toContain('Failed Xiaoyu acceptance logs');
    expect(agentRunnerContent).toContain('must not present downstream plans');
    expect(agentRunnerContent).toContain('emitRunResult: (result, handoff)');
    expect(agentRunnerContent).toContain('Internal role result');
    expect(agentRunnerContent).toContain('## Role Orchestration - Mandatory Delegation');
    expect(agentRunnerContent).toContain(
      '## Internal Role Coordination Digest - Mandatory Delegation'
    );
    expect(agentRunnerContent).toContain(
      'MANDATORY XIAOYU COORDINATOR MODE: You are Xiaoyu, the user-facing coordinator.'
    );
    expect(agentRunnerContent).toContain('Do not dump raw role notes');
    expect(agentRunnerContent).toContain(
      'Do not independently perform substantive implementation, research, architecture, review, or file-operation work'
    );
    expect(agentRunnerContent).toContain(
      'While this gate is not passed, do not call write/edit/bash/read/list tools'
    );
    expect(agentRunnerContent).toContain('Role outputs are binding task contributions.');
    expect(agentRunnerContent).not.toContain('Role outputs are advisory.');
  });

  it('blocks normal fallback when the role runtime fails', () => {
    expect(agentRunnerContent).toContain('function buildRoleRuntimeFailurePrompt');
    expect(agentRunnerContent).toContain('## Role Collaboration Gate - Failed');
    expect(agentRunnerContent).toContain(
      'Because the role runtime failed, do not continue with implementation, research, architecture, review, file edits, or tool-use planning as the main AI.'
    );
    expect(agentRunnerContent).toContain(
      "logWarn('[ClaudeAgentRunner] Role runtime failed; returning delegation gate prompt:'"
    );
    expect(agentRunnerContent).toContain('prompt: buildRoleRuntimeFailurePrompt(summary)');
    expect(agentRunnerContent).not.toContain(
      "logWarn('[ClaudeAgentRunner] Role runtime failed; continuing normal run:'"
    );
  });

  it('runs delegated role workers through complete agent sessions', () => {
    expect(agentRunnerContent).toContain('runDelegatedRoleAgentSession');
    expect(agentRunnerContent).toContain('createAgentSession');
    expect(agentRunnerContent).toContain('buildRoleAgentAppendSystemPrompt');
    expect(agentRunnerContent).toContain('ROLE_AGENT_SESSION_TIMEOUT_MS');
    expect(agentRunnerContent).not.toContain('runXiaoyuRoleModelTurn');
  });

  it('surfaces delegated role thinking as separate thinking messages', () => {
    expect(agentRunnerContent).toContain('function buildVisibleRoleThinkingText');
    expect(agentRunnerContent).toContain('emitRoleThinkingSwarmEvent');
    expect(agentRunnerContent).toContain('appendRoleThinking');
    expect(agentRunnerContent).toContain('flushRoleThinking');
    expect(agentRunnerContent).toContain("type: 'role.thinking'");
    expect(agentRunnerContent).toContain("this.sendToRenderer({ type: 'swarm.event'");
  });

  it('prevents the coordinator from pretending to restart roles mid-response', () => {
    expect(agentRunnerContent).toContain(
      'If a role found a problem that can be handled with the available role outputs'
    );
    expect(agentRunnerContent).toContain('which specialist role should handle it next');
    expect(agentRunnerContent).toContain('Use this compact internal digest');
  });
});
