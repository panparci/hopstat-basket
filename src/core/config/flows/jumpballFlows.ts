import { PromptFlow } from '../../types/promptFlow';

export const jumpballFlows: Record<string, PromptFlow> = {
  'jumpball': {
    id: 'jumpball',
    name: 'Jumpball Flow',
    triggerContext: 'custom',
    initialContainerId: 'jumpball_main',
    supportedModes: ['full', 'team', 'single'],
    containers: {
      'jumpball_main': {
        id: 'jumpball_main',
        name: 'Jumpball Won By',
        triggerContext: 'custom',
        supportedModes: ['full', 'team', 'single'],
        supportedDetailLevels: ['detailed', 'lite'],
        ui: { layout: 'single_screen' },
        primaryAction: {
          type: 'choice',
          eventType: 'jumpball',
          options: ['Our Team Won', 'Opponent Team Won']
        },
        secondaryActions: [
          {
            id: 'jumpball_winner',
            label: 'Player who secured the ball',
            type: 'required_actor',
            actorScope: 'EITHER_TEAM',
            eventType: 'jumpball'
          }
        ],
        optionalFields: []
      }
    }
  }
};
