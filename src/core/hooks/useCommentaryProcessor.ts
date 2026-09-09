import { useState, useCallback } from 'react';
import { DraftEvent } from '../types/commentary';
import { commentaryService } from '../services/commentaryService';
import { GameEvent } from '../types/stats';

export const useCommentaryProcessor = (
  matchId: string, 
  currentYoutubeTime: number,
  lastEvent: GameEvent | undefined,
  onAutoAccept: (draft: DraftEvent) => void
) => {
  const [drafts, setDrafts] = useState<DraftEvent[]>([]);
  const [interimText, setInterimText] = useState('');

  const handleFinalText = useCallback(async (text: string) => {
    setInterimText('');
    const draft = await commentaryService.parseCommentary(
      text, 
      matchId, 
      currentYoutubeTime, 
      lastEvent?.type
    );

    // Grouping / Batching Logic (Basic)
    // If the event falls within 3 seconds of another draft, we could try to merge.
    // For now, we rely on Sequence Boost in parsing.
    
    // Confidence-based Routing
    if (draft.confidence > 0.85 && draft.parsedData.type && draft.parsedData.playerId) {
      // Auto-accept high confidence
      onAutoAccept(draft);
    } else {
      // Queue for validation
      setDrafts(prev => [draft, ...prev]);
    }

  }, [matchId, currentYoutubeTime, lastEvent, onAutoAccept]);

  const handleInterimText = useCallback((text: string) => {
    setInterimText(text);
  }, []);

  const rejectDraft = useCallback((id: string) => {
    setDrafts(prev => prev.filter(d => d.id !== id));
  }, []);

  const acceptDraft = useCallback((id: string) => {
    // Parent handles actual database commit via onConfirmEvent, but we remove it from queue
    setDrafts(prev => prev.filter(d => d.id !== id));
  }, []);

  return {
    drafts,
    interimText,
    handleFinalText,
    handleInterimText,
    rejectDraft,
    acceptDraft,
    setDrafts,
  };
};
