import {
  createTracks,
  DEFAULT_MASTER,
  DEFAULT_SAMPLER,
  emptyPattern,
  SCENE_NAMES,
  STEPS,
  type FilterType,
  type LfoTarget,
  type LfoWave,
  type MasterParams,
  type Pattern,
  type SamplerSettings,
  type Scene,
  type Track,
  type TrackParams,
  type Wave,
} from './types';
import type { PlayMode } from '../state/store';

export const PROJECT_KIND = 'yuvoneitor-project';
export const SCENE_KIND = 'yuvoneitor-scene';
export const PROJECT_VERSION = 1;

export interface ProjectData {
  bpm: number;
  swing: number;
  mode: PlayMode;
  song: number[];
  songLoop: boolean;
  selectedScene: number;
  selectedTrack: string;
  tracks: Track[];
  scenes: Scene[];
  master: MasterParams;
  sampler: SamplerSettings;
}

export interface ProjectFile {
  app: 'YUVONEITOR';
  kind: typeof PROJECT_KIND;
  version: number;
  exportedAt: string;
  name: string;
  data: ProjectData;
}

export interface SceneFile {
  app: 'YUVONEITOR';
  kind: typeof SCENE_KIND;
  version: number;
  exportedAt: string;
  name: string;
  data: {
    name: string;
    patterns: Record<string, Pattern>;
  };
}

/* ---------------- helpers ---------------- */

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const num = (v: unknown, def: number, min: number, max: number): number => {
  const n = typeof v === 'number' && Number.isFinite(v) ? v : def;
  return Math.min(max, Math.max(min, n));
};
const int = (v: unknown, def: number, min: number, max: number): number =>
  Math.round(num(v, def, min, max));
const bool = (v: unknown, def: boolean): boolean => (typeof v === 'boolean' ? v : def);
const str = (v: unknown, def: string, maxLen = 60): string =>
  typeof v === 'string' && v.length ? v.slice(0, maxLen) : def;
const oneOf = <T extends string>(v: unknown, def: T, opts: readonly T[]): T =>
  typeof v === 'string' && (opts as readonly string[]).includes(v) ? (v as T) : def;

const WAVES: readonly Wave[] = ['sawtooth', 'square', 'triangle', 'sine', 'noise', 'supersaw'];
const FILTERS: readonly FilterType[] = ['lowpass', 'highpass', 'bandpass', 'notch'];
const LFO_T: readonly LfoTarget[] = ['off', 'pitch', 'filter', 'volume'];
const LFO_W: readonly LfoWave[] = ['sine', 'triangle', 'square', 'sawtooth'];

function sanitizeStep(raw: unknown): { n: number[]; a: boolean } {
  if (!isRecord(raw)) return { n: [], a: false };
  const n = Array.isArray(raw.n)
    ? raw.n
        .filter((x) => typeof x === 'number' && Number.isFinite(x))
        .map((x) => Math.round(x as number))
        .filter((x) => x >= 0 && x <= 127)
        .slice(0, 8)
    : [];
  return { n, a: bool(raw.a, false) };
}

function sanitizePattern(raw: unknown): Pattern {
  if (!Array.isArray(raw)) return emptyPattern();
  const out: Pattern = [];
  for (let i = 0; i < STEPS; i++) out.push(sanitizeStep(raw[i]));
  return out;
}

function sanitizePatterns(raw: unknown, trackIds: string[]): Record<string, Pattern> {
  const rec = isRecord(raw) ? raw : {};
  const out: Record<string, Pattern> = {};
  for (const id of trackIds) out[id] = sanitizePattern(rec[id]);
  return out;
}

