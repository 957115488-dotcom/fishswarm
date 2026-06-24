import { describe, expect, it } from 'vitest';
import type { SwarmEvent } from '../../shared/ipc-types';
import { swarmEventToMessage } from '../../renderer/utils/swarm-event-message';

const baseEvent: SwarmEvent = {
  id: 'event-1',
  runId: 'run-1',
  sessionId: 's1',
  type: 'role.plan',
  speaker: '产品策略师',
  target: 'xiaoyu',
  roleId: 'product-strategist',
  roleName: '产品策略师',
  taskId: 'task-1',
  status: 'running',
  content: '产品策略师：@小鱼，收到。我会先判断范围。',
  createdAt: '2026-06-21T12:00:00.000Z',
};

describe('swarm event chat messages', () => {
  it('turns visible swarm events into stable assistant messages', () => {
    const message = swarmEventToMessage(baseEvent);

    expect(message).toMatchObject({
      id: 'swarm-event-1',
      sessionId: 's1',
      role: 'assistant',
      content: [{ type: 'text', text: baseEvent.content }],
    });
  });

  it('keeps role thinking swarm events out of the main chat stream', () => {
    const message = swarmEventToMessage({
      ...baseEvent,
      id: 'thinking-1',
      type: 'role.thinking',
      content: '产品策略师：正在分析任务并检查必要信息。',
    });

    expect(message).toBeNull();
  });

  it('skips operational swarm events that should only appear in the side panel', () => {
    expect(swarmEventToMessage({ ...baseEvent, type: 'role.online' })).toBeNull();
    expect(swarmEventToMessage({ ...baseEvent, type: 'validation.started' })).toBeNull();
  });
});
