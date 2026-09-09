import { PromptFlow } from '../../types/promptFlow';

export const turnoverFlows: Record<string, PromptFlow> = {
  'turnover': {
    id: 'turnover',
    name: 'Turnover Flow',
    triggerContext: 'to',
    initialContainerId: 'to_main',
    supportedModes: ['full', 'team', 'single'],
    containers: {
      'to_main': {
        id: 'to_main',
        name: 'Turnover Detail',
        triggerContext: 'to',
        supportedModes: ['full', 'team', 'single'],
        supportedDetailLevels: ['detailed', 'lite'],
        ui: { layout: 'single_screen' },
        primaryAction: {
          type: 'choice',
          eventType: 'to',
          label: 'Type of Turnover',
          options: [
            'Bad Pass', 
            'Bad Handle', 
            'Travel', 
            'Double Dribble',
            'Offensive Foul', 
            'Out of Bounds', 
            'Backcourt Violation', 
            'Shot Clock Violation', 
            'Time Violation',
            '3 Seconds', 
            '8 Seconds', 
            'Carrying',
            'Kicked Ball', 
            'Goaltending',
            'Other Violation', 
            'Stealed'
          ]
        },
        secondaryActions: [
          {
            id: 'steal_actor',
            label: 'Steal by',
            type: 'required_actor',
            actorScope: 'OPPONENT_TEAM',
            condition: 'selections.primaryChoice === "Stealed"',
            eventType: 'stl'
          },
          {
            id: 'bad_pass_steal_actor',
            label: 'Intercepted / Stolen by',
            type: 'inline_actor_select',
            actorScope: 'OPPONENT_TEAM',
            condition: 'selections.primaryChoice === "Bad Pass" || selections.primaryChoice === "Bad Handle"',
            eventType: 'stl'
          }
        ],
        optionalFields: [
          {
            id: 'to_context',
            label: 'Game Context',
            type: 'choice',
            visibleIn: ['detailed', 'lite'],
            options: ['Transition', 'Half-court Set', 'Inbound', 'Press Break']
          },
          {
            id: 'pressure_level',
            label: 'Pressure Level',
            type: 'choice',
            visibleIn: ['detailed', 'lite'],
            options: ['No Pressure', 'Light', 'Heavy / Trap']
          }
        ]
      }
    }
  }
};
