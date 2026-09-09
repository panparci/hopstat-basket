import { PromptFlow } from '../../types/promptFlow';

export const reboundFlows: Record<string, PromptFlow> = {
  'rebound': {
    id: 'rebound',
    name: 'Standalone Rebound Flow',
    triggerContext: 'rebound',
    initialContainerId: 'reb_main',
    supportedModes: ['full', 'team'],
    containers: {
      'reb_main': {
        id: 'reb_main',
        name: 'Rebound Selection',
        triggerContext: 'rebound',
        supportedModes: ['full', 'team'],
        supportedDetailLevels: ['detailed', 'lite'],
        ui: { layout: 'single_screen' },
        primaryAction: {
          type: 'choice',
          eventType: 'rebound',
          options: ['Offensive Rebound', 'Defensive Rebound', 'Team Offensive Rebound', 'Team Defensive Rebound']
        },
        secondaryActions: [],
        optionalFields: [
          {
            id: 'reb_type',
            label: 'Rebound Type',
            type: 'choice',
            visibleIn: ['detailed', 'lite'],
            options: ['Long Rebound', 'Under Ring', 'Hustle']
          }
        ]
      }
    }
  }
};
