import { EventType } from './stats';

export type PromptActorType = 'our_team' | 'opponent' | 'either' | 'none';

export type PromptInputType = 'player_selection' | 'option_selection' | 'team_selection' | 'time_input';

export interface PromptOption {
  id: string;
  label: string;
  value?: any;
  nextStepId?: string; // ID of the next prompt step
  action?: string; // Optional action to trigger (e.g., 'log_event', 'close_possession')
  icon?: string;
  color?: string;
}

export interface PromptStep {
  id: string;
  title: string;
  description?: string;
  actorType: PromptActorType;
  inputType: PromptInputType;
  options?: PromptOption[];
  autoSkipIfSingleOption?: boolean;
  // Metadata for filtering players
  playerFilter?: 'on_court' | 'all';
  // If true, this step is final and will close the interaction
  isFinal?: boolean;
}

export interface SmartPromptFlow {
  id: string;
  triggerEvent: EventType | 'custom';
  initialStepId: string;
  steps: Record<string, PromptStep>;
}
