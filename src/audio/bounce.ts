import * as lamejsNs from 'lamejs';
import { engine } from './engine';
import { ensureAudio, play, stop } from './sequencer';
import { useStore } from '../state/store';
import { SCENE_NAMES } from './types';

// Resolución defensiva del constructor (CJS <-> ESM según el bundler)
interface Mp3EncoderInstance {
  encodeBuffer(left: Int16Array, right?: Int16Array): Int8Array;
  flush(): Int8Array;
}
type Mp3EncoderCtor = new (channels: number, sampleRate: number, kbps: number) => Mp3EncoderInstance;
const Mp3EncoderImpl = (lamejsNs as unknown as Record<string, unknown>)['Mp3Encoder'] as Mp3EncoderCtor | undefined;

export type BounceSource = 'pattern' | 'song';
export type BounceFormat = 'wav' | 'mp3';

export interface BounceRequest {
  source: BounceSource;
  loops: number;
  tail: number;
  format: BounceFormat;
  mp3Kbps: number;
  onProgress?: (elapsed: number, total: number) => void;
}

export interface BounceResult {
  blob: Blob;
  url: string;
  filename: string;
  duration: number;
  sampleRate: number;
  channels: number;
}

export class BounceCancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'BounceCancelled';
  }
}

export interface BouncePlan {
  bars: number;
  barDur: number;
  bpm: number;
  musical: number;
  total: number;
  label: string;
}

/** Duración y etiqueta del bounce según la fuente elegida */
export function getBouncePlan(source: BounceSource, loops: number, tail: number): BouncePlan {
  const s = useStore.getState();
  const barDur = (60 / s.bpm) * 4;
  const bars = source === 'pattern' ? Math.max(1, Math.min(8, Math.round(loops))) : Math.max(1, s.song.length || 1);
  const musical = bars * barDur;
  const total = musical + Math.max(0, tail);
  const label = source === 'pattern' ? `pattern-${SCENE_NAMES[s.selectedScene]}` : `song-${bars}bars`;
  return { bars, barDur, bpm: s.bpm, musical, total, label };
}

/* ---------------- Codificadores ---------------- */

function mergeChunks(chunks: Float32Array[], need: number): Float32Array {
  const out = new Float32Array(need);
  let off = 0;
  for (const c of chunks) {
    if (off >= need) break;
    const n = Math.min(c.length, need - off);
    out.set(c.subarray(0, n), off);
    off += n;
  }
  return out;
}

function floatTo16(left: Float32Array, right: Float32Array): { l: Int16Array; r: Int16Array } {
  const l = new Int16Array(left.length);
  const r = new Int16Array(right.length);
  for (let i = 0; i < left.length; i++) {
    const a = Math.max(-1, Math.min(1, left[i]));
    const b = Math.max(-1, Math.min(1, right[i]));
    l[i] = a < 0 ? a * 0x8000 : a * 0x7fff;
    r[i] = b < 0 ? b * 0x8000 : b * 0x7fff;
  }
  return { l, r };
}

