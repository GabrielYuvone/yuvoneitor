export type TrackKind =
  | 'kick'
  | 'snare'
  | 'chh'
  | 'ohh'
  | 'clap'
  | 'moog'
  | 'acid'
  | 'pad'
  | 'ambient'
  | 'pluck'
  | 'sampler';

export type Wave = 'sawtooth' | 'square' | 'triangle' | 'sine' | 'noise' | 'supersaw';
export type FilterType = 'lowpass' | 'highpass' | 'bandpass' | 'notch';
export type LfoTarget = 'off' | 'pitch' | 'filter' | 'volume';
export type LfoWave = 'sine' | 'triangle' | 'square' | 'sawtooth';

export interface TrackParams {
  volume: number;
  pan: number;
  mute: boolean;
  solo: boolean;
  wave: Wave;
  fm: boolean;
  fmRatio: number;
  fmAmount: number;
  filterType: FilterType;
  cutoff: number; // 0..1 normalized (exp)
  resonance: number; // Q
  filterEnv: number; // 0..1
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  lfoTarget: LfoTarget;
  lfoWave: LfoWave;
  lfoRate: number;
  lfoDepth: number;
  drive: number;
  reverb: number;
  delay: number;
  tune: number; // semitones
  gate: number; // in steps
  glide: number; // seconds
}

export interface Track {
  id: string;
  name: string;
  short: string;
  kind: TrackKind;
  color: string;
  group: 'drum' | 'synth' | 'sampler';
  mono: boolean;
  baseNote: number;
  params: TrackParams;
}

export interface Step {
  n: number[]; // midi notes (drums: [60] when active)
  a: boolean; // accent
}

export type Pattern = Step[];

export interface Scene {
  name: string;
  patterns: Record<string, Pattern>;
}

export interface MasterParams {
  volume: number;
  drive: number;
  reverbDecay: number;
  reverbMix: number;
  delayDiv: number; // index into DELAY_DIVS
  delayFeedback: number;
  delayMix: number;
  delayTone: number;
}

export interface SamplerSettings {
  name: string;
  start: number;
  end: number;
  mode: 'chromatic' | 'slice';
  slices: number;
  reverse: boolean;
}

export const STEPS = 16;
export const SCENE_NAMES = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
export const DELAY_DIVS: { label: string; beats: number }[] = [
  { label: '1/32', beats: 0.125 },
  { label: '1/16', beats: 0.25 },
  { label: '1/16D', beats: 0.375 },
  { label: '1/8T', beats: 1 / 3 },
  { label: '1/8', beats: 0.5 },
  { label: '1/8D', beats: 0.75 },
  { label: '1/4', beats: 1 },
  { label: '1/4D', beats: 1.5 },
  { label: '1/2', beats: 2 },
];

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const noteName = (m: number) => `${NOTE_NAMES[((m % 12) + 12) % 12]}${Math.floor(m / 12) - 1}`;
export const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
export const cutoffHz = (v: number) => 20 * Math.pow(1000, Math.min(1, Math.max(0, v)));

const base: TrackParams = {
  volume: 0.8,
  pan: 0,
  mute: false,
  solo: false,
  wave: 'sawtooth',
  fm: false,
  fmRatio: 2,
  fmAmount: 2,
  filterType: 'lowpass',
  cutoff: 1,
  resonance: 0.7,
  filterEnv: 0,
  attack: 0.003,
  decay: 0.3,
  sustain: 0.6,
  release: 0.2,
  lfoTarget: 'off',
  lfoWave: 'sine',
  lfoRate: 2,
  lfoDepth: 0.3,
  drive: 0,
  reverb: 0.05,
  delay: 0,
  tune: 0,
  gate: 0.8,
  glide: 0,
};

const p = (o: Partial<TrackParams>): TrackParams => ({ ...base, ...o });

