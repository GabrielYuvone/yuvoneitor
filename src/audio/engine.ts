import {
  cutoffHz,
  DELAY_DIVS,
  mtof,
  type MasterParams,
  type SamplerSettings,
  type Step,
  type Track,
  type TrackParams,
  type Wave,
} from './types';

interface TrackNodes {
  input: GainNode;
  shaper: WaveShaperNode;
  makeup: GainNode;
  trem: GainNode;
  vol: GainNode;
  pan: StereoPannerNode;
  revSend: GainNode;
  dlySend: GainNode;
  lfo: OscillatorNode;
  lfoPitch: GainNode;
  lfoFilter: GainNode;
  lfoAmp: GainNode;
  lastDrive: number;
  lastFreq: number;
  mono?: { kill: (t: number) => void; end: number };
  choke?: GainNode;
}

interface Layer {
  wave: Wave;
  mult: number;
  detune: number;
  gain: number;
}

const VOICE_GAIN: Record<string, number> = {
  moog: 0.5,
  acid: 0.45,
  pad: 0.16,
  ambient: 0.22,
  pluck: 0.32,
  sampler: 0.85,
};

const mkBuf = (ch: number, len: number, sr: number) => new AudioBuffer({ numberOfChannels: ch, length: Math.max(1, len), sampleRate: sr });

function driveCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 2048;
  const curve = new Float32Array(n);
  const k = 1 + amount * 45;
  const norm = Math.tanh(k);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    // leve asimetría = armónicos pares "analógicos"
    curve[i] = Math.tanh(k * (x + 0.04 * amount * x * x)) / norm;
  }
  return curve;
}

export class AudioEngine {
  ctx: AudioContext | null = null;
  analyser!: AnalyserNode;
  private masterIn!: GainNode;
  private masterShaper!: WaveShaperNode;
  private masterMakeup!: GainNode;
  private comp!: DynamicsCompressorNode;
  private masterGain!: GainNode;
  private reverb!: ConvolverNode;
  private reverbIn!: GainNode;
  private reverbReturn!: GainNode;
  private delayIn!: GainNode;
  private delayTone!: BiquadFilterNode;
  private dL!: DelayNode;
  private dR!: DelayNode;
  private fbL!: GainNode;
  private fbR!: GainNode;
  private delayReturn!: GainNode;
  private noise!: AudioBuffer;
  private tracks = new Map<string, TrackNodes>();
  private reverbTimer: number | undefined;
  private lastDecay = -1;
  private master: MasterParams | null = null;
  bpm = 120;
  sample: AudioBuffer | null = null;
  sampleRev: AudioBuffer | null = null;
  sampler: SamplerSettings | null = null;
  onSampleChange: (() => void) | null = null;

  get now() {
    return this.ctx ? this.ctx.currentTime : 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;

    // Master chain
    this.masterIn = ctx.createGain();
    this.masterShaper = ctx.createWaveShaper();
    this.masterShaper.oversample = '2x';
    this.masterMakeup = ctx.createGain();
    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -14;
    this.comp.ratio.value = 3.5;
    this.comp.attack.value = 0.006;
    this.comp.release.value = 0.18;
    this.comp.knee.value = 8;
    this.masterGain = ctx.createGain();
    this.analyser = ctx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.masterIn.connect(this.masterShaper).connect(this.masterMakeup).connect(this.comp).connect(this.masterGain);
    this.masterGain.connect(this.analyser).connect(ctx.destination);

    // Reverb bus
    this.reverbIn = ctx.createGain();
    this.reverb = ctx.createConvolver();
    this.reverbReturn = ctx.createGain();
    const revHp = ctx.createBiquadFilter();
    revHp.type = 'highpass';
    revHp.frequency.value = 180;
    this.reverbIn.connect(revHp).connect(this.reverb).connect(this.reverbReturn).connect(this.masterIn);

    // Ping-pong delay bus
    this.delayIn = ctx.createGain();
    this.delayTone = ctx.createBiquadFilter();
    this.delayTone.type = 'lowpass';
    this.dL = ctx.createDelay(4);
    this.dR = ctx.createDelay(4);
    this.fbL = ctx.createGain();
    this.fbR = ctx.createGain();
    this.delayReturn = ctx.createGain();
    const panL = ctx.createStereoPanner();
    panL.pan.value = -0.75;
    const panR = ctx.createStereoPanner();
    panR.pan.value = 0.75;
    this.delayIn.connect(this.delayTone).connect(this.dL);
    this.dL.connect(panL).connect(this.delayReturn);
    this.dL.connect(this.fbL).connect(this.dR);
    this.dR.connect(panR).connect(this.delayReturn);
    this.dR.connect(this.fbR).connect(this.delayTone);
    this.delayReturn.connect(this.masterIn);
    this.delayReturn.connect(this.reverbIn);

    // Noise buffer
    const len = ctx.sampleRate * 2;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    if (this.master) this.applyMaster(this.master);
  }

