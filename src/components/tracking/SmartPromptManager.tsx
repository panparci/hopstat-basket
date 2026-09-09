import React from 'react';
import { 
  GameEvent, Player, TurnoverType, FoulType, ShotDifficulty, AssistType, GameContext, EventType, Match, MatchRoster, Possession
} from '../../core/types/stats';
import { SmartPromptModal } from '../organisms/SmartPromptModal';
import { InteractionPanel } from './InteractionPanel';
import { ActiveInteraction } from '../../hooks/useTrackingLogic';
import { PromptFlowRenderer } from './PromptFlowRenderer';
import { LegacySmartPrompt } from './LegacySmartPrompt';

interface SmartPromptManagerProps {
  match: Match | null;
  matchRosters: MatchRoster[];
  events: GameEvent[];
  activePossession: Partial<Possession> | null;
  
  activeInteraction: ActiveInteraction | null;
  setInteraction: (type: any | null, data?: any) => void;
  handleSmartPromptSelect: (selectedPlayerId: string) => void;
  handleConfigurableAction: (logs: any[], triggerEvent: GameEvent) => void;
  
  allPlayers: Player[];
}

export const SmartPromptManager: React.FC<SmartPromptManagerProps> = ({
  match,
  matchRosters,
  events,
  activePossession,
  activeInteraction,
  setInteraction,
  handleSmartPromptSelect,
  handleConfigurableAction,
  allPlayers
}) => {
  const getPlayerName = (playerId?: string) => {
    if (!playerId) return 'Unknown';
    if (playerId === 'opp' || playerId === 'away_team') return 'Lawan';
    if (!allPlayers) return 'Unknown';
    return allPlayers.find(p => p.id === playerId)?.name || 'Unknown';
  };

  if (!activeInteraction || !match) return null;

  const { type, data } = activeInteraction;

  const renderContent = () => {
    switch (type) {
      case 'smartPrompt':
        return (
          <LegacySmartPrompt
            data={data}
            match={match}
            matchRosters={matchRosters}
            events={events}
            activePossession={activePossession}
            allPlayers={allPlayers}
            handleSmartPromptSelect={handleSmartPromptSelect}
            setInteraction={setInteraction}
          />
        );
      case 'configurablePrompt':
        return (
          <PromptFlowRenderer
            flowId={data.flowId}
            match={match}
            matchRosters={matchRosters}
            allPlayers={allPlayers}
            triggerEvent={data.triggerEvent}
            youtubeTimestamp={data.youtubeTimestamp}
            onComplete={(logs) => {
              if (data.onComplete) {
                data.onComplete(logs);
              } else {
                handleConfigurableAction(logs, data.triggerEvent);
              }
            }}
            onCancel={() => setInteraction(null)}
          />
        );
      case 'confirmation':
        return (
          <div className="p-6 flex flex-col items-center text-center">
            <h3 className="text-xl font-bold mb-2">{data.title}</h3>
            <p className="text-zinc-500 mb-6">{data.description}</p>
            <div className="flex flex-col gap-3 w-full">
              <button
                onClick={data.onConfirm}
                className="w-full py-4 rounded-xl bg-red-500 text-white font-bold hover:bg-red-600 transition-colors"
              >
                {data.confirmText || 'Confirm'}
              </button>
              <button
                onClick={() => setInteraction(null)}
                className="w-full py-4 rounded-xl bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 font-bold hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
              >
                {data.cancelText || 'Cancel'}
              </button>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  const getTitle = () => {
    switch (type) {
      case 'smartPrompt': return 'Smart Prompt';
      case 'confirmation': return 'Konfirmasi';
      default: return 'Interaction';
    }
  };

  return (
    <InteractionPanel
      isOpen={!!activeInteraction}
      onClose={() => setInteraction(null)}
      title={getTitle()}
    >
      {renderContent()}
    </InteractionPanel>
  );
};
