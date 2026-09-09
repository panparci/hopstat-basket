export interface ShortcutConfig {
  key: string;
  action: string;
  description: string;
  category: 'both' | 'youtube' | 'timer' | 'system';
}

export const KEYBOARD_SHORTCUTS: ShortcutConfig[] = [
  // Both
  { key: ' ', action: 'toggle_both', description: 'Play/Pause Both', category: 'both' },
  { key: '3', action: 'stop_both', description: 'Stop Both', category: 'both' },
  { key: '4', action: 'play_both', description: 'Play Both', category: 'both' },
  { key: '1', action: 'seek_both_backward_5', description: 'Both -5s', category: 'both' },
  { key: '2', action: 'seek_both_backward_1', description: 'Both -1s', category: 'both' },
  { key: '5', action: 'seek_both_forward_1', description: 'Both +1s', category: 'both' },
  { key: '6', action: 'seek_both_forward_5', description: 'Both +5s', category: 'both' },

  // YouTube
  { key: 'f', action: 'play_youtube', description: 'Play YT', category: 'youtube' },
  { key: 'd', action: 'stop_youtube', description: 'Stop YT', category: 'youtube' },
  { key: 'a', action: 'seek_youtube_backward_3', description: 'YT -3s', category: 'youtube' },
  { key: 's', action: 'seek_youtube_backward_1', description: 'YT -1s', category: 'youtube' },
  { key: 'g', action: 'seek_youtube_forward_1', description: 'YT +1s', category: 'youtube' },
  { key: 'h', action: 'seek_youtube_forward_3', description: 'YT +3s', category: 'youtube' },

  // Timer
  { key: 'r', action: 'play_timer', description: 'Play Timer', category: 'timer' },
  { key: 'e', action: 'stop_timer', description: 'Stop Timer', category: 'timer' },
  { key: 'q', action: 'adjust_timer_backward_3', description: 'Timer -3s', category: 'timer' },
  { key: 'w', action: 'adjust_timer_backward_1', description: 'Timer -1s', category: 'timer' },
  { key: 't', action: 'adjust_timer_forward_1', description: 'Timer +1s', category: 'timer' },
  { key: 'y', action: 'adjust_timer_forward_3', description: 'Timer +3s', category: 'timer' },

  // System
  { key: '*', action: 'time_revision', description: 'Time Revision', category: 'system' },
  { key: 'backspace', action: 'backspace', description: 'Backspace', category: 'system' },
];
