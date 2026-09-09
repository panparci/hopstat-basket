import { PromptFlow } from '../../../types/promptFlow';

export const singlePlayerScoringFlow: PromptFlow = {
  id: 'single_scoring',
  name: 'Scoring Details',
  triggerContext: 'shot',
  supportedModes: ['single'],
  supportedDetailLevels: ['detailed', 'lite'],
  initialContainerId: 'make_details',
  containers: {
    'make_details': {
      id: 'make_details',
      name: 'Score Details',
      triggerContext: 'shot',
      supportedModes: ['single'],
      supportedDetailLevels: ['detailed', 'lite'],
      ui: { layout: 'single_screen' },
      primaryAction: {
        type: 'event', // This just preserves what they clicked
        eventType: 'shot',
        eventSubType: 'make'
      },
      secondaryActions: [
        {
          id: 'and_one',
          label: 'And One?',
          type: 'optional_choice',
          actorScope: 'NONE',
          options: ['No', 'Yes'],
          eventType: 'foul_drawn'
        }
      ],
      optionalFields: [
        {
          id: 'shot_location',
          label: 'Location',
          type: 'location',
          visibleIn: ['detailed', 'lite']
        },
        {
          id: 'shot_difficulty',
          label: 'Difficulty',
          type: 'choice',
          visibleIn: ['detailed'],
          options: ['Open', 'Contested', 'Heave']
        }
      ]
    }
  }
};

export const singlePlayerMissedShotFlow: PromptFlow = {
  id: 'single_missed_shot',
  name: 'Missed Shot Details',
  triggerContext: 'shot',
  supportedModes: ['single'],
  supportedDetailLevels: ['detailed', 'lite'],
  initialContainerId: 'missed_shot_main',
  containers: {
    'missed_shot_main': {
      id: 'missed_shot_main',
      name: 'Miss Outcome Details',
      triggerContext: 'miss',
      supportedModes: ['single'],
      supportedDetailLevels: ['detailed', 'lite'],
      ui: { layout: 'single_screen' },
      primaryAction: {
        type: 'event',
        eventType: 'shot'
      },
      secondaryActions: [
        {
          id: 'rebound',
          label: 'rebound',
          type: 'required_actor',
          actorScope: 'EITHER_TEAM',
          condition: "selections.field_foul_during !== 'Shooting Foul' && selections.field_foul_during !== 'And-One'",
          eventType: 'oreb'
        },
        {
          id: 'block_by',
          label: 'Blocked by (Opponent)',
          type: 'inline_actor_select',
          actorScope: 'OPPONENT_TEAM',
          condition: "selections.field_is_blocked === 'Ya'",
          eventType: 'blk'
        }
      ],
      optionalFields: [
        {
          id: 'shot_location',
          label: 'Location',
          type: 'location',
          visibleIn: ['detailed', 'lite']
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
        },
        {
          id: 'shot_difficulty',
          label: 'Shot Difficulty',
          visibleIn: ['detailed'],
          type: 'choice',
          options: ['Open', 'Contested', 'Heavily Contested']
        }
      ]
    }
  }
};

