export interface CoachAnnotation {
  id: string;
  matchId: string;
  coachId: string;
  targetType: 'possession' | 'event' | 'player' | 'team' | 'game';
  targetId: string; // id of possession, event, player, team, or match
  category: 'skill' | 'strategy' | 'decision' | 'teamwork' | 'effort' | 'mental';
  rating?: number; // 1..5
  note: string;
  videoTimestamp?: number; // seconds from video
  createdAt: string;
}
