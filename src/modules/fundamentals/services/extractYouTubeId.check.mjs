// ponytail: one runnable check for shorts/live YouTube id parse
import assert from 'node:assert/strict';

function extractYouTubeId(urlOrId) {
  if (!urlOrId) return '0j3aY_z1Jro';
  const str = urlOrId.trim();
  if (str.length === 11 && !str.includes('/') && !str.includes('.')) return str;
  const match = str.match(
    /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|shorts\/|live\/|watch\?v=|watch\?.+&v=))([\w-]{11})/,
  );
  return match ? match[1] : '0j3aY_z1Jro';
}

assert.equal(extractYouTubeId('https://youtube.com/shorts/9On9hTA-d4w?si=x'), '9On9hTA-d4w');
assert.equal(extractYouTubeId('https://youtu.be/KpQZobj0hYA'), 'KpQZobj0hYA');
assert.equal(extractYouTubeId('https://www.youtube.com/live/abcdefghijk'), 'abcdefghijk');
console.log('extractYouTubeId.check: ok');
