import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { CHAPTERS } from '../src/story/chapters.js';
import { AUDIO_ASSETS } from '../src/audio.js';
import { AUDIO_CUE_TEXT } from '../src/audio-cues.js';

const manifest=JSON.parse(await readFile(new URL('../public/assets/audio/audio-manifest.json',import.meta.url),'utf8'));

test('Every spoken objective has a local licensed recording; shipped bytes match the provenance register', async()=>{
  const assets=new Map(manifest.assets.map(asset=>[asset.path,asset]));
  const paths=[...Object.values(AUDIO_ASSETS.voice),...Object.values(AUDIO_ASSETS.effects),...Object.values(AUDIO_ASSETS.streams)];
  assert.equal(new Set(paths).size,35);
  for(const path of paths){
    assert.match(path,/^assets\/audio\/(voice|sfx)\/[a-z\d-]+\.(mp3|wav)$/);
    const asset=assets.get(path);assert.ok(asset,`Missing provenance: ${path}`);
    assert.ok(['CC0-1.0','CC-BY-3.0','CC-BY-4.0','CC-BY-SA-4.0'].includes(asset.license));
    assert.ok(asset.creator&&asset.source&&asset.modifications);
    const bytes=await readFile(new URL(`../public/${path}`,import.meta.url));
    assert.equal(bytes.length,asset.bytes,path);
    assert.equal(createHash('sha256').update(bytes).digest('hex'),asset.sha256,path);
  }
  for(const chapter of Object.values(CHAPTERS))for(const quest of chapter.quests){
    assert.ok(AUDIO_ASSETS.voice[quest.id],`Missing spoken goal ${quest.id}`);
    assert.ok(AUDIO_CUE_TEXT[quest.id]?.length>5);
  }
  assert.equal(Object.keys(AUDIO_CUE_TEXT).length,23);
});
