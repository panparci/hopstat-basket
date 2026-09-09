import { EventContainer, SecondaryAction, OptionalField } from '../types/promptFlow';
import { EventType } from '../types/stats';

export interface LibraryContainerTemplate extends Partial<EventContainer> {
  libraryCategory: string;
}

export const EVENT_CONTAINER_LIBRARY: LibraryContainerTemplate[] = [
  {
    id: 'shot_outcome_detailed',
    name: 'Detailed Shot Tracking',
    libraryCategory: 'Scoring',
    triggerContext: 'shot',
    supportedModes: ['full', 'team', 'single'],
    supportedDetailLevels: ['detailed'],
    ui: { layout: 'single_screen' },
    primaryAction: { type: 'event', eventType: 'shot' as any },
    secondaryActions: [
      { id: 'sec_assist', label: 'Assist by', type: 'toggle_actor', actorScope: 'OUR_TEAM', eventType: 'ast' as any }
    ],
    optionalFields: [
      { id: 'opt_difficulty', label: 'Shot Difficulty', type: 'choice', visibleIn: ['detailed'], options: ['Open', 'Contested', 'Heavily Contested'] }
    ]
  },
  {
    id: 'rebound_stage',
    name: 'Rebound Battle',
    libraryCategory: 'Possession',
    triggerContext: 'miss',
    supportedModes: ['full', 'team', 'single'],
    supportedDetailLevels: ['detailed', 'lite'],
    ui: { layout: 'single_screen' },
    primaryAction: { 
      type: 'choice', 
      label: 'Rebound Type', 
      options: ['Offensive', 'Defensive'],
      eventType: 'oreb' as any
    },
    secondaryActions: [
      { id: 'sec_rebound_actor', label: 'Captured by', type: 'required_actor', actorScope: 'EITHER_TEAM', eventType: 'oreb' as any }
    ],
    optionalFields: []
  },
  {
    id: 'turnover_stage',
    name: 'Turnover Details',
    libraryCategory: 'Possession',
    triggerContext: 'to',
    supportedModes: ['full', 'team', 'single'],
    supportedDetailLevels: ['detailed', 'lite'],
    ui: { layout: 'single_screen' },
    primaryAction: { type: 'event', eventType: 'to' as any },
    secondaryActions: [
      { id: 'sec_steal', label: 'Stolen by (Opp)', type: 'toggle_actor', actorScope: 'OPPONENT_TEAM', eventType: 'stl' as any }
    ],
    optionalFields: [
      { id: 'opt_to_type', label: 'Lost via', type: 'choice', options: ['Bad Pass', 'Ball Handling', 'Traveling', 'Out of Bounds'], visibleIn: ['detailed'] }
    ]
  },
  {
    id: 'foul_stage',
    name: 'Personal Foul',
    libraryCategory: 'Infractions',
    triggerContext: 'foul',
    supportedModes: ['full', 'team', 'single', 'single'],
    supportedDetailLevels: ['detailed', 'lite'],
    ui: { layout: 'single_screen' },
    primaryAction: { type: 'event', eventType: 'foul' as any },
    secondaryActions: [
      { id: 'sec_foul_drawn', label: 'Drawn by', type: 'inline_actor_select', actorScope: 'OPPONENT_TEAM', eventType: 'foul_drawn' as any }
    ],
    optionalFields: [
      { id: 'opt_foul_type', label: 'Foul Type', type: 'choice', options: ['Personal', 'Shooting', 'Technical', 'Flagrant'], visibleIn: ['detailed'] }
    ]
  }
];
