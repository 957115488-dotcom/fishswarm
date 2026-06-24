import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../renderer/store';
import type { MountedPath } from '../../renderer/types';
import type { RoleLifecycleEvent, SwarmEvent, ValidationLog } from '../../shared/ipc-types';

// Reset store before each test
beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState());
});

describe('SessionState unified store', () => {
  const makeSession = (id: string) => ({
    id,
    title: `Session ${id}`,
    status: 'idle' as const,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    cwd: '/tmp',
    mountedPaths: [] as MountedPath[],
    allowedTools: [] as string[],
    memoryEnabled: false,
  });

  describe('addSession', () => {
    it('should initialize sessionStates entry with defaults', () => {
      const session = makeSession('s1');
      useAppStore.getState().addSession(session);

      const state = useAppStore.getState();
      expect(state.sessions).toHaveLength(1);
      expect(state.sessionStates['s1']).toBeDefined();
      expect(state.sessionStates['s1'].messages).toEqual([]);
      expect(state.sessionStates['s1'].partialMessage).toBe('');
      expect(state.sessionStates['s1'].partialThinking).toBe('');
      expect(state.sessionStates['s1'].pendingTurns).toEqual([]);
      expect(state.sessionStates['s1'].activeTurn).toBeNull();
      expect(state.sessionStates['s1'].executionClock).toEqual({ startAt: null, endAt: null });
      expect(state.sessionStates['s1'].traceSteps).toEqual([]);
      expect(state.sessionStates['s1'].roleEvents).toEqual([]);
      expect(state.sessionStates['s1'].swarmEvents).toEqual([]);
      expect(state.sessionStates['s1'].validationLogs).toEqual([]);
      expect(state.sessionStates['s1'].contextWindow).toBe(0);
    });
  });

  describe('removeSession', () => {
    it('should remove sessionStates entry', () => {
      const session = makeSession('s1');
      useAppStore.getState().addSession(session);
      expect(useAppStore.getState().sessionStates['s1']).toBeDefined();

      useAppStore.getState().removeSession('s1');
      expect(useAppStore.getState().sessionStates['s1']).toBeUndefined();
      expect(useAppStore.getState().sessions).toHaveLength(0);
    });

    it('should clear activeSessionId when removing active session', () => {
      const session = makeSession('s1');
      useAppStore.getState().addSession(session);
      useAppStore.getState().setActiveSession('s1');
      useAppStore.getState().removeSession('s1');
      expect(useAppStore.getState().activeSessionId).toBeNull();
    });
  });

  describe('removeSessions (batch)', () => {
    it('should remove multiple sessions at once', () => {
      useAppStore.getState().addSession(makeSession('s1'));
      useAppStore.getState().addSession(makeSession('s2'));
      useAppStore.getState().addSession(makeSession('s3'));
      expect(Object.keys(useAppStore.getState().sessionStates)).toHaveLength(3);

      useAppStore.getState().removeSessions(['s1', 's3']);
      const state = useAppStore.getState();
      expect(state.sessions).toHaveLength(1);
      expect(state.sessions[0].id).toBe('s2');
      expect(state.sessionStates['s1']).toBeUndefined();
      expect(state.sessionStates['s2']).toBeDefined();
      expect(state.sessionStates['s3']).toBeUndefined();
    });
  });

  describe('messages', () => {
    it('should add user messages and track pending turns', () => {
      useAppStore.getState().addSession(makeSession('s1'));
      const msg = {
        id: 'msg1',
        sessionId: 's1',
        role: 'user' as const,
        content: [{ type: 'text' as const, text: 'hello' }],
        timestamp: Date.now(),
      };
      useAppStore.getState().addMessage('s1', msg);

      const ss = useAppStore.getState().sessionStates['s1'];
      expect(ss.messages).toHaveLength(1);
      expect(ss.pendingTurns).toEqual(['msg1']);
    });

    it('should clear partials when adding assistant message', () => {
      useAppStore.getState().addSession(makeSession('s1'));
      useAppStore.getState().setPartialMessage('s1', 'chunk1');
      useAppStore.getState().setPartialThinking('s1', 'think1');

      const assistantMsg = {
        id: 'msg2',
        sessionId: 's1',
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: 'response' }],
        timestamp: Date.now(),
      };
      useAppStore.getState().addMessage('s1', assistantMsg);

      const ss = useAppStore.getState().sessionStates['s1'];
      expect(ss.messages).toHaveLength(1);
      expect(ss.partialMessage).toBe('');
      expect(ss.partialThinking).toBe('');
    });

    it('should replace duplicate message ids instead of appending replayed swarm messages', () => {
      useAppStore.getState().addSession(makeSession('s1'));

      useAppStore.getState().addMessage('s1', {
        id: 'swarm-event-1',
        sessionId: 's1',
        role: 'assistant',
        content: [{ type: 'text', text: 'first' }],
        timestamp: 1,
      });
      useAppStore.getState().addMessage('s1', {
        id: 'swarm-event-1',
        sessionId: 's1',
        role: 'assistant',
        content: [{ type: 'text', text: 'latest' }],
        timestamp: 2,
      });

      const ss = useAppStore.getState().sessionStates['s1'];
      expect(ss.messages).toHaveLength(1);
      expect(ss.messages[0].content).toEqual([{ type: 'text', text: 'latest' }]);
    });

    it('should set messages (bulk replace)', () => {
      useAppStore.getState().addSession(makeSession('s1'));
      const msgs = [
        {
          id: 'a',
          sessionId: 's1',
          role: 'user' as const,
          content: [{ type: 'text' as const, text: 'hi' }],
          timestamp: 1,
        },
        {
          id: 'b',
          sessionId: 's1',
          role: 'assistant' as const,
          content: [{ type: 'text' as const, text: 'hello' }],
          timestamp: 2,
        },
      ];
      useAppStore.getState().setMessages('s1', msgs);
      expect(useAppStore.getState().sessionStates['s1'].messages).toHaveLength(2);
    });
  });

  describe('partials', () => {
    it('should accumulate partial message deltas', () => {
      useAppStore.getState().addSession(makeSession('s1'));
      useAppStore.getState().setPartialMessage('s1', 'Hello');
      useAppStore.getState().setPartialMessage('s1', ' world');
      expect(useAppStore.getState().sessionStates['s1'].partialMessage).toBe('Hello world');
    });

    it('should clear partial message', () => {
      useAppStore.getState().addSession(makeSession('s1'));
      useAppStore.getState().setPartialMessage('s1', 'data');
      useAppStore.getState().clearPartialMessage('s1');
      expect(useAppStore.getState().sessionStates['s1'].partialMessage).toBe('');
    });

    it('should accumulate partial thinking deltas', () => {
      useAppStore.getState().addSession(makeSession('s1'));
      useAppStore.getState().setPartialThinking('s1', 'think');
      useAppStore.getState().setPartialThinking('s1', 'ing');
      expect(useAppStore.getState().sessionStates['s1'].partialThinking).toBe('thinking');
    });

    it('should clear partial thinking', () => {
      useAppStore.getState().addSession(makeSession('s1'));
      useAppStore.getState().setPartialThinking('s1', 'data');
      useAppStore.getState().clearPartialThinking('s1');
      expect(useAppStore.getState().sessionStates['s1'].partialThinking).toBe('');
    });
  });

  describe('execution clock', () => {
    it('should start and finish execution clock', () => {
      useAppStore.getState().addSession(makeSession('s1'));
      useAppStore.getState().startExecutionClock('s1', 1000);
      expect(useAppStore.getState().sessionStates['s1'].executionClock).toEqual({
        startAt: 1000,
        endAt: null,
      });

      useAppStore.getState().finishExecutionClock('s1', 2000);
      expect(useAppStore.getState().sessionStates['s1'].executionClock).toEqual({
        startAt: 1000,
        endAt: 2000,
      });
    });

    it('should not finish clock if never started', () => {
      useAppStore.getState().addSession(makeSession('s1'));
      useAppStore.getState().finishExecutionClock('s1', 2000);
      expect(useAppStore.getState().sessionStates['s1'].executionClock).toEqual({
        startAt: null,
        endAt: null,
      });
    });

    it('should clear execution clock', () => {
      useAppStore.getState().addSession(makeSession('s1'));
      useAppStore.getState().startExecutionClock('s1', 1000);
      useAppStore.getState().clearExecutionClock('s1');
      expect(useAppStore.getState().sessionStates['s1'].executionClock).toEqual({
        startAt: null,
        endAt: null,
      });
    });
  });

  describe('turns', () => {
    it('should activate next turn from pending queue', () => {
      useAppStore.getState().addSession(makeSession('s1'));
      // Add a user message to create pending turn
      useAppStore.getState().addMessage('s1', {
        id: 'msg1',
        sessionId: 's1',
        role: 'user',
        content: [{ type: 'text', text: 'test' }],
        timestamp: Date.now(),
      });
      expect(useAppStore.getState().sessionStates['s1'].pendingTurns).toEqual(['msg1']);

      useAppStore.getState().activateNextTurn('s1', 'step1');
      const ss = useAppStore.getState().sessionStates['s1'];
      expect(ss.pendingTurns).toEqual([]);
      expect(ss.activeTurn).toEqual({ stepId: 'step1', userMessageId: 'msg1' });
    });

    it('should set activeTurn to null when no pending turns', () => {
      useAppStore.getState().addSession(makeSession('s1'));
      useAppStore.getState().activateNextTurn('s1', 'step1');
      expect(useAppStore.getState().sessionStates['s1'].activeTurn).toBeNull();
    });

    it('should update active turn step', () => {
      useAppStore.getState().addSession(makeSession('s1'));
      // Setup an active turn first
      useAppStore.getState().addMessage('s1', {
        id: 'msg1',
        sessionId: 's1',
        role: 'user',
        content: [{ type: 'text', text: 'test' }],
        timestamp: Date.now(),
      });
      useAppStore.getState().activateNextTurn('s1', 'step1');
      useAppStore.getState().updateActiveTurnStep('s1', 'step2');
      expect(useAppStore.getState().sessionStates['s1'].activeTurn).toEqual({
        stepId: 'step2',
        userMessageId: 'msg1',
      });
    });

    it('should clear active turn', () => {
      useAppStore.getState().addSession(makeSession('s1'));
      useAppStore.getState().addMessage('s1', {
        id: 'msg1',
        sessionId: 's1',
        role: 'user',
        content: [{ type: 'text', text: 'test' }],
        timestamp: Date.now(),
      });
      useAppStore.getState().activateNextTurn('s1', 'step1');
      useAppStore.getState().clearActiveTurn('s1');
      expect(useAppStore.getState().sessionStates['s1'].activeTurn).toBeNull();
    });

    it('should only clear active turn when stepId matches', () => {
      useAppStore.getState().addSession(makeSession('s1'));
      useAppStore.getState().addMessage('s1', {
        id: 'msg1',
        sessionId: 's1',
        role: 'user',
        content: [{ type: 'text', text: 'test' }],
        timestamp: Date.now(),
      });
      useAppStore.getState().activateNextTurn('s1', 'step1');
      // Try clearing with wrong stepId - should not clear
      useAppStore.getState().clearActiveTurn('s1', 'wrong-step');
      expect(useAppStore.getState().sessionStates['s1'].activeTurn).not.toBeNull();
      // Clear with correct stepId
      useAppStore.getState().clearActiveTurn('s1', 'step1');
      expect(useAppStore.getState().sessionStates['s1'].activeTurn).toBeNull();
    });

    it('should clear pending turns', () => {
      useAppStore.getState().addSession(makeSession('s1'));
      useAppStore.getState().addMessage('s1', {
        id: 'msg1',
        sessionId: 's1',
        role: 'user',
        content: [{ type: 'text', text: 'test' }],
        timestamp: Date.now(),
      });
      expect(useAppStore.getState().sessionStates['s1'].pendingTurns).toHaveLength(1);
      useAppStore.getState().clearPendingTurns('s1');
      expect(useAppStore.getState().sessionStates['s1'].pendingTurns).toEqual([]);
    });
  });

  describe('queued messages', () => {
    it('should clear queued message status', () => {
      useAppStore.getState().addSession(makeSession('s1'));
      // Manually set messages with queued status
      useAppStore.getState().setMessages('s1', [
        {
          id: 'msg1',
          sessionId: 's1',
          role: 'user',
          content: [{ type: 'text', text: 'a' }],
          timestamp: 1,
          localStatus: 'queued',
        },
        {
          id: 'msg2',
          sessionId: 's1',
          role: 'user',
          content: [{ type: 'text', text: 'b' }],
          timestamp: 2,
        },
      ]);
      useAppStore.getState().clearQueuedMessages('s1');
      const msgs = useAppStore.getState().sessionStates['s1'].messages;
      expect(msgs[0].localStatus).toBeUndefined();
      expect(msgs[1].localStatus).toBeUndefined();
    });

    it('should cancel queued messages', () => {
      useAppStore.getState().addSession(makeSession('s1'));
      useAppStore.getState().setMessages('s1', [
        {
          id: 'msg1',
          sessionId: 's1',
          role: 'user',
          content: [{ type: 'text', text: 'a' }],
          timestamp: 1,
          localStatus: 'queued',
        },
      ]);
      useAppStore.getState().cancelQueuedMessages('s1');
      expect(useAppStore.getState().sessionStates['s1'].messages[0].localStatus).toBe('cancelled');
    });
  });

  describe('trace steps', () => {
    it('should add and update trace steps', () => {
      useAppStore.getState().addSession(makeSession('s1'));
      const step = {
        id: 'ts1',
        type: 'tool_call' as const,
        status: 'running' as const,
        title: 'read',
        toolName: 'read',
        timestamp: Date.now(),
      };
      useAppStore.getState().addTraceStep('s1', step);
      expect(useAppStore.getState().sessionStates['s1'].traceSteps).toHaveLength(1);

      useAppStore.getState().updateTraceStep('s1', 'ts1', { status: 'completed' as const });
      expect(useAppStore.getState().sessionStates['s1'].traceSteps[0].status).toBe('completed');
    });

    it('should set trace steps (bulk replace)', () => {
      useAppStore.getState().addSession(makeSession('s1'));
      const steps = [
        {
          id: 'ts1',
          type: 'tool_call' as const,
          status: 'completed' as const,
          title: 'read',
          toolName: 'read',
          timestamp: 1,
        },
        {
          id: 'ts2',
          type: 'thinking' as const,
          status: 'completed' as const,
          title: 'thinking',
          timestamp: 2,
        },
      ];
      useAppStore.getState().setTraceSteps('s1', steps);
      expect(useAppStore.getState().sessionStates['s1'].traceSteps).toHaveLength(2);
    });
  });

  describe('context window', () => {
    it('should set session context window', () => {
      useAppStore.getState().addSession(makeSession('s1'));
      useAppStore.getState().setSessionContextWindow('s1', 200000);
      expect(useAppStore.getState().sessionStates['s1'].contextWindow).toBe(200000);
    });
  });

  describe('role runtime', () => {
    const makeRoleEvent = (index: number): RoleLifecycleEvent => ({
      id: `event-${index}`,
      ts: new Date(index).toISOString(),
      sessionId: 's1',
      taskId: 'task-1',
      runId: 'run-1',
      roleId: 'engineering-architect',
      roleName: 'Engineering Architect',
      status: 'mounting_handbook',
      summary: `Mounting role handbook ${index}.`,
    });

    const makeValidationLog = (index: number): ValidationLog => ({
      validationId: `validation-${index}`,
      taskId: 'task-1',
      sessionId: 's1',
      validatorRoleId: 'qa-release-steward',
      validatorRoleName: 'QA / Release Steward',
      checkedRoleRunIds: [`run-${index}`],
      verdict: 'passed',
      summary: `Validation passed ${index}.`,
      acceptedFindings: [],
      requiredRework: [],
      createdAt: new Date(index).toISOString(),
    });

    const makeSwarmEvent = (index: number): SwarmEvent => ({
      id: `swarm-${index}`,
      runId: `run-${index}`,
      sessionId: 's1',
      type: 'role.plan',
      speaker: 'Engineering Architect',
      target: 'xiaoyu',
      roleId: 'engineering-architect',
      roleName: 'Engineering Architect',
      taskId: 'task-1',
      status: 'running',
      content: `Engineering Architect plan ${index}.`,
      createdAt: new Date(index).toISOString(),
    });

    it('stores role lifecycle events and validation logs per session', () => {
      useAppStore.getState().addSession(makeSession('s1'));

      const event = makeRoleEvent(1);
      const log = makeValidationLog(1);

      useAppStore.getState().addRoleLifecycleEvent('s1', event);
      useAppStore.getState().addSwarmEvent('s1', makeSwarmEvent(1));
      useAppStore.getState().addValidationLog('s1', log);

      const state = useAppStore.getState().sessionStates['s1'];
      expect(state.roleEvents[0].id).toBe('event-1');
      expect(state.swarmEvents[0].id).toBe('swarm-1');
      expect(state.validationLogs[0].validationId).toBe('validation-1');
    });

    it('deduplicates swarm events by event id', () => {
      useAppStore.getState().addSession(makeSession('s1'));

      useAppStore.getState().addSwarmEvent('s1', makeSwarmEvent(1));
      useAppStore.getState().addSwarmEvent('s1', {
        ...makeSwarmEvent(1),
        content: 'Latest role plan event.',
      });

      let state = useAppStore.getState().sessionStates['s1'];
      expect(state.swarmEvents).toHaveLength(1);
      expect(state.swarmEvents[0].content).toBe('Latest role plan event.');

      useAppStore.getState().setRoleRuntimeState('s1', {
        swarmEvents: [makeSwarmEvent(2), makeSwarmEvent(2), makeSwarmEvent(3)],
      });

      state = useAppStore.getState().sessionStates['s1'];
      expect(state.swarmEvents.map((event) => event.id)).toEqual(['swarm-2', 'swarm-3']);
    });

    it('deduplicates validation logs by validation id', () => {
      useAppStore.getState().addSession(makeSession('s1'));

      useAppStore.getState().addValidationLog('s1', makeValidationLog(1));
      useAppStore.getState().addValidationLog('s1', {
        ...makeValidationLog(1),
        summary: 'Validation passed latest copy.',
      });

      let state = useAppStore.getState().sessionStates['s1'];
      expect(state.validationLogs).toHaveLength(1);
      expect(state.validationLogs[0].summary).toBe('Validation passed latest copy.');

      useAppStore.getState().setRoleRuntimeState('s1', {
        validationLogs: [makeValidationLog(2), makeValidationLog(2), makeValidationLog(3)],
      });

      state = useAppStore.getState().sessionStates['s1'];
      expect(state.validationLogs.map((log) => log.validationId)).toEqual([
        'validation-2',
        'validation-3',
      ]);
    });

    it('deduplicates validation logs by checked run so repeated sidebar cards collapse', () => {
      useAppStore.getState().addSession(makeSession('s1'));

      useAppStore.getState().addValidationLog('s1', makeValidationLog(1));
      useAppStore.getState().addValidationLog('s1', {
        ...makeValidationLog(99),
        validationId: 'validation-latest',
        checkedRoleRunIds: ['run-1'],
        summary: 'Latest validation for the same checked run.',
      });
      useAppStore.getState().addValidationLog('s1', makeValidationLog(2));

      const state = useAppStore.getState().sessionStates['s1'];
      expect(state.validationLogs.map((log) => log.validationId)).toEqual([
        'validation-latest',
        'validation-2',
      ]);
      expect(state.validationLogs[0].summary).toBe('Latest validation for the same checked run.');
    });

    it('caps role runtime arrays per session', () => {
      useAppStore.getState().addSession(makeSession('s1'));

      for (let index = 0; index < 120; index += 1) {
        useAppStore.getState().addRoleLifecycleEvent('s1', makeRoleEvent(index));
      }
      for (let index = 0; index < 60; index += 1) {
        useAppStore.getState().addValidationLog('s1', makeValidationLog(index));
      }

      const state = useAppStore.getState().sessionStates['s1'];
      expect(state.roleEvents).toHaveLength(100);
      expect(state.roleEvents[0].id).toBe('event-20');
      expect(state.validationLogs).toHaveLength(50);
      expect(state.validationLogs[0].validationId).toBe('validation-10');

      for (let index = 0; index < 120; index += 1) {
        useAppStore.getState().addSwarmEvent('s1', makeSwarmEvent(index));
      }

      const updatedState = useAppStore.getState().sessionStates['s1'];
      expect(updatedState.swarmEvents).toHaveLength(100);
      expect(updatedState.swarmEvents[0].id).toBe('swarm-20');
    });

    it('sets role runtime state from snapshots', () => {
      useAppStore.getState().addSession(makeSession('s1'));

      useAppStore.getState().setRoleRuntimeState('s1', {
        roleEvents: [makeRoleEvent(1), makeRoleEvent(2)],
        swarmEvents: [makeSwarmEvent(1)],
        validationLogs: [makeValidationLog(1)],
      });

      const state = useAppStore.getState().sessionStates['s1'];
      expect(state.roleEvents.map((event) => event.id)).toEqual(['event-1', 'event-2']);
      expect(state.swarmEvents.map((event) => event.id)).toEqual(['swarm-1']);
      expect(state.validationLogs.map((log) => log.validationId)).toEqual(['validation-1']);
    });
  });

  describe('cross-session isolation', () => {
    it('should not affect other sessions when updating one', () => {
      useAppStore.getState().addSession(makeSession('s1'));
      useAppStore.getState().addSession(makeSession('s2'));

      useAppStore.getState().setPartialMessage('s1', 'hello');
      useAppStore.getState().setSessionContextWindow('s2', 100000);

      expect(useAppStore.getState().sessionStates['s1'].partialMessage).toBe('hello');
      expect(useAppStore.getState().sessionStates['s1'].contextWindow).toBe(0);
      expect(useAppStore.getState().sessionStates['s2'].partialMessage).toBe('');
      expect(useAppStore.getState().sessionStates['s2'].contextWindow).toBe(100000);
    });
  });
});