export const createTracks = (): Track[] => [
  { id: 'kick', name: 'Kick 808', short: 'BD', kind: 'kick', color: '#ff5a4e', group: 'drum', mono: true, baseNote: 60,
    params: p({ wave: 'sine', decay: 0.55, volume: 0.9, reverb: 0 }) },
  { id: 'snare', name: 'Snare 808', short: 'SD', kind: 'snare', color: '#ff9f43', group: 'drum', mono: true, baseNote: 60,
    params: p({ wave: 'triangle', decay: 0.22, volume: 0.62, reverb: 0.15 }) },
  { id: 'chh', name: 'Hat Closed', short: 'CH', kind: 'chh', color: '#ffd166', group: 'drum', mono: true, baseNote: 60,
    params: p({ wave: 'square', decay: 0.05, volume: 0.42, pan: 0.15 }) },
  { id: 'ohh', name: 'Hat Open', short: 'OH', kind: 'ohh', color: '#f6e58d', group: 'drum', mono: true, baseNote: 60,
    params: p({ wave: 'square', decay: 0.35, volume: 0.36, pan: -0.15, reverb: 0.1 }) },
  { id: 'clap', name: 'Clap 808', short: 'CP', kind: 'clap', color: '#ff7eb6', group: 'drum', mono: true, baseNote: 60,
    params: p({ wave: 'noise', decay: 0.28, volume: 0.55, reverb: 0.25 }) },
  { id: 'moog', name: 'Moog Bass', short: 'MB', kind: 'moog', color: '#34e7ff', group: 'synth', mono: true, baseNote: 33,
    params: p({ wave: 'sawtooth', cutoff: 0.42, resonance: 3, filterEnv: 0.45, attack: 0.004, decay: 0.25, sustain: 0.55,
      release: 0.12, drive: 0.25, volume: 0.72, gate: 0.7, glide: 0.02 }) },
  { id: 'acid', name: 'Acid 303', short: 'AC', kind: 'acid', color: '#7dff9a', group: 'synth', mono: true, baseNote: 45,
    params: p({ wave: 'sawtooth', cutoff: 0.32, resonance: 16, filterEnv: 0.7, attack: 0.002, decay: 0.18, sustain: 0.2,
      release: 0.06, drive: 0.45, volume: 0.5, delay: 0.25, gate: 0.6, glide: 0.06 }) },
  { id: 'pad', name: 'Poly Pad', short: 'PD', kind: 'pad', color: '#b98cff', group: 'synth', mono: false, baseNote: 57,
    params: p({ wave: 'supersaw', cutoff: 0.55, resonance: 1.2, filterEnv: 0.15, attack: 0.9, decay: 1.2, sustain: 0.8,
      release: 1.8, lfoTarget: 'filter', lfoRate: 0.25, lfoDepth: 0.35, reverb: 0.55, volume: 0.36, gate: 7.5, pan: 0 }) },
  { id: 'ambient', name: 'Ambient Tex', short: 'AM', kind: 'ambient', color: '#5ab0ff', group: 'synth', mono: false, baseNote: 69,
    params: p({ wave: 'triangle', fm: true, fmRatio: 3.5, fmAmount: 1.2, cutoff: 0.7, attack: 0.6, decay: 1.5, sustain: 0.5,
      release: 2.5, lfoTarget: 'pitch', lfoRate: 4.5, lfoDepth: 0.12, reverb: 0.8, delay: 0.4, volume: 0.3, gate: 4, pan: -0.3 }) },
  { id: 'pluck', name: 'Pulse Pluck', short: 'PL', kind: 'pluck', color: '#ffb347', group: 'synth', mono: false, baseNote: 69,
    params: p({ wave: 'square', cutoff: 0.5, resonance: 4, filterEnv: 0.6, attack: 0.001, decay: 0.16, sustain: 0,
      release: 0.15, reverb: 0.3, delay: 0.45, volume: 0.36, gate: 0.5, pan: 0.3 }) },
  { id: 'sampler', name: 'Sampler', short: 'SM', kind: 'sampler', color: '#ff4d8d', group: 'sampler', mono: false, baseNote: 60,
    params: p({ wave: 'sine', attack: 0.002, decay: 0.3, sustain: 1, release: 0.08, volume: 0.6, gate: 2, reverb: 0.2 }) },
];

export const emptyPattern = (): Pattern => Array.from({ length: STEPS }, () => ({ n: [], a: false }));

