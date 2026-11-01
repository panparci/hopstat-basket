import assert from 'node:assert/strict';
import { test } from 'node:test';
import { uniqueDrillsByName } from './uniqueDrills.ts';
import type { FundamentalDrill } from '../types.ts';

const drill = (name: string, id: string): FundamentalDrill =>
  ({ id, name, category: 'shooting', difficulty: 'pemula', description: '', mechanics: [], youtubeUrl: '', youtubeVideoId: '', loopStartTimeSec: 0, recommendedSets: 1, recommendedReps: '10', targetMuscles: [], equipment: [] });

test('uniqueDrillsByName keeps first of case-insensitive duplicates', () => {
  const out = uniqueDrillsByName([
    drill('Jab Shot', 'a'),
    drill('JAB SHOT', 'b'),
    drill(' jab shot ', 'c'),
    drill('Euro Step', 'd'),
  ]);
  assert.deepEqual(out.map((d) => d.id), ['a', 'd']);
});
