export const SAVE_KEY = 'veter-save';
export const SAVE_VERSION = 2;
const phases = new Set(['tutorial', 'meet', 'quests', 'epilogue']);
const finite = (x) => typeof x === 'number' && Number.isFinite(x);
const bound = (x, a, b) => Math.min(b, Math.max(a, x));

export function validateCheckpoint(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const chapter = raw.chapter ?? 1;
  if (![1, 2, 3].includes(chapter) || !finite(raw.x) || !finite(raw.z) ||
      Math.abs(raw.x) > 105 || Math.abs(raw.z) > 105 ||
      !Number.isInteger(raw.quest) || raw.quest < 0 || raw.quest > 6 ||
      !finite(raw.trust) || !finite(raw.apples) ||
      !Array.isArray(raw.taken) || raw.taken.length !== 3 ||
      !raw.taken.every(x => typeof x === 'boolean')) return null;
  const phase = phases.has(raw.phase) ? raw.phase : 'quests';
  return { chapter, x: raw.x, z: raw.z, heading: finite(raw.heading) ? raw.heading : Math.PI,
    quest: raw.quest, trust: bound(raw.trust, 0, 100),
    apples: chapter===1 ? raw.taken.filter(Boolean).length : 0, taken: raw.taken.slice(), phase,
    tutStep: bound(Number.isInteger(raw.tutStep) ? raw.tutStep : 0, 0, 4),
    alexFollows: Boolean(raw.alexFollows),
    questSteps: bound(Number.isInteger(raw.questSteps) ? raw.questSteps : raw.freeProgress ?? 0, 0, 3),
    freeProgress: bound(Number.isInteger(raw.freeProgress) ? raw.freeProgress : 0, 0, 3),
    foalFreed: Boolean(raw.foalFreed || (chapter === 1 && raw.quest >= 4) || chapter > 1),
    playTime: finite(raw.playTime) ? Math.max(0, raw.playTime) : 0,
  };
}

export function decodeSave(raw) {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!data || typeof data !== 'object') return null;
    if (data.version != null && data.version !== SAVE_VERSION) return null;
    const checkpoint = validateCheckpoint(data.version ? data.checkpoint : data);
    if (!checkpoint && !data.version) return null;
    const completed = Array.isArray(data.completedChapters)
      ? [...new Set(data.completedChapters.filter(x => [1, 2, 3].includes(x)))].sort() : [];
    if (checkpoint?.chapter > 1 && !completed.includes(checkpoint.chapter - 1)) return null;
    return { version: SAVE_VERSION, checkpoint, completedChapters: completed,
      settings: data.settings && typeof data.settings === 'object' ? data.settings : {} };
  } catch { return null; }
}

export function readSave(storage) {
  try { return decodeSave(storage.getItem(SAVE_KEY)); } catch { return null; }
}

export function writeSave(storage, data) {
  try { storage.setItem(SAVE_KEY, JSON.stringify({ ...data, version: SAVE_VERSION })); return true; }
  catch { return false; }
}
