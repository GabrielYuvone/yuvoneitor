import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  createScenes,
  createTracks,
  DEFAULT_MASTER,
  DEFAULT_SAMPLER,
  emptyPattern,
  STEPS,
  type MasterParams,
  type Pattern,
  type SamplerSettings,
  type Scene,
  type Track,
  type TrackParams,
} from '../audio/types';

export type PlayMode = 'pattern' | 'song';

interface State {
  tracks: Track[];
  scenes: Scene[];
  song: number[];
  songLoop: boolean;
  selectedScene: number;
  selectedTrack: string;
  bpm: number;
  swing: number;
  mode: PlayMode;
  master: MasterParams;
  sampler: SamplerSettings;
  clipboard: Record<string, Pattern> | null;
  // runtime
  playing: boolean;
  playStep: number;
  playScene: number;
  songPos: number;
  sampleVersion: number;

  setParam: <K extends keyof TrackParams>(id: string, key: K, value: TrackParams[K]) => void;
  toggleStep: (id: string, step: number) => void;
  toggleNote: (id: string, step: number, note: number) => void;
  toggleAccent: (id: string, step: number) => void;
  clearTrack: (id: string) => void;
  randomizeTrack: (id: string) => void;
  shiftTrack: (id: string, dir: number) => void;
  selectScene: (i: number) => void;
  selectTrack: (id: string) => void;
  setBpm: (v: number) => void;
  setSwing: (v: number) => void;
  setMode: (m: PlayMode) => void;
  setMaster: <K extends keyof MasterParams>(key: K, v: MasterParams[K]) => void;
  setSampler: (p: Partial<SamplerSettings>) => void;
  songAdd: (scene: number) => void;
  songRemove: (i: number) => void;
  songMove: (i: number, dir: number) => void;
  songClear: () => void;
  setSongLoop: (v: boolean) => void;
  copyScene: () => void;
  pasteScene: () => void;
  clearScene: () => void;
  setRuntime: (p: Partial<Pick<State, 'playing' | 'playStep' | 'playScene' | 'songPos' | 'sampleVersion'>>) => void;
  resetAll: () => void;
}

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

const updatePattern = (s: State, id: string, fn: (p: Pattern) => Pattern) => {
  const scenes = s.scenes.slice();
  const sc = { ...scenes[s.selectedScene] };
  sc.patterns = { ...sc.patterns, [id]: fn((sc.patterns[id] ?? emptyPattern()).map((st) => ({ n: [...st.n], a: st.a }))) };
  scenes[s.selectedScene] = sc;
  return { scenes };
};

const initial = () => {
  const tracks = createTracks();
  return {
    tracks,
    scenes: createScenes(tracks),
    song: [0, 0, 1, 1, 2, 3, 3, 1],
    songLoop: true,
    selectedScene: 0,
    selectedTrack: 'acid',
    bpm: 124,
    swing: 0.08,
    mode: 'pattern' as PlayMode,
    master: { ...DEFAULT_MASTER },
    sampler: { ...DEFAULT_SAMPLER },
  };
};

const SCALE = [0, 2, 3, 5, 7, 8, 10]; // menor natural