export function encodeWAV(left: Float32Array, right: Float32Array, sampleRate: number): Blob {
  const n = Math.min(left.length, right.length);
  const buffer = new ArrayBuffer(44 + n * 2 * 2);
  const v = new DataView(buffer);
  const writeStr = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };
  writeStr(0, 'RIFF');
  v.setUint32(4, 36 + n * 4, true);
  writeStr(8, 'WAVE');
  writeStr(12, 'fmt ');
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 2, true);
  v.setUint32(24, sampleRate, true);
  v.setUint32(28, sampleRate * 4, true);
  v.setUint16(32, 4, true);
  v.setUint16(34, 16, true);
  writeStr(36, 'data');
  v.setUint32(40, n * 4, true);
  const { l, r } = floatTo16(left.subarray(0, n), right.subarray(0, n));
  let off = 44;
  for (let i = 0; i < n; i++) {
    v.setInt16(off, l[i], true);
    off += 2;
    v.setInt16(off, r[i], true);
    off += 2;
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

function resampleLinear(input: Float32Array, from: number, to: number): Float32Array {
  if (from === to) return input;
  const outLen = Math.max(1, Math.floor((input.length * to) / from));
  const out = new Float32Array(outLen);
  const ratio = from / to;
  for (let i = 0; i < outLen; i++) {
    const pos = i * ratio;
    const i0 = Math.floor(pos);
    const frac = pos - i0;
    const a = input[i0] ?? 0;
    const b = input[i0 + 1] ?? a;
    out[i] = a + (b - a) * frac;
  }
  return out;
}

const MP3_RATES = [8000, 11025, 12000, 16000, 22050, 24000, 32000, 44100, 48000];

export function encodeMP3(left: Float32Array, right: Float32Array, sampleRate: number, kbps: number): Blob {
  if (!Mp3EncoderImpl) throw new Error('Codificador MP3 no disponible en este build');
  let sr = sampleRate;
  let L = left;
  let R = right;
  if (!MP3_RATES.includes(sr)) {
    // lamejs solo acepta estas tasas: remuestreo lineal a 44.1 kHz
    L = resampleLinear(left, sr, 44100);
    R = resampleLinear(right, sr, 44100);
    sr = 44100;
  }
  const enc = new Mp3EncoderImpl(2, sr, kbps);
  const { l, r } = floatTo16(L, R);
  const parts: Int8Array[] = [];
  const CHUNK = 1152;
  for (let i = 0; i < l.length; i += CHUNK) {
    const out = enc.encodeBuffer(l.subarray(i, i + CHUNK), r.subarray(i, i + CHUNK));
    if (out.length) parts.push(out);
  }
  const end = enc.flush();
  if (end.length) parts.push(end);
  return new Blob(parts as unknown as BlobPart[], { type: 'audio/mpeg' });
}

/* ---------------- Bounce en tiempo real ---------------- */

export function startBounce(req: BounceRequest): { done: Promise<BounceResult>; cancel: () => void } {
  let cancelFn = () => {};
  const done = runBounce(req, (fn) => {
    cancelFn = fn;
  });
  return { done, cancel: () => cancelFn() };
}

async function runBounce(req: BounceRequest, registerCancel: (fn: () => void) => void): Promise<BounceResult> {
  ensureAudio();
  const ctx = engine.ctx;
  if (!ctx) throw new Error('No se pudo iniciar el audio');
  stop();

  const store = useStore.getState();
  const prevMode = store.mode;
  const plan = getBouncePlan(req.source, req.loops, req.tail);
  const sampleRate = engine.sampleRate;
  const needSamples = Math.max(1, Math.floor(plan.total * sampleRate));
  const src = engine.recordSource;
  if (!src) throw new Error('Motor de audio no inicializado');

  const proc = ctx.createScriptProcessor(4096, 2, 2);
  const mute = ctx.createGain();
  mute.gain.value = 0;
  const leftChunks: Float32Array[] = [];
  const rightChunks: Float32Array[] = [];
  proc.onaudioprocess = (e) => {
    const inp = e.inputBuffer;
    leftChunks.push(new Float32Array(inp.getChannelData(0)));
    rightChunks.push(
      new Float32Array(inp.numberOfChannels > 1 ? inp.getChannelData(1) : inp.getChannelData(0)),
    );
  };
  src.connect(proc);
  proc.connect(mute);
  mute.connect(ctx.destination);

  const timers: number[] = [];
  let progressTimer = 0;
  let finished = false;
  const cleanup = () => {
    timers.forEach((t) => window.clearTimeout(t));
    window.clearInterval(progressTimer);
    try {
      src.disconnect(proc);
    } catch {
      /* ya desconectado */
    }
    try {
      proc.disconnect();
    } catch {
      /* ya desconectado */
    }
    try {
      mute.disconnect();
    } catch {
      /* ya desconectado */
    }
    proc.onaudioprocess = null;
  };

  try {
    await new Promise<void>((resolve, reject) => {
      registerCancel(() => {
        if (finished) return;
        finished = true;
        cleanup();
        stop();
        useStore.getState().setMode(prevMode);
        reject(new BounceCancelled());
      });
      useStore.getState().setMode(req.source);
      play();
      const t0 = ctx.currentTime;
      progressTimer = window.setInterval(() => {
        req.onProgress?.(Math.min(ctx.currentTime - t0, plan.total), plan.total);
      }, 100);
      // Fin de la parte musical: se para el secuenciador y suena la cola (reverb/delay)
      timers.push(
        window.setTimeout(() => {
          stop();
        }, plan.musical * 1000),
      );
      timers.push(
        window.setTimeout(() => {
          if (finished) return;
          finished = true;
          req.onProgress?.(plan.total, plan.total);
          resolve();
        }, plan.total * 1000 + 200),
      );
    });

    cleanup();
    useStore.getState().setMode(prevMode);

    const left = mergeChunks(leftChunks, needSamples);
    const right = mergeChunks(rightChunks, needSamples);
    const ext = req.format === 'wav' ? 'wav' : 'mp3';
    const blob = req.format === 'wav' ? encodeWAV(left, right, sampleRate) : encodeMP3(left, right, sampleRate, req.mp3Kbps);
    const filename = `yuvoneitor2000-${plan.label}-${plan.bpm}bpm.${ext}`;
    return {
      blob,
      url: URL.createObjectURL(blob),
      filename,
      duration: plan.total,
      sampleRate,
      channels: 2,
    };
  } catch (err) {
    cleanup();
    stop();
    if (useStore.getState().mode !== prevMode) useStore.getState().setMode(prevMode);
    throw err;
  }
}
