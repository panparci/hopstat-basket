#!/usr/bin/env node
/**
 * One-shot: Drive URLs in drill_submissions → Bunny (video) or /api/media (image).
 * Requires: tunnel :15432, BUNNY_STREAM_* in env, ssh startupkognifx-t for image scp.
 *
 *   set -a && source .env && set +a
 *   node tools/migrate-drive-to-bunny.mjs
 */
import { createHash, randomBytes } from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const LIB = process.env.BUNNY_STREAM_LIBRARY_ID;
const KEY = process.env.BUNNY_STREAM_API_KEY;
const CDN = (process.env.BUNNY_STREAM_CDN_HOST || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
const PG = {
  host: '127.0.0.1',
  port: '15432',
  user: 'hoopstat',
  db: 'hoopstat',
  pass: process.env.PGPASSWORD || 'VW4u6CRV2QtoJ9AZnmOLu3mO',
};
if (!LIB || !KEY || !CDN) {
  console.error('Need BUNNY_STREAM_LIBRARY_ID / API_KEY / CDN_HOST');
  process.exit(1);
}

const dir = join(tmpdir(), 'hs-drive-mig');
mkdirSync(dir, { recursive: true });

function psql(sql) {
  return execFileSync(
    'psql',
    ['-h', PG.host, '-p', PG.port, '-U', PG.user, '-d', PG.db, '-t', '-A', '-F', '\t', '-c', sql],
    { encoding: 'utf8', env: { ...process.env, PGPASSWORD: PG.pass } },
  ).trim();
}

function driveId(url) {
  return url.match(/\/d\/([a-zA-Z0-9_-]+)/)?.[1] || url.match(/[?&]id=([a-zA-Z0-9_-]+)/)?.[1] || '';
}

async function downloadDrive(fileId, dest) {
  const url = `https://drive.usercontent.google.com/download?id=${fileId}&export=download&confirm=t`;
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`drive HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100) throw new Error(`drive too small (${buf.length}b) — maybe blocked`);
  writeFileSync(dest, buf);
  return { buf, ct: res.headers.get('content-type') || 'application/octet-stream' };
}

async function bunnyUpload(title, buf) {
  const create = await fetch(`https://video.bunnycdn.com/library/${LIB}/videos`, {
    method: 'POST',
    headers: { AccessKey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: title || 'HoopStat latihan' }),
  });
  const raw = await create.text();
  if (!create.ok) throw new Error(`bunny create ${create.status} ${raw.slice(0, 200)}`);
  const guid = JSON.parse(raw).guid;
  if (!guid) throw new Error(`bunny create no guid: ${raw.slice(0, 200)}`);
  const put = await fetch(`https://video.bunnycdn.com/library/${LIB}/videos/${guid}`, {
    method: 'PUT',
    headers: { AccessKey: KEY, 'Content-Type': 'application/octet-stream' },
    body: buf,
  });
  if (!put.ok) throw new Error(`bunny put ${put.status} ${(await put.text()).slice(0, 200)}`);
  return {
    videoId: guid,
    embedURL: `https://player.mediadelivery.net/embed/${LIB}/${guid}`,
  };
}

function isImage(ct, mt) {
  if (mt === 'image') return true;
  if (mt === 'video') return false;
  return /^image\//i.test(ct);
}

function scpImage(localPath, remoteName) {
  const r = spawnSync('scp', [localPath, `startupkognifx-t:/opt/hoopstat/uploads/${remoteName}`], { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`scp failed: ${r.stderr || r.stdout}`);
}

function updateRow(id, patch) {
  let expr = 'doc';
  for (const [k, v] of Object.entries(patch)) {
    if (v === null) {
      expr = `(${expr} - '${k}')`;
      continue;
    }
    const lit = JSON.stringify(v).replace(/'/g, "''");
    expr = `jsonb_set(${expr}, '{${k}}', '${lit}'::jsonb, true)`;
  }
  const safe = id.replace(/'/g, "''");
  psql(`UPDATE drill_submissions SET doc = ${expr}, updated_at = now() WHERE id = '${safe}';`);
}

const rows = psql(`
SELECT id, coalesce(doc->>'mediaType',''), doc->>'videoUrl', coalesce(doc->>'drillName','drill')
FROM drill_submissions
WHERE coalesce(doc->>'videoUrl','') ~* 'drive\\.google'
`).split('\n').filter(Boolean);

console.log(`migrate ${rows.length} Drive rows → Bunny/media`);

for (const line of rows) {
  const [id, mediaType, videoUrl, drillName] = line.split('\t');
  const fid = driveId(videoUrl);
  if (!fid) {
    console.log('SKIP no id', id);
    continue;
  }
  const dest = join(dir, fid);
  process.stdout.write(`${id} ${fid} … `);
  try {
    const { buf, ct } = await downloadDrive(fid, dest);
    if (isImage(ct, mediaType)) {
      const ext = /\.png/i.test(ct) || buf[0] === 0x89 ? '.png' : '.jpg';
      const name = randomBytes(16).toString('hex') + ext;
      scpImage(dest, name);
      updateRow(id, {
        videoUrl: `/api/media/${name}`,
        mediaFile: name,
        mediaType: 'image',
        source: 'upload',
        bunnyVideoId: null,
      });
      // remove bunnyVideoId key properly
      psql(`UPDATE drill_submissions SET doc = doc - 'bunnyVideoId', updated_at = now() WHERE id = '${id}';`);
      console.log(`image → /api/media/${name} (${buf.length}b)`);
    } else {
      const up = await bunnyUpload(drillName, buf);
      updateRow(id, {
        videoUrl: up.embedURL,
        mediaType: 'video',
        source: 'bunny',
        bunnyVideoId: up.videoId,
      });
      psql(`UPDATE drill_submissions SET doc = doc - 'mediaFile', updated_at = now() WHERE id = '${id}';`);
      console.log(`video → bunny ${up.videoId} (${buf.length}b)`);
    }
  } catch (e) {
    console.log('FAIL', e instanceof Error ? e.message : e);
  } finally {
    try {
      unlinkSync(dest);
    } catch {}
  }
}

const left = psql(`SELECT count(*) FROM drill_submissions WHERE coalesce(doc->>'videoUrl','') ~* 'drive\\.google'`);
console.log('remaining drive rows:', left);