export const useStore = create<State>()(
  persist(
    (set, get) => ({
      ...initial(),
      clipboard: null,
      playing: false,
      playStep: -1,
      playScene: 0,
      songPos: 0,
      sampleVersion: 0,

      setParam: (id, key, value) =>
        set((s) => ({ tracks: s.tracks.map((t) => (t.id === id ? { ...t, params: { ...t.params, [key]: value } } : t)) })),

      toggleStep: (id, step) =>
        set((s) => {
          const tr = s.tracks.find((t) => t.id === id)!;
          return updatePattern(s, id, (p) => {
            if (p[step].n.length) {
              p[step] = { n: [], a: false };
            } else {
              const prev = [...p.slice(0, step)].reverse().find((x) => x.n.length) ?? p.find((x) => x.n.length);
              p[step] = { n: tr.group === 'drum' ? [60] : prev ? [...prev.n] : [tr.baseNote], a: false };
            }
            return p;
          });
        }),

      toggleNote: (id, step, note) =>
        set((s) => {
          const tr = s.tracks.find((t) => t.id === id)!;
          return updatePattern(s, id, (p) => {
            const st = p[step];
            if (st.n.includes(note)) st.n = st.n.filter((x) => x !== note);
            else st.n = tr.mono ? [note] : [...st.n, note].slice(-6);
            if (!st.n.length) st.a = false;
            return p;
          });
        }),

      toggleAccent: (id, step) =>
        set((s) =>
          updatePattern(s, id, (p) => {
            if (p[step].n.length) p[step].a = !p[step].a;
            return p;
          }),
        ),

      clearTrack: (id) => set((s) => updatePattern(s, id, () => emptyPattern())),

      randomizeTrack: (id) =>
        set((s) => {
          const tr = s.tracks.find((t) => t.id === id)!;
          return updatePattern(s, id, () =>
            Array.from({ length: STEPS }, (_, i) => {
              const dens = tr.group === 'drum' ? (tr.kind === 'chh' ? 0.6 : i % 4 === 0 ? 0.55 : 0.18) : tr.kind === 'pad' ? (i % 8 === 0 ? 0.9 : 0) : 0.5;
              if (Math.random() > dens) return { n: [], a: false };
              if (tr.group === 'drum') return { n: [60], a: Math.random() < 0.25 };
              const deg = Math.floor(Math.random() * 7);
              const oct = Math.random() < 0.25 ? 12 : 0;
              const root = tr.baseNote + SCALE[deg] + oct;
              const n = tr.kind === 'pad' ? [root, root + (deg % 2 ? 3 : 4), root + 7] : tr.kind === 'sampler' && get().sampler.mode === 'slice' ? [60 + Math.floor(Math.random() * get().sampler.slices)] : [root];
              return { n, a: Math.random() < 0.25 };
            }),
          );
        }),

      shiftTrack: (id, dir) =>
        set((s) => updatePattern(s, id, (p) => (dir > 0 ? [p[STEPS - 1], ...p.slice(0, STEPS - 1)] : [...p.slice(1), p[0]]))),

      selectScene: (i) => set({ selectedScene: i }),
      selectTrack: (id) => set({ selectedTrack: id }),
      setBpm: (v) => set({ bpm: Math.round(v) }),
      setSwing: (v) => set({ swing: v }),
      setMode: (m) => set({ mode: m }),
      setMaster: (key, v) => set((s) => ({ master: { ...s.master, [key]: v } })),
      setSampler: (p) => set((s) => ({ sampler: { ...s.sampler, ...p } })),

      songAdd: (scene) => set((s) => ({ song: [...s.song, scene].slice(0, 64) })),
      songRemove: (i) => set((s) => ({ song: s.song.filter((_, j) => j !== i) })),
      songMove: (i, dir) =>
        set((s) => {
          const j = i + dir;
          if (j < 0 || j >= s.song.length) return {};
          const song = s.song.slice();
          [song[i], song[j]] = [song[j], song[i]];
          return { song };
        }),
      songClear: () => set({ song: [] }),
      setSongLoop: (v) => set({ songLoop: v }),

      copyScene: () => set((s) => ({ clipboard: clone(s.scenes[s.selectedScene].patterns) })),
      pasteScene: () =>
        set((s) => {
          if (!s.clipboard) return {};
          const scenes = s.scenes.slice();
          scenes[s.selectedScene] = { ...scenes[s.selectedScene], patterns: clone(s.clipboard) };
          return { scenes };
        }),
      clearScene: () =>
        set((s) => {
          const scenes = s.scenes.slice();
          scenes[s.selectedScene] = {
            ...scenes[s.selectedScene],
            patterns: Object.fromEntries(s.tracks.map((t) => [t.id, emptyPattern()])),
          };
          return { scenes };
        }),

      setRuntime: (p) => set(p),
      resetAll: () => set({ ...initial() }),
    }),
    {
      name: 'yuvoneitor-v1',
      partialize: (s) => ({
        tracks: s.tracks,
        scenes: s.scenes,
        song: s.song,
        songLoop: s.songLoop,
        bpm: s.bpm,
        swing: s.swing,
        mode: s.mode,
        master: s.master,
        sampler: { ...s.sampler, name: DEFAULT_SAMPLER.name },
        selectedScene: s.selectedScene,
        selectedTrack: s.selectedTrack,
      }),
    },
  ),
);