  /* ---------------- Master ---------------- */

  applyMaster(m: MasterParams) {
    this.master = m;
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.masterGain.gain.setTargetAtTime(m.volume, t, 0.02);
    this.masterShaper.curve = m.drive > 0.01 ? driveCurve(m.drive * 0.6) : null;
    this.masterMakeup.gain.setTargetAtTime(1 / (1 + m.drive * 0.8), t, 0.02);
    this.reverbReturn.gain.setTargetAtTime(m.reverbMix, t, 0.02);
    this.delayReturn.gain.setTargetAtTime(m.delayMix, t, 0.02);
    this.fbL.gain.setTargetAtTime(m.delayFeedback, t, 0.02);
    this.fbR.gain.setTargetAtTime(m.delayFeedback, t, 0.02);
    this.delayTone.frequency.setTargetAtTime(cutoffHz(0.35 + m.delayTone * 0.65), t, 0.02);
    this.updateDelayTime();
    if (Math.abs(m.reverbDecay - this.lastDecay) > 0.01) {
      clearTimeout(this.reverbTimer);
      this.reverbTimer = window.setTimeout(() => this.buildImpulse(m.reverbDecay), this.lastDecay < 0 ? 0 : 160);
    }
  }

  setBpm(bpm: number) {
    this.bpm = bpm;
    this.updateDelayTime();
  }

  private updateDelayTime() {
    if (!this.ctx || !this.master) return;
    const beats = DELAY_DIVS[this.master.delayDiv]?.beats ?? 0.75;
    const secs = Math.min(3.9, (60 / this.bpm) * beats);
    const t = this.ctx.currentTime;
    this.dL.delayTime.setTargetAtTime(secs, t, 0.05);
    this.dR.delayTime.setTargetAtTime(secs, t, 0.05);
  }