const drum = (hits: string, acc = ''): Pattern =>
  Array.from({ length: STEPS }, (_, i) => ({ n: hits[i] === 'x' ? [60] : [], a: acc[i] === 'x' }));

const mel = (notes: (number | null | number[])[], acc = ''): Pattern =>
  Array.from({ length: STEPS }, (_, i) => {
    const v = notes[i];
    return { n: v == null ? [] : Array.isArray(v) ? v : [v], a: acc[i] === 'x' };
  });

const _ = null;

export const createScenes = (tracks: Track[]): Scene[] => {
  const blank = (): Record<string, Pattern> => Object.fromEntries(tracks.map((t) => [t.id, emptyPattern()]));
  const scenes: Scene[] = SCENE_NAMES.map((n) => ({ name: `Escena ${n}`, patterns: blank() }));

  // A — groove básico
  Object.assign(scenes[0].patterns, {
    kick: drum('x...x...x...x...'),
    chh: drum('..x...x...x...x.'),
    moog: mel([33, _, _, 33, _, _, 45, _, 33, _, _, 36, _, 38, _, _]),
    pad: mel([[57, 60, 64], _, _, _, _, _, _, _, [55, 60, 64], _, _, _, _, _, _, _]),
  });
  // B — entra el acid y el clap
  Object.assign(scenes[1].patterns, {
    kick: drum('x...x...x...x...'),
    snare: drum('........x.......'),
    clap: drum('....x.......x...'),
    chh: drum('x.x.x.x.x.x.x.xx', '..x...x...x...x.'),
    ohh: drum('..x...x...x...x.'),
    moog: mel([33, _, _, 33, _, _, 45, _, 33, _, _, 36, _, 38, _, _]),
    acid: mel([45, 45, 57, 45, 48, 45, 60, 45, 43, 55, 45, 57, 46, 45, 58, 48], 'x...x..x..x...x.'),
  });
  // C — breakdown atmosférico
  Object.assign(scenes[2].patterns, {
    pad: mel([[57, 60, 64, 67], _, _, _, _, _, _, _, [53, 57, 60, 64], _, _, _, _, _, _, _]),
    ambient: mel([76, _, _, _, _, _, 79, _, _, _, 72, _, _, _, _, _]),
    pluck: mel([69, _, 72, _, 76, _, 72, _, 69, _, 74, _, 77, _, 74, 72]),
    chh: drum('..x...x...x...x.'),
    sampler: mel([60, _, _, _, _, _, _, _, 67, _, _, _, _, _, _, _]),
  });
  // D — todo junto
  Object.assign(scenes[3].patterns, {
    kick: drum('x...x...x...x.x.'),
    clap: drum('....x.......x...'),
    snare: drum('.............x.x'),
    chh: drum('xxx.xxx.xxx.xxxx', 'x...x...x...x...'),
    ohh: drum('..x...x...x...x.'),
    moog: mel([33, _, 45, 33, _, 33, 45, _, 31, _, 43, 31, _, 36, 38, _]),
    acid: mel([45, 57, 45, 48, 45, 60, 45, 57, 43, 55, 45, 57, 46, 58, 45, 48], 'x..x..x...x..x..'),
    pad: mel([[57, 60, 64], _, _, _, _, _, _, _, [55, 59, 62], _, _, _, _, _, _, _]),
    pluck: mel([81, _, _, 76, _, _, 72, _, 79, _, _, 74, _, _, 71, _]),
    sampler: mel([_, _, _, _, 60, _, _, _, _, _, _, _, 62, _, _, _]),
  });
  return scenes;
};

export const DEFAULT_MASTER: MasterParams = {
  volume: 0.8,
  drive: 0.1,
  reverbDecay: 3.2,
  reverbMix: 0.8,
  delayDiv: 5,
  delayFeedback: 0.42,
  delayMix: 0.7,
  delayTone: 0.55,
};

export const DEFAULT_SAMPLER: SamplerSettings = {
  name: 'Demo: Vox Chord (sintético)',
  start: 0,
  end: 1,
  mode: 'chromatic',
  slices: 8,
  reverse: false,
};
