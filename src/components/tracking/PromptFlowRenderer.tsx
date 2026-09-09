import React from 'react';
import { PromptFlow } from '../../core/types/promptFlow';
import { Match, Player, MatchRoster, GameEvent } from '../../core/types/stats';
import { PromptService } from '../../core/services/promptService';
import { SmartPromptModal } from '../organisms/SmartPromptModal';
import * as Icons from 'lucide-react';
import { usePromptEngine } from '../../hooks/usePromptEngine';

interface PromptFlowRendererProps {
  flowId?: string;
  flow?: PromptFlow;
  match: Match;
  matchRosters: MatchRoster[];
  allPlayers: Player[];
  triggerEvent: GameEvent;
  youtubeTimestamp?: number;
  onComplete: (logs: any[]) => void;
  onCancel: () => void;
  isSimulation?: boolean;
}

export const PromptFlowRenderer: React.FC<PromptFlowRendererProps> = ({
  flowId,
  flow: providedFlow,
  match,
  matchRosters,
  allPlayers,
  triggerEvent,
  youtubeTimestamp,
  onComplete,
  onCancel,
  isSimulation = false
}) => {
  const flow = providedFlow || (flowId ? PromptService.getFlow(flowId, match) : undefined);
  const level = match.recordingMode || 'detailed';

  const { state, actions } = usePromptEngine({
    flow,
    match,
    matchRosters,
    triggerEvent,
    youtubeTimestamp,
    onComplete,
    onCancel
  });

  if (!flow || !state.container) return null;

  const { container, selections, accumulatedLogs } = state;

  const confirmStageRef = React.useRef(actions.confirmStage);
  React.useEffect(() => {
    confirmStageRef.current = actions.confirmStage;
  }, [actions.confirmStage]);

  const isConfirmDisabled = React.useMemo(() => {
    if (!container) return false;
    
    if (container.primaryAction.type === 'choice' && !selections.primaryChoice) return true;

    let missingRequired = false;
    container.secondaryActions?.forEach(action => {
      let isActive = true;
      if (action.condition) {
         try {
           const fn = new Function('choice', 'selections', `return ${action.condition}`);
           isActive = fn(selections.primaryChoice, selections);
         } catch { isActive = false; }
      }
      if (isActive && action.type === 'required_actor') {
         if (!selections[`secondary_${action.id}`]) {
            missingRequired = true;
         }
      }
    });

    return missingRequired;
  }, [container, selections]);

  const checkAutoFinish = React.useCallback((currentSelections: Record<string, any>, lastActionKey: string) => {
    if (!container) return;
    
    // Check if primary choice is required but missing
    if (container.primaryAction.type === 'choice' && !currentSelections.primaryChoice) return;

    let hasRequiredAction = false;
    let allRequiredSatisfied = true;
    let lastActionWasRequired = false;

    container.secondaryActions?.forEach(action => {
      let isActive = true;
      if (action.condition) {
         try {
           const fn = new Function('choice', 'selections', `return ${action.condition}`);
           isActive = fn(currentSelections.primaryChoice, currentSelections);
         } catch { isActive = false; }
      }
      if (isActive && action.type === 'required_actor') {
         hasRequiredAction = true;
         if (!currentSelections[`secondary_${action.id}`]) {
            allRequiredSatisfied = false;
         }
         if (lastActionKey === `secondary_${action.id}`) {
             lastActionWasRequired = true;
         }
      }
    });

    if (container.primaryAction.type === 'choice' && lastActionKey === 'primaryChoice') {
       lastActionWasRequired = true; 
    }

    // Check if there are any visible optional fields on this stage that have not been filled/selected.
    // If so, we should NOT auto-finish, giving the user a chance to select them manually.
    let hasUnfilledOptionalFields = false;
    container.optionalFields?.forEach(field => {
      // Check visibility of optional field
      if (field.visibleIn && !field.visibleIn.includes(level)) return;
      
      // Specifically for location field, it's not visible if the trigger event already has coords
      if (field.type === 'location' && triggerEvent?.x !== undefined && triggerEvent?.y !== undefined) return;

      // Check if this optional field has been selected/filled
      const isSelected = !!currentSelections[`field_${field.id}`];
      if (!isSelected) {
         hasUnfilledOptionalFields = true;
      }
    });

    if (hasUnfilledOptionalFields) {
       return;
    }

    if (allRequiredSatisfied && lastActionWasRequired) {
       setTimeout(() => {
          confirmStageRef.current();
       }, 400); 
    }
  }, [container, actions, level, triggerEvent]);

  // Roster logic
  const homeTeamId = match.teamId || 'home_team';
  const awayTeamId = match.opponentTeamId || 'away_team';

    const getRoster = (teamId: string) => {
      // In single or team mode, if it's the away team, we return the generic opponent option
      if ((match.recordingType === 'single' || match.recordingType === 'team') && teamId === awayTeamId) {
        return [{
          id: 'opp',
          name: 'Opponent Player',
          displayName: 'Opponent',
          jersey: '-',
          isActive: true
        } as Player];
      }
      
      const roster = matchRosters
        .filter(r => r.teamId === teamId && r.isActive)
        .map(r => ({
          id: r.profileId,
          name: r.name,
          displayName: r.name,
          jersey: r.jerseyNumber,
          isActive: r.isActive
        } as Player));

      if (teamId === awayTeamId && roster.length === 0) {
        return [{
          id: 'opp',
          name: 'Opponent Player',
          displayName: 'Opponent',
          jersey: '-',
          isActive: true
        } as Player];
      }

      if (teamId === awayTeamId && roster.length > 0) {
        return [
          {
            id: 'opp',
            name: 'Opponent (Generic)',
            displayName: 'Opponent',
            jersey: '-',
            isActive: true
          } as Player,
          ...roster
        ];
      }

      return roster;
    };

    React.useEffect(() => {
      if (!container || !flow) return;

      container.secondaryActions?.forEach(action => {
        if (action.condition) {
          try {
            const fn = new Function('choice', 'selections', `return ${action.condition}`);
            if (!fn(selections.primaryChoice, selections)) return;
          } catch {}
        }

        const isTriggerEventHome = triggerEvent 
          ? (matchRosters.some(r => r.teamId === homeTeamId && r.profileId === triggerEvent.playerId) || triggerEvent.playerId === 'home_team')
          : true;

        let actionTeam: 'home' | 'away' | undefined = undefined;
        let targetRoster: Player[] = [];

        if (action.actorScope === 'OPPONENT_TEAM') {
          if (isTriggerEventHome) {
            targetRoster = getRoster(awayTeamId);
            actionTeam = 'away';
          } else {
            targetRoster = getRoster(homeTeamId);
            actionTeam = 'home';
          }
        }

        const isGenericOpponent = actionTeam === 'away' && (match.recordingType === 'single' || match.recordingType === 'team' || targetRoster.every(p => p.id === 'opp'));
        const isRedundantInline = action.type === 'inline_actor_select' && isGenericOpponent && targetRoster.length === 1;

        if ((action.type === 'required_actor' && targetRoster.length === 1 && isGenericOpponent) || isRedundantInline) {
           if (!selections[`secondary_${action.id}`]) {
              const val = targetRoster[0].id;
              setTimeout(() => {
                 actions.selectOption(val, val, { actionId: action.id });
                 checkAutoFinish({ ...selections, [`secondary_${action.id}`]: val }, `secondary_${action.id}`);
              }, 0);
           }
        }
      });
    }, [container, flow, selections, matchRosters, match, triggerEvent, actions, checkAutoFinish]);

  const prepareGroups = () => {
    const groups: any[] = [];
    
    // Primary Choice
    if (container.primaryAction.type === 'choice') {
      groups.push({
        title: container.primaryAction.label || 'Select Outcome',
        players: container.primaryAction.options?.map(opt => ({
          id: `opt_${opt}`,
          name: opt,
          displayName: opt,
          jersey: 'Target',
          isActive: true,
          isOption: true,
          isSelected: selections.primaryChoice === opt
        })),
        layout: 'compact-list'
      });
    }

    // Specific optional choices like "is_blocked" and "foul_during" need to be at the top
    const topFields = ['is_blocked', 'foul_during'];
    topFields.forEach(fieldId => {
      const field = container.optionalFields?.find(f => f.id === fieldId);
      if (field && (!field.visibleIn || field.visibleIn.includes(level))) {
        groups.push({
          title: field.label,
          players: field.options?.map(opt => ({
            id: `field_${field.id}_${opt}`,
            name: opt,
            displayName: opt,
            isOption: true,
            isActive: true,
            isSelected: selections[`field_${field.id}`] === opt
          })),
          isOptionalGroup: true,
          fieldId: field.id,
          layout: 'compact-list'
        });
      }
    });

    // Secondary Actions
    container.secondaryActions?.forEach(action => {
      if (action.condition) {
        try {
          const fn = new Function('choice', 'selections', `return ${action.condition}`);
          if (!fn(selections.primaryChoice, selections)) return;
        } catch (e) {
          console.error("Failed to eval condition: ", action.condition);
        }
      }

      const isTriggerEventHome = triggerEvent 
        ? (matchRosters.some(r => r.teamId === homeTeamId && r.profileId === triggerEvent.playerId) || triggerEvent.playerId === 'home_team')
        : true;

      let actionTeam: 'home' | 'away' | undefined = undefined;
      let targetRoster: Player[] = [];
      
      if (action.actorScope === 'EITHER_TEAM') {
        const homeRoster = [
          ...getRoster(homeTeamId)
        ];
        const awayRoster = match.recordingType === 'full' ? [
          ...getRoster(awayTeamId)
        ] : [
          { id: 'opp', name: 'Opponent Rebound', displayName: 'Opponent', jersey: 'REB', isActive: true } as Player
        ];
        
        groups.push({
          title: `${action.label} (Home)`,
          players: homeRoster.map(p => ({
            ...p,
            isSelected: selections[`secondary_${action.id}`] === p.id
          })),
          team: 'home',
          color: match.ourColor,
          theme: match.ourTheme,
          isSecondaryGroup: true,
          actionId: action.id
        });
        
        groups.push({
          title: `${action.label} (Away)`,
          players: awayRoster.map(p => ({
            ...p,
            isSelected: selections[`secondary_${action.id}`] === p.id
          })),
          team: 'away',
          color: match.theirColor,
          theme: match.theirTheme,
          isSecondaryGroup: true,
          actionId: action.id
        });
        
        // Add ball out group
        groups.push({
          title: `Other`,
          players: [
            { id: 'ball_out', name: 'Ball Out of Bounds / Dead Ball', displayName: 'Out of Bounds', jersey: '🏀', isActive: true } as Player
          ].map(p => ({
            ...p,
            isSelected: selections[`secondary_${action.id}`] === p.id
          })),
          team: 'neutral',
          isSecondaryGroup: true,
          actionId: action.id,
          layout: 'compact-list'
        });
        return; // Done with this action
      }
      
      if (action.actorScope === 'OUR_TEAM') {
        if (isTriggerEventHome) {
          targetRoster = getRoster(homeTeamId);
          actionTeam = 'home';
        } else {
          targetRoster = getRoster(awayTeamId);
          actionTeam = 'away';
        }
      } else if (action.actorScope === 'OPPONENT_TEAM') {
        if (isTriggerEventHome) {
          targetRoster = getRoster(awayTeamId);
          actionTeam = 'away';
        } else {
          targetRoster = getRoster(homeTeamId);
          actionTeam = 'home';
        }
      }

      const isGenericOpponent = actionTeam === 'away' && (match.recordingType === 'single' || match.recordingType === 'team' || targetRoster.every(p => p.id === 'opp'));
      const isRedundantInline = action.type === 'inline_actor_select' && isGenericOpponent && targetRoster.length === 1 && action.id !== 'bad_pass_steal_actor';

      if (!isRedundantInline) {
        // Customize text for generic toggles
        let playersToRender = targetRoster.map(p => {
          let updatedName = p.displayName || p.name;
          if (p.id === 'opp' && action.type === 'toggle_actor' && isGenericOpponent) {
            updatedName = `Yes, ${action.label.replace(' (Opp)', '')}`;
          }
          return {
            ...p,
            displayName: updatedName,
            isSelected: selections[`secondary_${action.id}`] === p.id
          };
        });

        if (action.id === 'bad_pass_steal_actor') {
          playersToRender.push({
            id: 'no_steal',
            name: 'No Steal / Out of Bounds',
            displayName: '🏀 No Steal / Out of Bounds',
            jersey: '-',
            isActive: true,
            isSelected: selections[`secondary_${action.id}`] === 'no_steal'
          } as any);
        }

        groups.push({
          title: action.label,
          players: playersToRender,
          team: actionTeam,
          color: actionTeam === 'home' ? match.ourColor : (actionTeam === 'away' ? match.theirColor : undefined),
          theme: actionTeam === 'home' ? match.ourTheme : (actionTeam === 'away' ? match.theirTheme : undefined),
          isSecondaryGroup: true,
          actionId: action.id
        });
      }
    });

    // Optional Fields
    container.optionalFields?.forEach(field => {
      if (field.id === 'foul_during' || field.id === 'is_blocked') return;
      if (field.visibleIn && !field.visibleIn.includes(level)) return;
      
      if (field.type === 'choice') {
          groups.push({
            title: field.label,
            players: field.options?.map(opt => ({
              id: `field_${field.id}_${opt}`,
              name: opt,
              displayName: opt,
              isOption: true,
              isActive: true,
              isSelected: selections[`field_${field.id}`] === opt
            })),
            isOptionalGroup: true,
            fieldId: field.id,
            layout: 'compact-list'
          });
        } else if (field.type === 'location') {
          if (triggerEvent?.x !== undefined && triggerEvent?.y !== undefined) {
             return;
          }
          // Determine allowedArea based on container context
          let allowedArea: '2pt' | '3pt' | 'any' = 'any';
          if (triggerEvent?.type?.startsWith('2pt_')) allowedArea = '2pt';
          else if (triggerEvent?.type?.startsWith('3pt_')) allowedArea = '3pt';
          else if (container.triggerContext === '2pt_make') allowedArea = '2pt';
          else if (container.triggerContext === '3pt_make') allowedArea = '3pt';
          else if (selections.primaryChoice?.includes('2PT')) allowedArea = '2pt';
          else if (selections.primaryChoice?.includes('3PT')) allowedArea = '3pt';

          groups.push({
            title: field.label,
            type: 'location',
            allowedArea,
            isOptionalGroup: true,
            fieldId: field.id,
            value: selections[`field_${field.id}`] ? {
              x: selections[`field_${field.id}_x`],
              y: selections[`field_${field.id}_y`]
            } : undefined
          });
        }
      });

    return groups;
  };

  const groups = prepareGroups();

  React.useEffect(() => {
    if (flow && container && groups.length === 0) {
      // If there are no groups to display (e.g. all secondary actions were auto-filled or empty)
      // just complete the stage automatically.
      actions.confirmStage();
    }
  }, [flow, container, groups.length, actions]);

  const SimulationPanel = () => (
    <div className="w-80 border-l border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 overflow-y-auto hidden lg:flex flex-col h-full animate-in slide-in-from-right duration-300">
       <div className="flex items-center gap-2 mb-6">
          <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500"><Icons.Activity className="w-4 h-4" /></div>
          <h5 className="text-xs font-black uppercase tracking-[0.2em]">Simulation Live Data</h5>
       </div>
       
       <div className="space-y-6">
         <section>
           <h6 className="text-xs font-black uppercase text-zinc-400 mb-3 ml-2 tracking-widest">Current Selections</h6>
           <div className="space-y-2">
              {Object.entries(selections).map(([key, val]) => (
                <div key={key} className="p-3 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-100 dark:border-zinc-800">
                  <div className="text-xs font-black text-zinc-400 uppercase">{key.replace('secondary_', '').replace('field_', '')}</div>
                  <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100">{String(val)}</div>
                </div>
              ))}
              {Object.keys(selections).length === 0 && <div className="text-xs italic text-zinc-300 ml-2">No selections yet</div>}
           </div>
         </section>

         <section>
           <h6 className="text-xs font-black uppercase text-zinc-400 mb-3 ml-2 tracking-widest">Recorded Events ({accumulatedLogs.length})</h6>
           <div className="space-y-2">
              {accumulatedLogs.map((log, i) => (
                <div key={i} className="p-3 bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/20 rounded-xl">
                  <div className="text-xs font-black text-blue-500 uppercase">{log.type} {log.subType ? `/ ${log.subType}` : ''}</div>
                  <div className="text-xs font-bold">Actor: {log.actorId}</div>
                </div>
              ))}
              {accumulatedLogs.length === 0 && <div className="text-xs italic text-zinc-300 ml-2">Awaiting first stage confirm...</div>}
           </div>
         </section>
       </div>
    </div>
  );

  return (
    <div className={`flex w-full h-full ${isSimulation ? 'bg-zinc-950/20 backdrop-blur-sm' : ''}`}>
      <div className="flex-1 flex items-start justify-center p-6 pt-12 overflow-y-auto">
        <SmartPromptModal
          isOpen={true}
          title={container.name}
          description={undefined} // Hide Stage ID for cleaner UI as requested previously
          groups={groups}
          isConfirmDisabled={isConfirmDisabled}
          onSelectPlayer={(id, meta) => {
            const isPrimaryChoice = id.startsWith('opt_');
            const val = isPrimaryChoice ? id.replace('opt_', '') : 
                        id.startsWith('field_') 
                          ? (meta?.fieldId ? id.slice(`field_${meta.fieldId}_`.length) : id.split('_').pop()) 
                          : id;
            actions.selectOption(id, val, meta);
            
            const actionKey = isPrimaryChoice ? 'primaryChoice' : 
                              (id.startsWith('field_') || meta?.fieldId) ? `field_${meta?.fieldId}` :
                              `secondary_${meta?.actionId}`;

            let nextSelections = { ...selections };
            if (isPrimaryChoice) {
              if (selections.primaryChoice === val) {
                delete nextSelections.primaryChoice;
              } else {
                nextSelections.primaryChoice = val;
              }
            } else if (meta?.fieldId) {
              const fKey = `field_${meta.fieldId}`;
              if (selections[fKey] === val) {
                delete nextSelections[fKey];
                delete nextSelections[`${fKey}_x`];
                delete nextSelections[`${fKey}_y`];
              } else {
                nextSelections[fKey] = val;
                if (meta.x !== undefined && meta.y !== undefined) {
                  nextSelections[`${fKey}_x`] = meta.x;
                  nextSelections[`${fKey}_y`] = meta.y;
                }
              }
            } else if (meta?.actionId) {
              const sKey = `secondary_${meta.actionId}`;
              if (selections[sKey] === val) {
                delete nextSelections[sKey];
              } else {
                nextSelections[sKey] = val;
              }
            }

            checkAutoFinish(nextSelections, actionKey);
          }}
          onConfirm={actions.confirmStage}
          onSkip={state.canBack ? actions.goBack : undefined}
          skipText={state.canBack ? "Back" : undefined}
          onClose={onCancel}
          youtubeTimestamp={youtubeTimestamp}
          isPanel={true}
          confirmLabel={PromptService.getNextContainer(flow, container.id, match, selections) ? "Next Stage" : "Finish Flow"}
          match={match}
          matchRosters={matchRosters}
        />
      </div>
      {isSimulation && <SimulationPanel />}
    </div>
  );
};
