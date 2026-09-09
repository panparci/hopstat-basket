import { PromptFlow } from '../../types/promptFlow';

export const anomalyFlows: Record<string, PromptFlow> = {
  'anomaly_missing_event': {
    id: 'anomaly_missing_event',
    name: 'Missing Event Flow',
    triggerContext: 'custom',
    initialContainerId: 'anomaly_main',
    supportedModes: ['full', 'team', 'single'],
    containers: {
      'anomaly_main': {
        id: 'anomaly_main',
        name: 'Report Missing Event',
        triggerContext: 'custom',
        supportedModes: ['full', 'team', 'single'],
        supportedDetailLevels: ['detailed', 'lite'],
        ui: { layout: 'single_screen' },
        primaryAction: {
          type: 'choice',
          eventType: 'possession_marker',
          label: 'What event is missing?',
          options: ['Missing Steal', 'Missing Rebound', 'Missing Shot', 'Missing Turnover', 'Missing Foul', 'Other/Unknown']
        },
        secondaryActions: [],
        optionalFields: [
          {
            id: 'anomaly_desc',
            label: 'Description',
            type: 'choice',
            visibleIn: ['detailed', 'lite'],
            options: ['Please review video footage to patch.']
          }
        ]
      }
    }
  }
};
