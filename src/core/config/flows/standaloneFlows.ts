import { PromptFlow } from '../../types/promptFlow';

export const standaloneFlows: Record<string, PromptFlow> = {
  'standalone_steal': {
    id: 'standalone_steal',
    name: 'Standalone Steal Flow',
    triggerContext: 'custom',
    initialContainerId: 'steal_main',
    supportedModes: ['full', 'team', 'single'],
    containers: {
      'steal_main': {
        id: 'steal_main',
        name: 'Steal Input',
        triggerContext: 'to',
        supportedModes: ['full', 'team', 'single'],
        supportedDetailLevels: ['detailed', 'lite'],
        ui: { layout: 'single_screen' },
        primaryAction: {
          type: 'event',
          eventType: 'stl',
          label: 'Who got the steal?'
        },
        secondaryActions: [
           {
             id: 'to_actor',
             label: 'Turnover committed by',
             type: 'inline_actor_select',
             actorScope: 'OPPONENT_TEAM',
             eventType: 'to'
           }
        ],
        optionalFields: [
          {
             id: 'steal_context',
             label: 'Game Context',
             type: 'choice',
             visibleIn: ['detailed', 'lite'],
             options: ['Passing Lane', 'On Ball', 'Loose Ball']
          }
        ]
      }
    }
  },
  'standalone_block': {
    id: 'standalone_block',
    name: 'Standalone Block Flow',
    triggerContext: 'custom',
    initialContainerId: 'block_main',
    supportedModes: ['full', 'team', 'single'],
    containers: {
      'block_main': {
        id: 'block_main',
        name: 'Block Input',
        triggerContext: 'shot',
        supportedModes: ['full', 'team', 'single'],
        supportedDetailLevels: ['detailed', 'lite'],
        ui: { layout: 'single_screen' },
        primaryAction: {
          type: 'event',
          eventType: 'blk',
          label: 'Who blocked the shot?'
        },
        secondaryActions: [
           {
             id: 'miss_actor',
             label: 'Missed shot by',
             type: 'required_actor',
             actorScope: 'OPPONENT_TEAM',
             eventType: 'shot', // Actually missed shot
             eventSubType: 'miss'
           },
           {
             id: 'blk_rebound',
             label: 'Rebound after block',
             type: 'required_actor',
             actorScope: 'EITHER_TEAM',
             eventType: 'oreb'
           }
        ],
        optionalFields: []
      }
    }
  }
};
