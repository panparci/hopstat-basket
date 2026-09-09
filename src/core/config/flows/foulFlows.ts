import { PromptFlow } from '../../types/promptFlow';

export const foulFlows: Record<string, PromptFlow> = {
  'defensive_foul': {
    id: 'defensive_foul',
    name: 'Defensive Foul',
    triggerContext: 'foul',
    initialContainerId: 'defensive_foul_main',
    supportedModes: ['full', 'team', 'single'],
    containers: {
      'defensive_foul_main': {
        id: 'defensive_foul_main',
        name: 'Defensive Foul Details',
        triggerContext: 'foul',
        supportedModes: ['full', 'team', 'single'],
        supportedDetailLevels: ['detailed', 'lite'],
        ui: { layout: 'single_screen' },
        primaryAction: {
          type: 'choice',
          eventType: 'foul',
          label: 'Foul Type',
          options: ['Personal Foul', 'Shooting Foul', 'Blocking', 'Reach-in', 'Holding', 'Loose Ball', 'Technical', 'Unsportsmanlike', 'Double Team']
        },
        secondaryActions: [
           {
             id: 'foul_drawn_actor',
             label: 'Foul Drawn By',
             type: 'inline_actor_select',
             actorScope: 'OPPONENT_TEAM',
             eventType: 'foul_drawn'
           }
        ],
        optionalFields: [
          {
            id: 'free_throws',
            label: 'Free Throws Awarded?',
            type: 'choice',
            visibleIn: ['detailed', 'lite'],
            options: ['None', '1 Free Throw', '2 Free Throws', '3 Free Throws']
          }
        ]
      }
    }
  },
  'offensive_foul': {
    id: 'offensive_foul',
    name: 'Offensive Foul',
    triggerContext: 'foul',
    initialContainerId: 'offensive_foul_main',
    supportedModes: ['full', 'team', 'single'],
    containers: {
      'offensive_foul_main': {
        id: 'offensive_foul_main',
        name: 'Offensive Foul Details',
        triggerContext: 'foul',
        supportedModes: ['full', 'team', 'single'],
        supportedDetailLevels: ['detailed', 'lite'],
        ui: { layout: 'single_screen' },
        primaryAction: {
          type: 'choice',
          eventType: 'foul',
          label: 'Foul Type',
          options: ['Charging', 'Illegal Screen', 'Push Off', 'Technical']
        },
        secondaryActions: [
           {
             id: 'foul_drawn_actor',
             label: 'Foul Drawn By',
             type: 'inline_actor_select',
             actorScope: 'OPPONENT_TEAM',
             eventType: 'foul_drawn'
           }
        ],
        optionalFields: []
      }
    }
  }
};
