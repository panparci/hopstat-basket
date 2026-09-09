import { RecordingType, RecordingMode, EventType, EventActorType } from './stats';

export type PromptActorScope = 'OUR_TEAM' | 'OPPONENT_TEAM' | 'EITHER_TEAM' | 'NONE';

export type SecondaryActionType = 'inline_actor_select' | 'toggle_actor' | 'optional_choice' | 'auto_flow' | 'required_actor';

export interface SecondaryAction {
  id: string;
  label: string;
  type: SecondaryActionType;
  actorScope: PromptActorScope;
  condition?: string;
  options?: string[]; // For optional_choice
  eventType?: EventType;
  eventSubType?: string;
  excludePrimaryActor?: boolean;
}

export interface OptionalField {
  id: string;
  label: string;
  visibleIn: RecordingMode[];
  type: 'choice' | 'text' | 'number' | 'location';
  options?: string[];
}

export interface BranchingRule {
  id: string;
  conditionType: 'primaryChoice' | 'secondaryAction' | 'optionalField';
  targetId?: string; // Optional field ID or secondary action ID
  operator: 'equals' | 'not_equals' | 'exists' | 'not_exists';
  value?: string | boolean;
  nextContainerId: string;
}

export interface EventContainer {
  id: string;
  name: string;
  triggerContext: string;
  supportedModes: RecordingType[];
  supportedDetailLevels: RecordingMode[];
  ui: {
    layout: 'single_screen' | 'multi_event_single_screen';
  };
  primaryAction: {
    type: 'event' | 'choice';
    eventType: EventType;
    eventSubType?: string;
    label?: string;
    options?: string[];
  };
  secondaryActions: SecondaryAction[];
  optionalFields: OptionalField[];
  nextContainerId?: string; // Default next container
  branching?: Record<string, string>; // Maps primaryChoice value to nextContainerId
  branchingRules?: BranchingRule[];
}

export interface PromptFlow {
  id: string;
  name: string;
  triggerContext: EventType | 'custom';
  supportedModes?: RecordingType[];
  supportedDetailLevels?: RecordingMode[];
  initialContainerId: string;
  containers: Record<string, EventContainer>;
}
