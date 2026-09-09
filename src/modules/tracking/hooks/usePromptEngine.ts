import { useState, useCallback, useMemo, useEffect } from 'react';
import { PromptFlow, EventContainer, SecondaryAction } from '../../../core/types/promptFlow';
import { Match, Player, MatchRoster, GameEvent, RecordingType, RecordingMode } from '../../../core/types/stats';
import { PromptService } from '../../../core/services/promptService';

export interface PromptEngineState {
  currentContainerId: string | null;
  container: EventContainer | null;
  selections: Record<string, any>;
  accumulatedLogs: any[];
  isComplete: boolean;
  canBack: boolean;
  history: { containerId: string, selections: Record<string, any>, logSnapshot: any[] }[];
}

export interface PromptEngineOptions {
  flow: PromptFlow | undefined;
  match: Match;
  matchRosters: MatchRoster[];
  triggerEvent: GameEvent;
  youtubeTimestamp?: number;
  onComplete?: (logs: any[]) => void;
  onCancel?: () => void;
}

export function usePromptEngine({
  flow,
  match,
  matchRosters,
  triggerEvent,
  youtubeTimestamp,
  onComplete,
  onCancel
}: PromptEngineOptions) {
  const [currentContainerId, setCurrentContainerId] = useState<string | null>(
    flow?.initialContainerId || null
  );
  const [engineHistory, setEngineHistory] = useState<{ 
    containerId: string, 
    selections: Record<string, any>,
    logSnapshot: any[] 
  }[]>([]);
  const [selections, setSelections] = useState<Record<string, any>>({});
  const [accumulatedLogs, setAccumulatedLogs] = useState<any[]>([]);
  const [isComplete, setIsComplete] = useState(false);

  const container = useMemo(() => {
    if (!flow || !currentContainerId) return null;
    return flow.containers[currentContainerId] || null;
  }, [flow, currentContainerId]);

  useEffect(() => {
    if (container) {
      setSelections(prev => {
        const next = { ...prev };
        let changed = false;
        container.optionalFields?.forEach(field => {
          const key = `field_${field.id}`;
          if (next[key] === undefined) {
            if (field.id === 'is_blocked') {
              next[key] = 'Tidak';
              changed = true;
            } else if (field.id === 'foul_during') {
               next[key] = 'No Foul';
               changed = true;
            }
          }
        });
        return changed ? next : prev;
      });
    }
  }, [currentContainerId, container]);

  const selectOption = useCallback((id: string, value: any, meta?: { actionId?: string, fieldId?: string, x?: number, y?: number }) => {
    setSelections(prev => {
      let next = { ...prev };
      if (id.startsWith('opt_')) {
        next.primaryChoice = prev.primaryChoice === value ? undefined : value;
      } else if (meta?.actionId) {
        next[`secondary_${meta.actionId}`] = prev[`secondary_${meta.actionId}`] === value ? undefined : value;
      } else if (meta?.fieldId) {
        if (prev[`field_${meta.fieldId}`] === value) {
          delete next[`field_${meta.fieldId}`];
          delete next[`field_${meta.fieldId}_x`];
          delete next[`field_${meta.fieldId}_y`];
        } else {
          next[`field_${meta.fieldId}`] = value;
          if (meta.x !== undefined && meta.y !== undefined) {
            next[`field_${meta.fieldId}_x`] = meta.x;
            next[`field_${meta.fieldId}_y`] = meta.y;
          }
        }
      }
      return next;
    });
  }, []);

  const sortLogs = useCallback((logs: any[]) => {
    const priority: Record<string, number> = {
      'ast': 10,
      'shot': 30,
      'blk': 35,
      'foul': 40,
      'foul_drawn': 41,
      'oreb': 50,
      'dreb': 50,
      'to': 60,
      'sub_in': 70,
      'sub_out': 75,
      'timeout': 80
    };

    return [...logs].sort((a, b) => {
      // First by timestamp if they differ
      if (a.timestamp !== b.timestamp) return a.timestamp - b.timestamp;
      // Then by priority
      const pA = priority[a.type] || 99;
      const pB = priority[b.type] || 99;
      if (pA !== pB) return pA - pB;
      // Stable sort for same type
      return 0;
    });
  }, []);

  const handleGoBack = useCallback(() => {
    if (engineHistory.length === 0) return;
    const last = engineHistory[engineHistory.length - 1];
    setEngineHistory(prev => prev.slice(0, -1));
    setCurrentContainerId(last.containerId);
    setSelections(last.selections);
    setAccumulatedLogs(last.logSnapshot);
  }, [engineHistory]);

  const confirmStage = useCallback(() => {
    if (!container || !flow) return;

    // Compile logs for current stage
    const stageLogs: any[] = [];
    const triggerActorId = triggerEvent.playerId;

    // 1. Primary Event
    if (container.primaryAction.type === 'event' || (container.primaryAction.type === 'choice' && selections.primaryChoice)) {
      const isAndOne = selections.field_and1_foul_option === 'Yes';
      const log: any = {
        type: container.primaryAction.type === 'choice' ? container.primaryAction.eventType : triggerEvent.type,
        subType: isAndOne ? 'And-One' : (container.primaryAction.type === 'choice' ? selections.primaryChoice : (container.primaryAction.eventSubType || triggerEvent.subType)),
        actorId: triggerActorId,
        timestamp: triggerEvent.timestamp,
        quarter: triggerEvent.quarter,
        isAndOne: isAndOne || undefined,
        metadata: isAndOne ? { andOne: true } : undefined
      };

      // Add location if present
      if (selections.field_shot_location_x !== undefined) {
        log.x = selections.field_shot_location_x;
        log.y = selections.field_shot_location_y;
      }

      stageLogs.push(log);
    }

    // 2. Secondary Events
    container.secondaryActions.forEach(action => {
      if (action.condition) {
        try {
          const fn = new Function('choice', 'selections', `return ${action.condition}`);
          if (!fn(selections.primaryChoice, selections)) {
            return; // Skip this secondary action because its condition evaluates to false
          }
        } catch (e) {
          console.error("Failed to eval condition in usePromptEngine: ", action.condition);
          return; // Skip on error to be safe and avoid logging unrequested fouls/blocks
        }
      }

      let actorId = selections[`secondary_${action.id}`];

      // Auto-assign inline_actor_select or required_actor for generic opponent if missing
      if (!actorId && (action.type === 'inline_actor_select' || action.type === 'required_actor') && action.actorScope === 'OPPONENT_TEAM') {
        if (action.id !== 'bad_pass_steal_actor') {
          const isTriggerHome = triggerEvent 
            ? (matchRosters.some(r => r.teamId === (match?.teamId || 'home_team') && r.profileId === triggerEvent.playerId) || triggerEvent.playerId === 'home_team')
            : true;
          const targetTeamId = isTriggerHome ? (match?.opponentTeamId || 'away_team') : (match?.teamId || 'home_team');
          const isGeneric = (match.recordingType === 'single' || match.recordingType === 'team') && targetTeamId === (match?.opponentTeamId || 'away_team');
          const oppCount = matchRosters.filter(r => r.teamId === targetTeamId && r.isActive).length;

          if (isGeneric || oppCount === 0) {
            actorId = 'opp';
          }
        }
      }

      if (actorId && actorId !== 'no_steal') {
        const isShootingFoul = selections.field_foul_during === 'Shooting Foul' || action.eventSubType === 'Shooting Foul';
        stageLogs.push({
          type: action.eventType,
          subType: isShootingFoul ? 'Shooting Foul' : action.eventSubType,
          actorId,
          timestamp: triggerEvent.timestamp,
          quarter: triggerEvent.quarter,
          isSecondary: true,
          linkType: action.eventType === 'ast' ? 'ASSISTS' : 'SECONDARY',
          relatesTo: container.primaryAction.eventType
        });

        // Special logic: If a foul is committed by someone, the primary actor draws it
        if (action.eventType === 'foul' && triggerActorId) {
          stageLogs.push({
            type: 'foul_drawn',
            subType: isShootingFoul ? 'Shooting Foul' : 'Personal Foul',
            actorId: triggerActorId,
            opponentPlayerId: actorId,
            timestamp: triggerEvent.timestamp,
            quarter: triggerEvent.quarter,
            isSecondary: true,
            linkType: 'DERIVED',
            relatesTo: container.primaryAction.eventType
          });
        }
      }
    });

    // 3. Optional Fields Metadata
    if (stageLogs.length > 0) {
      const mainLog = stageLogs.find(l => l.actorId === triggerActorId && !l.isSecondary) || stageLogs[0];
      container.optionalFields.forEach(field => {
        const val = selections[`field_${field.id}`];
        if (val !== undefined && val !== null) {
          mainLog[field.id] = val;
        }
      });
    }

    const totalLogsBeforeSeq = sortLogs([...accumulatedLogs, ...stageLogs]);
    const totalLogs = totalLogsBeforeSeq.map((log, index) => ({
      ...log,
      sequenceNumber: index
    }));
    
    // Check Next Stage
    const nextContainer = PromptService.getNextContainer(flow, currentContainerId!, match, selections);
    if (nextContainer) {
      setEngineHistory(prev => [...prev, { 
        containerId: currentContainerId!, 
        selections: { ...selections },
        logSnapshot: [...accumulatedLogs]
      }]);
      setAccumulatedLogs(totalLogs);
      setCurrentContainerId(nextContainer.id);
      setSelections({});
    } else {
      setIsComplete(true);
      if (onComplete) onComplete(totalLogs);
    }
  }, [container, flow, selections, accumulatedLogs, match, matchRosters, triggerEvent, youtubeTimestamp, onComplete]);

  const reset = useCallback(() => {
    setCurrentContainerId(flow?.initialContainerId || null);
    setSelections({});
    setAccumulatedLogs([]);
    setEngineHistory([]);
    setIsComplete(false);
  }, [flow]);

  return {
    state: {
      currentContainerId,
      container,
      selections,
      accumulatedLogs,
      isComplete,
      canBack: engineHistory.length > 0,
      history: engineHistory
    },
    actions: {
      selectOption,
      confirmStage,
      goBack: handleGoBack,
      reset,
      cancel: onCancel
    }
  };
}