function sanitizeParams(raw: unknown, def: TrackParams): TrackParams {
  const r = isRecord(raw) ? raw : {};
  return {
    volume: num(r.volume, def.volume, 0, 1),
    pan: num(r.pan, def.pan, -1, 1),
    mute: bool(r.mute, def.mute),
    solo: bool(r.solo, def.solo),
    wave: oneOf(r.wave, def.wave, WAVES),
    fm: bool(r.fm, def.fm),
    fmRatio: num(r.fmRatio, def.fmRatio, 0.25, 12),
    fmAmount: num(r.fmAmount, def.fmAmount, 0, 12),
    filterType: oneOf(r.filterType, def.filterType, FILTERS),
    cutoff: num(r.cutoff, def.cutoff, 0, 1),
    resonance: num(r.resonance, def.resonance, 0.1, 25),
    filterEnv: num(r.filterEnv, def.filterEnv, 0, 1),
    attack: num(r.attack, def.attack, 0.001, 4),
    decay: num(r.decay, def.decay, 0.01, 4),
    sustain: num(r.sustain, def.sustain, 0, 1),
    release: num(r.release, def.release, 0.005, 6),
    lfoTarget: oneOf(r.lfoTarget, def.lfoTarget, LFO_T),
    lfoWave: oneOf(r.lfoWave, def.lfoWave, LFO_W),
    lfoRate: num(r.lfoRate, def.lfoRate, 0.05, 20),
    lfoDepth: num(r.lfoDepth, def.lfoDepth, 0, 1),
    drive: num(r.drive, def.drive, 0, 1),
    reverb: num(r.reverb, def.reverb, 0, 1),
    delay: num(r.delay, def.delay, 0, 1),
    tune: num(r.tune, def.tune, -24, 24),
    gate: num(r.gate, def.gate, 0.1, 8),
    glide: num(r.glide, def.glide, 0, 0.5),
  };
}

function sanitizeMaster(raw: unknown): MasterParams {
  const r = isRecord(raw) ? raw : {};
  const d = DEFAULT_MASTER;
  return {
    volume: num(r.volume, d.volume, 0, 1),
    drive: num(r.drive, d.drive, 0, 1),
    reverbDecay: num(r.reverbDecay, d.reverbDecay, 0.4, 9),
    reverbMix: num(r.reverbMix, d.reverbMix, 0, 1.5),
    delayDiv: int(r.delayDiv, d.delayDiv, 0, 8),
    delayFeedback: num(r.delayFeedback, d.delayFeedback, 0, 0.92),
    delayMix: num(r.delayMix, d.delayMix, 0, 1.5),
    delayTone: num(r.delayTone, d.delayTone, 0, 1),
  };
}

function sanitizeSampler(raw: unknown): SamplerSettings {
  const r = isRecord(raw) ? raw : {};
  const d = DEFAULT_SAMPLER;
  const start = num(r.start, d.start, 0, 1);
  const end = num(r.end, d.end, 0, 1);
  return {
    name: d.name, // el audio no viaja en el JSON: se mantiene el nombre demo
    start: Math.min(start, end),
    end: Math.max(start, end),
    mode: oneOf(r.mode, d.mode, ['chromatic', 'slice'] as const),
    slices: int(r.slices, d.slices, 2, 16),
    reverse: bool(r.reverse, d.reverse),
  };
}

/* ---------------- build ---------------- */

export function buildProjectFile(s: {
  bpm: number;
  swing: number;
  mode: PlayMode;
  song: number[];
  songLoop: boolean;
  selectedScene: number;
  selectedTrack: string;
  tracks: Track[];
  scenes: Scene[];
  master: MasterParams;
  sampler: SamplerSettings;
}): ProjectFile {
  return {
    app: 'YUVONEITOR',
    kind: PROJECT_KIND,
    version: PROJECT_VERSION,
    exportedAt: new Date().toISOString(),
    name: `Yuvoneitor ${s.bpm} BPM · ${s.song.length} bars`,
    data: {
      bpm: Math.round(s.bpm),
      swing: s.swing,
      mode: s.mode,
      song: s.song.slice(0, 64),
      songLoop: s.songLoop,
      selectedScene: s.selectedScene,
      selectedTrack: s.selectedTrack,
      tracks: JSON.parse(JSON.stringify(s.tracks)),
      scenes: JSON.parse(JSON.stringify(s.scenes)),
      master: { ...s.master },
      sampler: { ...s.sampler },
    },
  };
}

