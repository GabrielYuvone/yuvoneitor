import { engine } from './engine';
import { useStore } from '../state/store';
import { STEPS, type Track } from './types';

interface QueueItem {
  time: number;
  step: number;
  scene: number;
  songPos: number;
}

let timer: number | undefined;
let raf = 0;
let nextTime = 0;
let step = 0;
let songPos = 0;
let sceneIdx = 0;
let stopAt: number | null = null;
const queue: QueueItem[] = [];

/** Inicializa el AudioContext (requiere gesto del usuario) y sincroniza el estado */
export function ensureAudio() {
  const fresh = !engine.ctx;
  engine.init();
  if (fresh) {
    const s = useStore.getState();
    engine.sampler = s.sampler;
    engine.setBpm(s.bpm);
    engine.applyMaster(s.master);
    engine.applyTracks(s.tracks);
  }
}

export function audition(track: Track, notes: number[], accent = false) {
  ensureAudio();
  engine.audition(track, notes, accent);
}

function pickScene() {
  const s = useStore.getState();
  if (s.mode === 'song' && s.song.length) {
    if (songPos >= s.song.length) songPos = 0;
    sceneIdx = s.song[songPos];
  } else {
    sceneIdx = s.selectedScene;
  }
}

function tick() {
  const ctx = engine.ctx;
  if (!ctx) return;
  if (stopAt !== null) {
    if (ctx.currentTime >= stopAt) stop();
    return;
  }
  const s = useStore.getState();
  const stepDur = 60 / s.bpm / 4;
  const anySolo = s.tracks.some((t) => t.params.solo);
  while (nextTime < ctx.currentTime + 0.12) {
    if (step === 0) pickScene();
    const scene = s.scenes[sceneIdx];
    const swing = step % 2 === 1 ? s.swing * stepDur * 0.7 : 0;
    const t = nextTime + swing;
    for (const tr of s.tracks) {
      const p = tr.params;
      if (p.mute || (anySolo && !p.solo)) continue;
      const st = scene?.patterns[tr.id]?.[step];
      if (st && st.n.length) engine.trigger(tr, st, t, stepDur);
    }
    queue.push({ time: t, step, scene: sceneIdx, songPos });
    nextTime += stepDur;
    step++;
    if (step >= STEPS) {
      step = 0;
      if (s.mode === 'song' && s.song.length) {
        songPos++;
        if (songPos >= s.song.length) {
          if (s.songLoop) songPos = 0;
          else {
            stopAt = nextTime;
            break;
          }
        }
      }
    }
  }
}

function draw() {
  const ctx = engine.ctx;
  if (!ctx) return;
  let latest: QueueItem | null = null;
  while (queue.length && queue[0].time <= ctx.currentTime) latest = queue.shift()!;
  if (latest) {
    const s = useStore.getState();
    if (s.playStep !== latest.step || s.playScene !== latest.scene || s.songPos !== latest.songPos) {
      s.setRuntime({ playStep: latest.step, playScene: latest.scene, songPos: latest.songPos });
    }
  }
  raf = requestAnimationFrame(draw);
}

export function play() {
  ensureAudio();
  const s = useStore.getState();
  if (s.playing) return;
  step = 0;
  songPos = 0;
  stopAt = null;
  queue.length = 0;
  nextTime = engine.now + 0.08;
  s.setRuntime({ playing: true, songPos: 0 });
  tick();
  timer = window.setInterval(tick, 25);
  raf = requestAnimationFrame(draw);
}

export function stop() {
  clearInterval(timer);
  cancelAnimationFrame(raf);
  queue.length = 0;
  stopAt = null;
  useStore.getState().setRuntime({ playing: false, playStep: -1 });
}

export function togglePlay() {
  if (useStore.getState().playing) stop();
  else play();
}

/** Mantiene el motor sincronizado con el store */
export function bindEngine() {
  return useStore.subscribe((s, prev) => {
    if (s.tracks !== prev.tracks) engine.applyTracks(s.tracks);
    if (s.master !== prev.master) engine.applyMaster(s.master);
    if (s.bpm !== prev.bpm) engine.setBpm(s.bpm);
    if (s.sampler !== prev.sampler) engine.sampler = s.sampler;
  });
}
