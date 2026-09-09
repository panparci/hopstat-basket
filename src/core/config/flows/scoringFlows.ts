import { PromptFlow } from '../../types/promptFlow';

export const scoringFlows: Record<string, PromptFlow> = {
  'plus_2pt': {
    id: 'plus_2pt',
    name: '2PT Made Flow',
    triggerContext: 'shot',
    initialContainerId: 'scoring_main',
    supportedModes: ['full', 'team'],
    containers: {
      'scoring_main': {
        id: 'scoring_main',
        name: '2PT Scoring',
        triggerContext: '2pt_make',
        supportedModes: ['full', 'team'],
        supportedDetailLevels: ['detailed', 'lite'],
        ui: { layout: 'single_screen' },
        primaryAction: {
          type: 'event',
          eventType: 'shot',
          eventSubType: '2pt_make'
        },
        secondaryActions: [
          {
            id: 'assist',
            label: 'Assist Selection',
            type: 'inline_actor_select',
            actorScope: 'OUR_TEAM',
            excludePrimaryActor: true,
            eventType: 'ast'
          },
          {
            id: 'fouled_by',
            label: 'Fouled By (Opponent Player)',
            type: 'required_actor',
            actorScope: 'OPPONENT_TEAM',
            condition: "selections.field_and1_foul_option === 'Yes'",
            eventType: 'foul',
            eventSubType: 'Shooting Foul'
          }
        ],
        optionalFields: [
          {
            id: 'and1_foul_option',
            label: 'And-1 — Opponent Foul?',
            type: 'choice',
            visibleIn: ['detailed', 'lite'],
            options: ['No', 'Yes']
          },
          {
            id: 'game_context',
            label: 'Game Context',
            visibleIn: ['detailed'],
            type: 'choice',
            options: ['Transition', 'Half-court Set', 'Inbound', 'Press Break']
          },
          {
            id: 'pressure_level',
            label: 'Pressure Level',
            visibleIn: ['detailed'],
            type: 'choice',
            options: ['No Pressure', 'Light', 'Heavy / Trap']
          },
          {
            id: 'shot_quality',
            label: 'Shot Difficulty',
            visibleIn: ['detailed'],
            type: 'choice',
            options: ['Open', 'Contested', 'Heave']
          },
          {
            id: 'shot_area',
            label: 'Shot Area',
            visibleIn: ['detailed'],
            type: 'choice',
            options: ['Paint', 'Mid-range', 'Baseline']
          }
        ]
      }
    }
  },
  'plus_3pt': {
    id: 'plus_3pt',
    name: '3PT Made Flow',
    triggerContext: 'shot',
    initialContainerId: 'thr_pt_scoring_main',
    supportedModes: ['full', 'team'],
    containers: {
      'thr_pt_scoring_main': {
        id: 'thr_pt_scoring_main',
        name: '3PT Scoring',
        triggerContext: '3pt_make',
        supportedModes: ['full', 'team'],
        supportedDetailLevels: ['detailed', 'lite'],
        ui: { layout: 'single_screen' },
        primaryAction: {
          type: 'event',
          eventType: 'shot',
          eventSubType: '3pt_make'
        },
        secondaryActions: [
          {
            id: 'assist',
            label: 'Assist Selection',
            type: 'inline_actor_select',
            actorScope: 'OUR_TEAM',
            excludePrimaryActor: true,
            eventType: 'ast'
          },
          {
            id: 'fouled_by',
            label: 'Fouled By (Opponent Player)',
            type: 'required_actor',
            actorScope: 'OPPONENT_TEAM',
            condition: "selections.field_and1_foul_option === 'Yes'",
            eventType: 'foul',
            eventSubType: 'Shooting Foul'
          }
        ],
        optionalFields: [
          {
            id: 'and1_foul_option',
            label: 'And-1 — Opponent Foul?',
            type: 'choice',
            visibleIn: ['detailed', 'lite'],
            options: ['No', 'Yes']
          },
          {
            id: 'game_context',
            label: 'Game Context',
            visibleIn: ['detailed'],
            type: 'choice',
            options: ['Transition', 'Half-court Set', 'Inbound', 'Press Break']
          },
          {
            id: 'pressure_level',
            label: 'Pressure Level',
            visibleIn: ['detailed'],
            type: 'choice',
            options: ['No Pressure', 'Light', 'Heavy / Trap']
          },
          {
            id: 'shot_quality',
            label: 'Shot Difficulty',
            visibleIn: ['detailed'],
            type: 'choice',
            options: ['Open', 'Contested', 'Heave']
          },
          {
            id: 'shot_area',
            label: 'Shot Area',
            visibleIn: ['detailed'],
            type: 'choice',
            options: ['Top Key', 'Wing', 'Corner']
          }
        ]
      }
    }
  },
  'missed_shot': {
    id: 'missed_shot',
    name: 'Missed Shot Flow',
    triggerContext: 'shot',
    initialContainerId: 'miss_management',
    supportedModes: ['full', 'team'],
    containers: {
      'miss_management': {
        id: 'miss_management',
        name: 'Miss Management',
        triggerContext: 'miss',
        supportedModes: ['full', 'team'],
        supportedDetailLevels: ['detailed', 'lite'],
        ui: { layout: 'single_screen' },
        primaryAction: {
          type: 'event',
          eventType: 'shot'
        },
        secondaryActions: [
          {
            id: 'block',
            label: 'Block by Opponent',
            type: 'inline_actor_select',
            actorScope: 'OPPONENT_TEAM',
            condition: "selections.field_is_blocked === 'Ya'",
            eventType: 'blk'
          },
          {
            id: 'fouled_by',
            label: 'Who committed the foul?',
            type: 'required_actor',
            actorScope: 'OPPONENT_TEAM',
            condition: "selections.field_foul_during === 'Shooting Foul' || selections.field_foul_during === 'And-One'",
            eventType: 'foul'
          },
          {
            id: 'assist',
            label: 'Assist Selection',
            type: 'inline_actor_select',
            actorScope: 'OUR_TEAM',
            excludePrimaryActor: true,
            condition: "selections.field_foul_during === 'Shooting Foul'",
            eventType: 'ast'
          },
          {
            id: 'rebound',
            label: 'Rebound',
            type: 'required_actor',
            actorScope: 'EITHER_TEAM',
            condition: "selections.field_foul_during !== 'Shooting Foul' && selections.field_foul_during !== 'And-One'",
            eventType: 'oreb'
          }
        ],
        optionalFields: [
          {
            id: 'game_context',
            label: 'Game Context',
            visibleIn: ['detailed'],
            type: 'choice',
            options: ['Transition', 'Half-court Set', 'Inbound', 'Press Break']
          },
          {
            id: 'pressure_level',
            label: 'Pressure Level',
            visibleIn: ['detailed'],
            type: 'choice',
            options: ['No Pressure', 'Light', 'Heavy / Trap']
          },
          {
            id: 'is_blocked',
            label: 'Apakah ada Block?',
            type: 'choice',
            visibleIn: ['detailed', 'lite'],
            options: ['Tidak', 'Ya']
          },
          {
            id: 'foul_during',
            label: 'Foul on Shot?',
            type: 'choice',
            visibleIn: ['detailed', 'lite'],
            options: ['No Foul', 'Shooting Foul']
          }
        ]
      }
    }
  },
  'missed_free_throw': {
    id: 'missed_free_throw',
    name: 'Missed Free Throw',
    triggerContext: 'shot',
    initialContainerId: 'ft_miss_eval',
    supportedModes: ['full', 'team'],
    containers: {
      'ft_miss_eval': {
        id: 'ft_miss_eval',
        name: 'FT Outcome',
        triggerContext: 'ft',
        supportedModes: ['full', 'team'],
        supportedDetailLevels: ['detailed', 'lite'],
        ui: { layout: 'single_screen' },
        primaryAction: {
          type: 'event',
          eventType: 'shot'
        },
        secondaryActions: [
           {
             id: 'ft_rebound',
             label: 'Rebound on Miss',
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
