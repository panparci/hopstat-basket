import { RecordingType, RecordingMode } from '../../types/stats';
import { PromptFlow } from '../../types/promptFlow';
import { singlePlayerScoringFlow, singlePlayerMissedShotFlow } from './single/shots';
import { INITIAL_PROMPT_FLOWS } from './index';

export const FlowFactory = {
  getFlow: (triggerType: string, mode: RecordingType, detail: RecordingMode): PromptFlow | null => {
    // Single Player overrides
    const matrixKey = `${mode}_${triggerType}`;
    switch (matrixKey) {
      case 'single_plus_2pt':
      case 'single_plus_3pt':
      case 'single_shot':
        return singlePlayerScoringFlow;
      case 'single_missed_shot':
        return singlePlayerMissedShotFlow;
    }
    
    // Unify Team and Full Team into standard central flows from scoringFlows etc
    if (INITIAL_PROMPT_FLOWS[triggerType]) {
      return INITIAL_PROMPT_FLOWS[triggerType];
    }
    
    // Specific maps if trigger string differs from flow ID
    switch(triggerType) {
      case 'plus_2pt':
      case 'plus_3pt':
      case 'missed_shot':
      case 'turnover':
      case 'foul':
      case 'jumpball':
      case 'sub_out':
        return INITIAL_PROMPT_FLOWS[triggerType] || null;
      case 'blocked_shot':
      case 'block':
        return INITIAL_PROMPT_FLOWS['standalone_block'] || null;
      case 'steal':
      case 'stl':
        return INITIAL_PROMPT_FLOWS['standalone_steal'] || null;
    }
    
    return null;
  }
};

