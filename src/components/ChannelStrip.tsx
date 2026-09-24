import type { ReactNode } from 'react';
import type { FilterType, LfoTarget, LfoWave, Track, TrackParams, Wave } from '../audio/types';
import { cutoffHz } from '../audio/types';
import { useStore } from '../state/store';
import { Knob } from './Knob';

const C = { mix: '#ffb347', osc: '#34e7ff', flt: '#ff4d5e', env: '#7dff9a', lfo: '#b98cff', fx: '#ff4d8d' };

const WAVES: { id: Wave; label: string; icon: string }[] = [
  { id: 'sawtooth', label: 'Saw', icon: 'M2 14 L10 4 L10 14 L18 4 L18 14' },
  { id: 'triangle', label: 'Tri', icon: 'M2 14 L6 4 L10 14 L14 4 L18 14' },
  { id: 'sine', label: 'Sine', icon: 'M2 9 Q6 -1 10 9 T18 9' },
  { id: 'square', label: 'Sqr', icon: 'M2 14 L2 4 L10 4 L10 14 L18 14 L18 4' },
  { id: 'noise', label: 'Noise', icon: 'M2 9 L3 5 L4 12 L5 3 L6 13 L7 7 L8 11 L9 4 L10 14 L11 6 L12 10 L13 3 L14 12 L15 6 L16 13 L17 5 L18 9' },
  { id: 'supersaw', label: 'Super', icon: 'M2 14 L10 4 L10 14 L18 4 L18 14 M2 12 L10 6 M10 12 L18 6' },
];
const FILTERS: { id: FilterType; label: string }[] = [
  { id: 'lowpass', label: 'LP' },
  { id: 'highpass', label: 'HP' },
  { id: 'bandpass', label: 'BP' },
  { id: 'notch', label: 'Notch' },
];
const LFO_T: { id: LfoTarget; label: string }[] = [
  { id: 'off', label: 'Off' },
  { id: 'pitch', label: 'Pitch' },
  { id: 'filter', label: 'Filter' },
  { id: 'volume', label: 'Vol' },
];
const LFO_W: { id: LfoWave; label: string }[] = [
  { id: 'sine', label: '∿' },
  { id: 'triangle', label: '⋀' },
  { id: 'square', label: '⊓' },
  { id: 'sawtooth', label: '⩘' },
];

function Section({ title, color, children, className = '' }: { title: string; color: string; children: ReactNode; className?: string }) {
  return (
    <div className={`panel-inset relative flex flex-col gap-2 px-2.5 pb-2 pt-2 ${className}`}>
      <div className="silk silk-line" style={{ color }}>
        <span className="h-1.5 w-1.5 rounded-full" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
        {title}
      </div>
      <div className="flex flex-wrap items-start gap-1">{children}</div>
    </div>
  );
}

function AdsrGraph({ p, color }: { p: TrackParams; color: string }) {
  const w = 150;
  const h = 56;
  const total = p.attack + p.decay + 0.35 + p.release;
  const sx = (w - 8) / Math.max(total, 0.5);
  const a = 4 + p.attack * sx;
  const d = a + p.decay * sx;
  const s = d + 0.35 * sx;
  const r = s + p.release * sx;
  const sy = 4 + (1 - p.sustain) * (h - 8);
  const path = `M4 ${h - 4} L${a} 4 L${d} ${sy} L${s} ${sy} L${Math.min(r, w - 2)} ${h - 4}`;
  return (
    <svg width={w} height={h} className="lcd-mini rounded" style={{ filter: `drop-shadow(0 0 4px ${color}66)` }}>
      <path d={`${path} Z`} fill={`${color}22`} />
      <path d={path} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
      {[a, d, s].map((x, i) => (
        <circle key={i} cx={x} cy={i === 0 ? 4 : sy} r={2.2} fill={color} />
      ))}
    </svg>
  );
}