export function buildSceneFile(scene: Scene): SceneFile {
  return {
    app: 'YUVONEITOR',
    kind: SCENE_KIND,
    version: PROJECT_VERSION,
    exportedAt: new Date().toISOString(),
    name: scene.name,
    data: {
      name: scene.name,
      patterns: JSON.parse(JSON.stringify(scene.patterns)),
    },
  };
}

/* ---------------- parse / validate ---------------- */

export function parseProjectFile(raw: unknown): ProjectData {
  if (!isRecord(raw)) throw new Error('El archivo no es un JSON válido de Yuvoneitor.');
  if (raw.app !== 'YUVONEITOR' || raw.kind !== PROJECT_KIND)
    throw new Error('No es un proyecto de Yuvoneitor (.json de “Guardar proyecto”).');
  if (!isRecord(raw.data)) throw new Error('Proyecto corrupto: falta el bloque de datos.');
  const d = raw.data;

  const defaults = createTracks();
  const trackIds = defaults.map((t) => t.id);
  const rawTracks = Array.isArray(d.tracks) ? (d.tracks as unknown[]) : [];
  const byId = new Map<string, unknown>(rawTracks.filter(isRecord).map((t) => [(t as Record<string, unknown>).id as string, t]));
  const tracks: Track[] = defaults.map((def) => {
    const rawT = byId.get(def.id);
    const params = sanitizeParams(isRecord(rawT) ? (rawT as Record<string, unknown>).params : undefined, def.params);
    return { ...def, params };
  });

  const rawScenes = Array.isArray(d.scenes) ? (d.scenes as unknown[]) : [];
  if (!rawScenes.length) throw new Error('Proyecto corrupto: no contiene escenas.');
  const scenes: Scene[] = rawScenes.slice(0, SCENE_NAMES.length).map((rs, i) => {
    const r = isRecord(rs) ? rs : {};
    return {
      name: str(r.name, `Escena ${SCENE_NAMES[i] ?? i + 1}`, 40),
      patterns: sanitizePatterns(r.patterns, trackIds),
    };
  });

  const song = Array.isArray(d.song)
    ? (d.song as unknown[])
        .filter((x) => typeof x === 'number' && Number.isFinite(x))
        .map((x) => Math.round(x as number))
        .filter((x) => x >= 0 && x < scenes.length)
        .slice(0, 64)
    : [];

  const trackIdsSet = new Set(trackIds);
  return {
    bpm: int(d.bpm, 124, 60, 200),
    swing: num(d.swing, 0.08, 0, 0.6),
    mode: d.mode === 'song' ? 'song' : 'pattern',
    song,
    songLoop: bool(d.songLoop, true),
    selectedScene: int(d.selectedScene, 0, 0, Math.max(0, scenes.length - 1)),
    selectedTrack: typeof d.selectedTrack === 'string' && trackIdsSet.has(d.selectedTrack) ? d.selectedTrack : 'acid',
    tracks,
    scenes,
    master: sanitizeMaster(d.master),
    sampler: sanitizeSampler(d.sampler),
  };
}

export function parseSceneFile(raw: unknown, trackIds: string[]): { name: string; patterns: Record<string, Pattern> } {
  if (!isRecord(raw)) throw new Error('El archivo no es un JSON válido de Yuvoneitor.');
  if (raw.app !== 'YUVONEITOR' || raw.kind !== SCENE_KIND)
    throw new Error('No es un pattern de Yuvoneitor (.json de “Guardar escena”).');
  if (!isRecord(raw.data)) throw new Error('Pattern corrupto: falta el bloque de datos.');
  return {
    name: str(raw.data.name, 'Escena', 40),
    patterns: sanitizePatterns(raw.data.patterns, trackIds),
  };
}

/* ---------------- file helpers ---------------- */

const stamp = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
};

export const projectFilename = (bpm: number) => `yuvoneitor-proyecto-${Math.round(bpm)}bpm-${stamp()}.json`;
export const sceneFilename = (sceneName: string) => {
  const slug = sceneName
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24);
  return `yuvoneitor-escena-${slug || 'pattern'}-${stamp()}.json`;
};

export function downloadJson(obj: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export async function readJsonFile(file: File): Promise<unknown> {
  const text = await file.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('No se pudo leer el archivo: no es un JSON válido.');
  }
}