  private buildImpulse(decay: number) {
    const ctx = this.ctx!;
    this.lastDecay = decay;
    const rate = ctx.sampleRate;
    const len = Math.floor(rate * Math.max(0.3, decay));
    const buf = ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const ch = buf.getChannelData(c);
      let lp = 0;
      for (let i = 0; i < len; i++) {
        const tt = i / len;
        const n = Math.random() * 2 - 1;
        lp = lp + (n - lp) * (0.9 - tt * 0.7); // se oscurece con el tiempo
        ch[i] = lp * Math.pow(1 - tt, 2.4) * (i < rate * 0.012 ? i / (rate * 0.012) : 1);
      }
    }
    this.reverb.buffer = buf;
  }

  /* ---------------- Tracks ---------------- */

  private ensureTrack(track: Track): TrackNodes {
    let n = this.tracks.get(track.id);
    if (n) return n;
    const ctx = this.ctx!;
    const input = ctx.createGain();
    const shaper = ctx.createWaveShaper();
    shaper.oversample = '2x';
    const makeup = ctx.createGain();
    const trem = ctx.createGain();
    const vol = ctx.createGain();
    const pan = ctx.createStereoPanner();
    const revSend = ctx.createGain();
    const dlySend = ctx.createGain();
    input.connect(shaper).connect(makeup).connect(trem).connect(vol).connect(pan).connect(this.masterIn);
    pan.connect(revSend).connect(this.reverbIn);
    pan.connect(dlySend).connect(this.delayIn);
    const lfo = ctx.createOscillator();
    const lfoPitch = ctx.createGain();
    const lfoFilter = ctx.createGain();
    const lfoAmp = ctx.createGain();
    lfo.connect(lfoPitch);
    lfo.connect(lfoFilter);
    lfo.connect(lfoAmp).connect(trem.gain);
    lfo.start();
    n = { input, shaper, makeup, trem, vol, pan, revSend, dlySend, lfo, lfoPitch, lfoFilter, lfoAmp, lastDrive: -1, lastFreq: 0 };
    this.tracks.set(track.id, n);
    return n;
  }

  applyTracks(tracks: Track[]) {
    if (!this.ctx) return;
    const anySolo = tracks.some((t) => t.params.solo);
    tracks.forEach((t) => this.applyTrack(t, anySolo));
  }

  private applyTrack(track: Track, anySolo: boolean) {
    const ctx = this.ctx!;
    const n = this.ensureTrack(track);
    const p = track.params;
    const t = ctx.currentTime;
    const audible = !p.mute && (!anySolo || p.solo);
    n.vol.gain.setTargetAtTime(audible ? p.volume * p.volume * 1.4 : 0, t, 0.015);
    n.pan.pan.setTargetAtTime(p.pan, t, 0.02);
    n.revSend.gain.setTargetAtTime(p.reverb, t, 0.02);
    n.dlySend.gain.setTargetAtTime(p.delay * 0.8, t, 0.02);
    if (Math.abs(n.lastDrive - p.drive) > 0.004) {
      n.lastDrive = p.drive;
      n.shaper.curve = p.drive > 0.01 ? driveCurve(p.drive) : null;
      n.makeup.gain.setTargetAtTime(1 / (1 + p.drive * 1.6), t, 0.02);
    }
    n.lfo.type = p.lfoWave;
    n.lfo.frequency.setTargetAtTime(p.lfoRate, t, 0.02);
    const tgt = p.lfoTarget;
    n.lfoPitch.gain.setTargetAtTime(tgt === 'pitch' ? p.lfoDepth * 700 : 0, t, 0.02);
    n.lfoFilter.gain.setTargetAtTime(tgt === 'filter' ? p.lfoDepth * 3600 : 0, t, 0.02);
    n.lfoAmp.gain.setTargetAtTime(tgt === 'volume' ? p.lfoDepth * 0.5 : 0, t, 0.02);
    n.trem.gain.setTargetAtTime(tgt === 'volume' ? 1 - p.lfoDepth * 0.5 : 1, t, 0.02);
  }

  /* ---------------- Voice helpers ---------------- */

  private makeFilter(p: TrackParams, n: TrackNodes, t: number, accent: boolean, cleanup: (() => void)[]) {
    const ctx = this.ctx!;
    const f = ctx.createBiquadFilter();
    f.type = p.filterType;
    f.Q.value = p.filterType === 'lowpass' || p.filterType === 'highpass' ? p.resonance * (accent ? 1.15 : 1) : Math.max(0.3, p.resonance);
    const base = cutoffHz(p.cutoff);
    const envAmt = p.filterEnv + (accent ? 0.2 : 0);
    if (envAmt > 0.01) {
      const peak = Math.min(19000, base * Math.pow(2, envAmt * 7));
      const a = Math.max(0.002, p.attack);
      f.frequency.setValueAtTime(base, t);
      f.frequency.exponentialRampToValueAtTime(peak, t + a);
      f.frequency.setTargetAtTime(base + (peak - base) * p.sustain * 0.25, t + a, Math.max(0.01, p.decay) / 3);
    } else {
      f.frequency.setValueAtTime(base, t);
    }
    n.lfoFilter.connect(f.detune);
    cleanup.push(() => n.lfoFilter.disconnect(f.detune));
    return f;
  }

  private ampEnv(g: AudioParam, t: number, dur: number, p: TrackParams, peak: number) {
    const a = Math.max(0.0015, p.attack);
    const d = Math.max(0.005, p.decay);
    const r = Math.max(0.005, p.release);
    g.setValueAtTime(0, t);
    if (dur > a) {
      g.linearRampToValueAtTime(peak, t + a);
      g.setTargetAtTime(peak * p.sustain, t + a, d / 3);
    } else {
      g.linearRampToValueAtTime(peak * (dur / a), t + dur);
    }
    g.setTargetAtTime(0, t + dur, r / 4);
    return t + dur + r * 1.3 + 0.05;
  }

  private addFM(p: TrackParams, freq: number, t: number, end: number, targets: AudioParam[], glideFrom?: number) {
    if (!p.fm || p.fmAmount <= 0) return;
    const ctx = this.ctx!;
    const mod = ctx.createOscillator();
    const mg = ctx.createGain();
    mod.type = 'sine';
    const from = glideFrom ?? freq;
    mod.frequency.setValueAtTime(from * p.fmRatio, t);
    if (glideFrom && p.glide > 0) mod.frequency.exponentialRampToValueAtTime(freq * p.fmRatio, t + p.glide);
    mg.gain.setValueAtTime(freq * p.fmAmount, t);
    mod.connect(mg);
    targets.forEach((tp) => mg.connect(tp));
    mod.start(t);
    mod.stop(end);
    mod.onended = () => mg.disconnect();
  }

  private layersFor(track: Track): Layer[] {
    const w = track.params.wave;
    const saw = (detune: number, gain: number, mult = 1): Layer => ({ wave: 'sawtooth', mult, detune, gain });
    const expand = (l: Layer): Layer[] =>
      l.wave === 'supersaw' ? [-24, -11, 0, 11, 24].map((d) => saw(l.detune + d, l.gain * 0.45, l.mult)) : [l];
    let layers: Layer[];
    switch (track.kind) {
      case 'moog':
        layers = [
          { wave: w, mult: 1, detune: -6, gain: 0.5 },
          { wave: w, mult: 1, detune: 6, gain: 0.5 },
          { wave: w === 'noise' ? 'noise' : 'square', mult: 0.5, detune: 0, gain: 0.45 },
        ];
        break;
      case 'pad':
        layers = [
          { wave: w, mult: 1, detune: -10, gain: 0.5 },
          { wave: w, mult: 1, detune: 10, gain: 0.5 },
          { wave: w, mult: 2, detune: 3, gain: 0.18 },
        ];
        break;
      case 'ambient':
        layers = [
          { wave: w, mult: 1, detune: 0, gain: 0.7 },
          { wave: w, mult: 2, detune: 7, gain: 0.3 },
          { wave: 'sine', mult: 0.5, detune: -4, gain: 0.35 },
        ];
        break;
      default:
        layers = [{ wave: w, mult: 1, detune: 0, gain: 1 }];
    }
    return layers.flatMap(expand);
  }

  /* ---------------- Trigger ---------------- */

  trigger(track: Track, step: Step, t: number, stepDur: number) {
    if (!this.ctx || step.n.length === 0) return;
    const n = this.ensureTrack(track);
    const dur = Math.max(0.02, track.params.gate * stepDur);
    switch (track.kind) {
      case 'kick':
        return this.kick(track.params, n, t, step.a);
      case 'snare':
        return this.snare(track.params, n, t, step.a);
      case 'chh':
      case 'ohh':
        return this.hat(track, n, t, step.a);
      case 'clap':
        return this.clap(track.params, n, t, step.a);
      case 'sampler':
        step.n.forEach((note) => this.playSample(track, n, note, t, dur, step.a));
        return;
      default: {
        const notes = track.mono ? [step.n[step.n.length - 1]] : step.n;
        notes.forEach((note) => this.playSynth(track, n, note, t, dur, step.a));
      }
    }
  }

  /** Disparo inmediato (pads / preescucha) */
  audition(track: Track, notes: number[], accent = false) {
    this.init();
    if (!this.ctx) return;
    const stepDur = 60 / this.bpm / 4;
    this.trigger(track, { n: notes, a: accent }, this.ctx.currentTime + 0.01, stepDur);
  }

  private playSynth(track: Track, n: TrackNodes, note: number, t: number, dur: number, accent: boolean) {
    const ctx = this.ctx!;
    const p = track.params;
    const freq = mtof(note + p.tune);
    const glideFrom = track.mono && p.glide > 0.001 && n.lastFreq > 0 ? n.lastFreq : undefined;
    if (track.mono) {
      n.lastFreq = freq;
      if (n.mono && n.mono.end > t) n.mono.kill(t);
    }
    const cleanup: (() => void)[] = [];
    const mix = ctx.createGain();
    const vca = ctx.createGain();
    const f1 = this.makeFilter(p, n, t, accent, cleanup);
    let last: AudioNode = f1;
    mix.connect(f1);
    if (track.kind === 'moog' && p.filterType === 'lowpass') {
      // 24 dB/oct estilo escalera Moog
      const f2 = this.makeFilter({ ...p, resonance: p.resonance * 0.3 }, n, t, accent, cleanup);
      f1.connect(f2);
      last = f2;
    }
    last.connect(vca).connect(n.input);

    const peak = (VOICE_GAIN[track.kind] ?? 0.4) * (accent ? 1.4 : 1);
    const end = this.ampEnv(vca.gain, t, dur, p, peak);
    const sources: AudioScheduledSourceNode[] = [];
    const fmTargets: AudioParam[] = [];

    this.layersFor(track).forEach((l) => {
      const g = ctx.createGain();
      g.gain.value = l.gain;
      g.connect(mix);
      if (l.wave === 'noise') {
        const src = ctx.createBufferSource();
        src.buffer = this.noise;
        src.loop = true;
        src.connect(g);
        sources.push(src);
        return;
      }
      const osc = ctx.createOscillator();
      osc.type = l.wave === 'supersaw' ? 'sawtooth' : l.wave;
      osc.detune.value = l.detune;
      const target = freq * l.mult;
      osc.frequency.setValueAtTime((glideFrom ?? freq) * l.mult, t);
      if (glideFrom) osc.frequency.exponentialRampToValueAtTime(target, t + p.glide);
      n.lfoPitch.connect(osc.detune);
      cleanup.push(() => n.lfoPitch.disconnect(osc.detune));
      fmTargets.push(osc.frequency);
      osc.connect(g);
      sources.push(osc);
    });
    this.addFM(p, freq, t, end, fmTargets, glideFrom);

    sources.forEach((s) => {
      s.start(t);
      s.stop(end);
    });
    sources[0].onended = () => {
      cleanup.forEach((c) => {
        try {
          c();
        } catch {
          /* ya desconectado */
        }
      });
      vca.disconnect();
    };
    if (track.mono) {
      n.mono = {
        end,
        kill: (kt: number) => {
          vca.gain.cancelScheduledValues(kt);
          vca.gain.setTargetAtTime(0, kt, 0.004);
          sources.forEach((s) => s.stop(kt + 0.03));
        },
      };
    }
  }

  private drumOut(p: TrackParams, n: TrackNodes, t: number, accent: boolean, end: number) {
    const cleanup: (() => void)[] = [];
    const f = this.makeFilter({ ...p, filterEnv: 0, attack: 0.001 }, n, t, false, cleanup);
    const g = this.ctx!.createGain();
    g.gain.value = accent ? 1.35 : 1;
    f.connect(g).connect(n.input);
    window.setTimeout(() => {
      cleanup.forEach((c) => {
        try {
          c();
        } catch {
          /* noop */
        }
      });
      g.disconnect();
    }, (end - this.ctx!.currentTime) * 1000 + 200);
    return { input: f as AudioNode, out: g };
  }

  private kick(p: TrackParams, n: TrackNodes, t: number, accent: boolean) {
    const ctx = this.ctx!;
    const decay = Math.max(0.05, p.decay);
    const end = t + decay * 2.2 + 0.1;
    const { input } = this.drumOut(p, n, t, accent, end);
    const f0 = 48 * Math.pow(2, p.tune / 12);
    const osc = ctx.createOscillator();
    osc.type = p.wave === 'noise' || p.wave === 'supersaw' ? 'sine' : p.wave;
    osc.frequency.setValueAtTime(f0 * 3.4, t);
    osc.frequency.exponentialRampToValueAtTime(f0, t + 0.075);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(1, t + 0.002);
    g.gain.setTargetAtTime(0, t + 0.01, decay * 0.32);
    osc.connect(g).connect(input);
    this.addFM(p, f0, t, end, [osc.frequency]);
    osc.start(t);
    osc.stop(end);
    // click transitorio
    const c = ctx.createBufferSource();
    c.buffer = this.noise;
    const cf = ctx.createBiquadFilter();
    cf.type = 'highpass';
    cf.frequency.value = 2500;
    const cg = ctx.createGain();
    cg.gain.setValueAtTime(0.35, t);
    cg.gain.setTargetAtTime(0, t, 0.004);
    c.connect(cf).connect(cg).connect(input);
    c.start(t);
    c.stop(t + 0.05);
  }

  private snare(p: TrackParams, n: TrackNodes, t: number, accent: boolean) {
    const ctx = this.ctx!;
    const decay = Math.max(0.03, p.decay);
    const end = t + decay * 2 + 0.1;
    const { input } = this.drumOut(p, n, t, accent, end);
    const tr = Math.pow(2, p.tune / 12);
    const osc = ctx.createOscillator();
    osc.type = p.wave === 'noise' || p.wave === 'supersaw' ? 'triangle' : p.wave;
    osc.frequency.setValueAtTime(220 * tr, t);
    osc.frequency.exponentialRampToValueAtTime(170 * tr, t + 0.05);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.7, t);
    og.gain.setTargetAtTime(0, t, decay * 0.2);
    osc.connect(og).connect(input);
    this.addFM(p, 180 * tr, t, end, [osc.frequency]);
    const ns = ctx.createBufferSource();
    ns.buffer = this.noise;
    const nf = ctx.createBiquadFilter();
    nf.type = 'highpass';
    nf.frequency.value = 1400 * tr;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.8, t);
    ng.gain.setTargetAtTime(0, t, decay * 0.3);
    ns.connect(nf).connect(ng).connect(input);
    osc.start(t);
    osc.stop(end);
    ns.start(t, Math.random());
    ns.stop(end);
  }

  private hat(track: Track, n: TrackNodes, t: number, accent: boolean) {
    const ctx = this.ctx!;
    const p = track.params;
    const decay = Math.max(0.01, p.decay);
    const end = t + decay * 2.5 + 0.05;
    const { input } = this.drumOut(p, n, t, accent, end);
    const tr = Math.pow(2, p.tune / 12);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 10000 * tr;
    bp.Q.value = 0.8;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000 * tr;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(0.9, t + 0.001);
    env.gain.setTargetAtTime(0, t + 0.002, decay * 0.35);
    bp.connect(hp).connect(env);
    const sources: AudioScheduledSourceNode[] = [];
    if (p.wave === 'noise') {
      const ns = ctx.createBufferSource();
      ns.buffer = this.noise;
      ns.connect(bp);
      sources.push(ns);
    } else {
      // 6 osciladores metálicos 808
      const oscType: OscillatorType = p.wave === 'supersaw' ? 'sawtooth' : p.wave;
      [2, 3, 4.16, 5.43, 6.79, 8.21].forEach((r) => {
        const o = ctx.createOscillator();
        o.type = oscType;
        o.frequency.value = 40 * r * tr * 1.85;
        const og = ctx.createGain();
        og.gain.value = 0.25;
        o.connect(og).connect(bp);
        sources.push(o);
      });
    }
    if (track.kind === 'ohh') {
      const choke = ctx.createGain();
      env.connect(choke).connect(input);
      n.choke = choke;
    } else {
      env.connect(input);
      const oh = this.tracks.get('ohh');
      if (oh?.choke) oh.choke.gain.setTargetAtTime(0, t, 0.008);
    }
    sources.forEach((s) => {
      s.start(t);
      s.stop(end);
    });
  }

  private clap(p: TrackParams, n: TrackNodes, t: number, accent: boolean) {
    const ctx = this.ctx!;
    const decay = Math.max(0.05, p.decay);
    const end = t + decay * 2 + 0.1;
    const { input } = this.drumOut(p, n, t, accent, end);
    const tr = Math.pow(2, p.tune / 12);
    const ns = ctx.createBufferSource();
    ns.buffer = this.noise;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1150 * tr;
    bp.Q.value = 1.6;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    [0, 0.011, 0.022].forEach((o) => {
      g.gain.setValueAtTime(1, t + o);
      g.gain.setTargetAtTime(0.05, t + o + 0.001, 0.0035);
    });
    g.gain.setValueAtTime(1, t + 0.032);
    g.gain.setTargetAtTime(0, t + 0.033, decay * 0.3);
    ns.connect(bp).connect(g).connect(input);
    ns.start(t, Math.random());
    ns.stop(end);
  }

  private playSample(track: Track, n: TrackNodes, note: number, t: number, dur: number, accent: boolean) {
    const s = this.sampler;
    const buf = s?.reverse ? this.sampleRev : this.sample;
    if (!s || !buf) return;
    const ctx = this.ctx!;
    const p = track.params;
    const L = buf.duration;
    let s0 = Math.min(s.start, s.end) * L;
    let s1 = Math.max(s.start, s.end) * L;
    if (s.reverse) [s0, s1] = [L - s1, L - s0];
    if (s1 - s0 < 0.005) return;
    let rate: number;
    let offset: number;
    let seg: number;
    if (s.mode === 'chromatic') {
      rate = Math.pow(2, (note - 60 + p.tune) / 12);
      offset = s0;
      seg = s1 - s0;
    } else {
      const idx = Math.max(0, Math.min(s.slices - 1, note - 60));
      seg = (s1 - s0) / s.slices;
      offset = s0 + idx * seg;
      rate = Math.pow(2, p.tune / 12);
    }
    const playDur = Math.min(dur, seg / rate);
    const cleanup: (() => void)[] = [];
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = rate;
    n.lfoPitch.connect(src.detune);
    cleanup.push(() => n.lfoPitch.disconnect(src.detune));
    const f = this.makeFilter(p, n, t, accent, cleanup);
    const vca = ctx.createGain();
    src.connect(f).connect(vca).connect(n.input);
    const end = this.ampEnv(vca.gain, t, playDur, p, VOICE_GAIN.sampler * (accent ? 1.35 : 1));
    this.addFM(p, 220 * rate, t, end, [src.detune]);
    src.start(t, offset, seg);
    src.stop(Math.min(end, t + seg / rate + 0.02));
    src.onended = () => {
      cleanup.forEach((c) => {
        try {
          c();
        } catch {
          /* noop */
        }
      });
      vca.disconnect();
    };
  }

  /* ---------------- Sample loading ---------------- */

  private setSample(buf: AudioBuffer) {
    this.sample = buf;
    const rev = mkBuf(buf.numberOfChannels, buf.length, buf.sampleRate);
    for (let c = 0; c < buf.numberOfChannels; c++) {
      const src = buf.getChannelData(c);
      const dst = rev.getChannelData(c);
      for (let i = 0, L = src.length; i < L; i++) dst[i] = src[L - 1 - i];
    }
    this.sampleRev = rev;
    this.onSampleChange?.();
  }

  /** Recorta el buffer a la región [start,end] (normalizado 0..1) */
  trim(start: number, end: number) {
    if (!this.sample) return;
    const b = this.sample;
    const s0 = Math.floor(Math.min(start, end) * b.length);
    const s1 = Math.floor(Math.max(start, end) * b.length);
    if (s1 - s0 < 64) return;
    const out = mkBuf(b.numberOfChannels, s1 - s0, b.sampleRate);
    for (let c = 0; c < b.numberOfChannels; c++) out.getChannelData(c).set(b.getChannelData(c).subarray(s0, s1));
    this.setSample(out);
  }

  /** Normaliza el pico a -0.5 dBFS */
  normalize() {
    if (!this.sample) return;
    const b = this.sample;
    let peak = 0;
    for (let c = 0; c < b.numberOfChannels; c++) {
      const d = b.getChannelData(c);
      for (let i = 0; i < d.length; i++) peak = Math.max(peak, Math.abs(d[i]));
    }
    if (peak < 1e-4) return;
    const g = 0.944 / peak;
    const out = mkBuf(b.numberOfChannels, b.length, b.sampleRate);
    for (let c = 0; c < b.numberOfChannels; c++) {
      const src = b.getChannelData(c);
      const dst = out.getChannelData(c);
      for (let i = 0; i < src.length; i++) dst[i] = src[i] * g;
    }
    this.setSample(out);
  }

  async loadFile(file: File) {
    this.init();
    const data = await file.arrayBuffer();
    const buf = await this.ctx!.decodeAudioData(data);
    this.setSample(buf);
  }

  async renderDemoSample() {
    const sr = 44100;
    const len = 1.8;
    const off = new OfflineAudioContext(2, Math.floor(sr * len), sr);
    const out = off.createGain();
    out.gain.setValueAtTime(0, 0);
    out.gain.linearRampToValueAtTime(0.9, 0.06);
    out.gain.setValueAtTime(0.9, len - 0.5);
    out.gain.linearRampToValueAtTime(0, len);
    out.connect(off.destination);
    const vib = off.createOscillator();
    vib.frequency.value = 5.2;
    const vibG = off.createGain();
    vibG.gain.value = 9;
    vib.connect(vibG);
    vib.start();
    // formantes: "aah" → "ooh"
    const formants: [number, number, number, number][] = [
      [800, 450, 8, 1],
      [1150, 800, 9, 0.5],
      [2900, 2830, 12, 0.25],
    ];
    const bus = off.createGain();
    formants.forEach(([a, b, q, g]) => {
      const f = off.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = q;
      f.frequency.setValueAtTime(a, 0);
      f.frequency.linearRampToValueAtTime(b, len);
      const fg = off.createGain();
      fg.gain.value = g * 3;
      bus.connect(f).connect(fg).connect(out);
    });
    [60, 64, 67, 71].forEach((m, i) => {
      const o = off.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = mtof(m);
      o.detune.value = (i - 1.5) * 4;
      vibG.connect(o.detune);
      const g = off.createGain();
      g.gain.value = 0.22;
      o.connect(g).connect(bus);
      o.start();
    });
    const rendered = await off.startRendering();
    if (!this.sample) this.setSample(rendered);
  }
}

export const engine = new AudioEngine();