export function ChannelStrip({ track }: { track: Track }) {
  const st = useStore.getState();
  const p = track.params;
  const set = <K extends keyof TrackParams>(k: K) => (v: TrackParams[K]) => st.setParam(track.id, k, v);
  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const sec = (v: number) => (v < 1 ? `${Math.round(v * 1000)}ms` : `${v.toFixed(2)}s`);
  const isDrum = track.group === 'drum';

  return (
    <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-[auto_auto_auto_auto_auto_auto]">
      <Section title="Mix" color={C.mix}>
        <Knob value={p.volume} min={0} max={1} onChange={set('volume')} label="Volume" color={C.mix} defaultValue={0.8} format={pct} />
        <Knob value={p.pan} min={-1} max={1} bipolar onChange={set('pan')} label="Pan" color={C.mix} defaultValue={0} format={(v) => (Math.abs(v) < 0.02 ? 'C' : v < 0 ? `L${Math.round(-v * 100)}` : `R${Math.round(v * 100)}`)} />
        <Knob value={p.tune} min={-24} max={24} step={1} bipolar onChange={set('tune')} label="Tune" color={C.mix} defaultValue={0} format={(v) => `${v > 0 ? '+' : ''}${v}st`} />
        <div className="flex flex-col gap-1.5 pt-1">
          <button className={`hw-btn ${p.mute ? 'on' : ''}`} style={{ ['--c' as string]: '#ff4d5e' }} onClick={() => set('mute')(!p.mute)}>
            Mute
          </button>
          <button className={`hw-btn ${p.solo ? 'on' : ''}`} style={{ ['--c' as string]: '#ffd166' }} onClick={() => set('solo')(!p.solo)}>
            Solo
          </button>
        </div>
        {!isDrum && (
          <>
            <Knob value={p.gate} min={0.1} max={8} log onChange={set('gate')} label="Gate" color={C.mix} defaultValue={0.8} format={(v) => `${v.toFixed(2)}st`} />
            <Knob value={p.glide} min={0} max={0.5} onChange={set('glide')} label="Glide" color={C.mix} defaultValue={0} format={sec} disabled={!track.mono} />
          </>
        )}
      </Section>

      <Section title={isDrum ? 'Voice / Oscillator' : 'Oscillator · FM'} color={C.osc}>
        <div className="grid grid-cols-3 gap-1">
          {WAVES.map((w) => (
            <button
              key={w.id}
              className={`hw-btn flex flex-col items-center gap-0.5 !px-1.5 !py-1 ${p.wave === w.id ? 'on' : ''}`}
              style={{ ['--c' as string]: C.osc }}
              onClick={() => set('wave')(w.id)}
              title={w.label}
            >
              <svg width="20" height="18" viewBox="0 0 20 18">
                <path d={w.icon} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
              </svg>
              <span className="text-[8px]">{w.label}</span>
            </button>
          ))}
        </div>
        <div className="flex flex-col items-center gap-1 pt-1">
          <button className={`hw-btn !px-2 ${p.fm ? 'on' : ''}`} style={{ ['--c' as string]: C.osc }} onClick={() => set('fm')(!p.fm)}>
            FM
          </button>
          <span className={`led ${p.fm ? 'on' : ''}`} style={{ ['--c' as string]: C.osc }} />
        </div>
        <Knob value={p.fmRatio} min={0.25} max={12} log onChange={set('fmRatio')} label="Ratio" color={C.osc} defaultValue={2} disabled={!p.fm} format={(v) => `×${v.toFixed(2)}`} />
        <Knob value={p.fmAmount} min={0} max={12} onChange={set('fmAmount')} label="FM Amt" color={C.osc} defaultValue={2} disabled={!p.fm} format={(v) => v.toFixed(2)} />
      </Section>

      <Section title="Filter" color={C.flt}>
        <div className="grid grid-cols-2 gap-1">
          {FILTERS.map((f) => (
            <button key={f.id} className={`hw-btn !px-2 ${p.filterType === f.id ? 'on' : ''}`} style={{ ['--c' as string]: C.flt }} onClick={() => set('filterType')(f.id)}>
              {f.label}
            </button>
          ))}
        </div>
        <Knob value={p.cutoff} min={0} max={1} onChange={set('cutoff')} label="Cutoff" color={C.flt} defaultValue={1} format={(v) => { const hz = cutoffHz(v); return hz >= 1000 ? `${(hz / 1000).toFixed(1)}k` : `${Math.round(hz)}`; }} />
        <Knob value={p.resonance} min={0.1} max={25} log onChange={set('resonance')} label="Reso" color={C.flt} defaultValue={0.7} format={(v) => v.toFixed(1)} />
        <Knob value={p.filterEnv} min={0} max={1} onChange={set('filterEnv')} label="Env Amt" color={C.flt} defaultValue={0} format={pct} />
      </Section>

      <Section title={isDrum ? 'Envelope (Decay)' : 'Envelope · ADSR'} color={C.env}>
        <div className="flex flex-col gap-1">
          <div className="flex">
            <Knob value={p.attack} min={0.001} max={4} log onChange={set('attack')} label="A" color={C.env} size={44} defaultValue={0.003} format={sec} disabled={isDrum} />
            <Knob value={p.decay} min={0.01} max={4} log onChange={set('decay')} label="D" color={C.env} size={44} defaultValue={0.3} format={sec} />
            <Knob value={p.sustain} min={0} max={1} onChange={set('sustain')} label="S" color={C.env} size={44} defaultValue={0.6} format={pct} disabled={isDrum} />
            <Knob value={p.release} min={0.005} max={6} log onChange={set('release')} label="R" color={C.env} size={44} defaultValue={0.2} format={sec} disabled={isDrum} />
          </div>
          {!isDrum && <AdsrGraph p={p} color={C.env} />}
        </div>
      </Section>

      <Section title="LFO" color={C.lfo}>
        <div className="flex flex-col gap-1">
          <div className="grid grid-cols-2 gap-1">
            {LFO_T.map((l) => (
              <button key={l.id} className={`hw-btn !px-1.5 !text-[9px] ${p.lfoTarget === l.id ? 'on' : ''}`} style={{ ['--c' as string]: C.lfo }} onClick={() => set('lfoTarget')(l.id)}>
                {l.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-4 gap-1">
            {LFO_W.map((l) => (
              <button key={l.id} className={`hw-btn !px-1 !py-0.5 !text-[12px] ${p.lfoWave === l.id ? 'on' : ''}`} style={{ ['--c' as string]: C.lfo }} onClick={() => set('lfoWave')(l.id)}>
                {l.label}
              </button>
            ))}
          </div>
        </div>
        <Knob value={p.lfoRate} min={0.05} max={20} log onChange={set('lfoRate')} label="Rate" color={C.lfo} defaultValue={2} disabled={p.lfoTarget === 'off'} format={(v) => `${v.toFixed(2)}Hz`} />
        <Knob value={p.lfoDepth} min={0} max={1} onChange={set('lfoDepth')} label="Depth" color={C.lfo} defaultValue={0.3} disabled={p.lfoTarget === 'off'} format={pct} />
      </Section>

      <Section title="FX Sends" color={C.fx}>
        <Knob value={p.drive} min={0} max={1} onChange={set('drive')} label="Drive" color={C.fx} defaultValue={0} format={pct} />
        <Knob value={p.reverb} min={0} max={1} onChange={set('reverb')} label="Reverb" color={C.fx} defaultValue={0} format={pct} />
        <Knob value={p.delay} min={0} max={1} onChange={set('delay')} label="Delay" color={C.fx} defaultValue={0} format={pct} />
      </Section>
    </div>
  );
}
