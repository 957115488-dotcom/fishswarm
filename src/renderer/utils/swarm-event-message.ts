import type { SwarmEvent, SwarmEventType } from '../../shared/ipc-types';
import type { Message } from '../types';

const CHAT_VISIBLE_EVENT_TYPES = new Set<SwarmEventType>([
  'xiaoyu.dispatch',
  'role.plan',
  'role.delivery',
  'validation.accepted',
  'validation.needs_revision',
  'validation.blocked',
  'xiaoyu.rework',
  'xiaoyu.pause',
  'xiaoyu.next_role',
  'xiaoyu.final',
]);

export function isSwarmEventVisibleInChat(event: SwarmEvent): boolean {
  return CHAT_VISIBLE_EVENT_TYPES.has(event.type) && Boolean(event.content.trim());
}

export function swarmEventToMessage(event: SwarmEvent): Message | null {
  if (!event.sessionId || !isSwarmEventVisibleInChat(event)) return null;
  const timestamp = Date.parse(event.createdAt);
  return {
    id: `swarm-${event.id}`,
    sessionId: event.sessionId,
    role: 'assistant',
    content:
      event.type === 'role.thinking'
        ? [{ type: 'thinking', thinking: event.content }]
        : [{ type: 'text', text: event.content }],
    timestamp: Number.isNaN(timestamp) ? Date.now() : timestamp,
  };
}
