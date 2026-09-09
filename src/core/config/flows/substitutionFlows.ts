import { PromptFlow } from '../../types/promptFlow';

export const substitutionFlows: Record<string, PromptFlow> = {
  'substitution': {
    id: 'substitution',
    name: 'Substitution Flow',
    triggerContext: 'custom',
    initialContainerId: 'sub_main',
    supportedModes: ['full', 'team'],
    containers: {
      'sub_main': {
        id: 'sub_main',
        name: 'Player Sub Rotation',
        triggerContext: 'sub_in',
        supportedModes: ['full', 'team'],
        supportedDetailLevels: ['detailed', 'lite'],
        ui: { layout: 'single_screen' },
        primaryAction: {
          type: 'event',
          eventType: 'sub_in'
        },
        secondaryActions: [
          {
            id: 'sub_out',
            label: 'Player Out',
            type: 'required_actor',
            actorScope: 'OUR_TEAM',
            eventType: 'sub_out'
          }
        ],
        optionalFields: []
      }
    }
  },
  'timeout': {
    id: 'timeout',
    name: 'Timeout Flow',
    triggerContext: 'custom',
    initialContainerId: 'timeout_main',
    supportedModes: ['full', 'team'],
    containers: {
      'timeout_main': {
        id: 'timeout_main',
        name: 'Timeout Called',
        triggerContext: 'timeout',
        supportedModes: ['full', 'team'],
        supportedDetailLevels: ['detailed', 'lite'],
        ui: { layout: 'single_screen' },
        primaryAction: {
          type: 'choice',
          eventType: 'timeout',
          options: ['Full Timeout', 'Short Timeout', 'Official Timeout']
        },
        secondaryActions: [],
        optionalFields: []
      }
    }
  }
};
