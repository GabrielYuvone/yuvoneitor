import { useEffect, useMemo, useRef, useState } from 'react';
import { engine } from '../audio/engine';
import { audition, ensureAudio } from '../audio/sequencer';
import { noteName, type Track } from '../audio/types';
import { useStore } from '../state/store';
import { Knob } from './Knob';

const W = 1000;
const H = 130;
const CHROMA = [60, 62, 64, 65, 67, 69, 71, 72];

export function SamplerEditor({ track }: { track: Track }) {
  const sampler = useStore((s) => s.sampler);
  const version = useStore((s) => s.sampleVersion);
  const playing = useStore((s) => s.playing);
  const st = useStore.getState();
  const canvas = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ mode: 'start' | 'end'; prev: [number, number] } | null>(null);
  const [rec, setRec] = useState(false);
  const [hitPad, setHitPad] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [dropHover, setDropHover] = useState(false);
  const color = track.color;

  const buf = sampler.reverse ? engine.sampleRev : engine.sample;

  const peaks = useMemo(() => {
    if (!buf) return null;
    const out = new Float32Array(W * 2);
    const chs = Array.from({ length: Math.min(2, buf.numberOfChannels) }, (_, c) => buf.getChannelData(c));
    const block = Math.max(1, Math.floor(buf.length / W));
    for (let x = 0; x < W; x++) {
      let mn = 1;
      let mx = -1;
      const s0 = x * block;
      for (let i = 0; i < block; i += 4) {
        let v = 0;
        for (const ch of chs) v += ch[s0 + i] ?? 0;
        v /= chs.length;
        if (v < mn) mn = v;
        if (v > mx) mx = v;
      }
      out[x * 2] = mn;
      out[x * 2 + 1] = mx;
    }
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buf, version]);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const g = c.getContext('2d')!;
    g.clearRect(0, 0, W, H);
    // grid
    g.strokeStyle = 'rgba(255,255,255,0.05)';
    for (let x = 0; x < W; x += W / 16) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
    }
    const s = Math.min(sampler.start, sampler.end) * W;
    const e = Math.max(sampler.start, sampler.end) * W;
    g.fillStyle = `${color}1c`;
    g.fillRect(s, 0, e - s, H);
    if (peaks) {
      for (let x = 0; x < W; x++) {
        const inside = x >= s && x <= e;
        g.fillStyle = inside ? color : '#4b4f58';
        const y0 = H / 2 - peaks[x * 2 + 1] * (H / 2) * 0.92;
        const y1 = H / 2 - peaks[x * 2] * (H / 2) * 0.92;
        g.fillRect(x, y0, 1, Math.max(1, y1 - y0));
      }
    }
    // slices
    if (sampler.mode === 'slice') {
      g.strokeStyle = 'rgba(255,255,255,0.45)';
      g.setLineDash([3, 3]);
      g.fillStyle = '#fff';
      g.font = '10px monospace';
      for (let i = 0; i < sampler.slices; i++) {
        const x = s + ((e - s) * i) / sampler.slices;
        if (i > 0) {
          g.beginPath();
          g.moveTo(x, 0);
          g.lineTo(x, H);
          g.stroke();
        }
        g.fillText(String(i + 1), x + 3, H - 5);
      }
      g.setLineDash([]);
    }
    // handles
    [s, e].forEach((x, i) => {
      g.fillStyle = color;
      g.shadowColor = color;
      g.shadowBlur = 10;
      g.fillRect(x - 1, 0, 2, H);
      g.shadowBlur = 0;
      g.beginPath();
      if (i === 0) {
        g.moveTo(x, 0);
        g.lineTo(x + 9, 0);
        g.lineTo(x, 10);
      } else {
        g.moveTo(x, 0);
        g.lineTo(x - 9, 0);
        g.lineTo(x, 10);
      }
      g.fill();
    });
  }, [peaks, sampler, color]);

  const posFromEvent = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
  };

  const onDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture(e.pointerId);
    const x = posFromEvent(e);
    const s = Math.min(sampler.start, sampler.end);
    const en = Math.max(sampler.start, sampler.end);
    const prev: [number, number] = [s, en];
    const tol = 0.015;
    if (Math.abs(x - s) < tol) drag.current = { mode: 'start', prev };
    else if (Math.abs(x - en) < tol) drag.current = { mode: 'end', prev };
    else {
      drag.current = { mode: 'end', prev };
      st.setSampler({ start: x, end: x });
    }
  };
  const onMove = (e: React.PointerEvent) => {
    if (!drag.current) return;
    const x = posFromEvent(e);
    st.setSampler(drag.current.mode === 'start' ? { start: x } : { end: x });
  };
  const onUp = () => {
    if (!drag.current) return;
    const { start, end } = useStore.getState().sampler;
    if (Math.abs(end - start) < 0.004) st.setSampler({ start: drag.current.prev[0], end: drag.current.prev[1] });
    else st.setSampler({ start: Math.min(start, end), end: Math.max(start, end) });
    drag.current = null;
  };

  const load = async (file: File | undefined) => {
    if (!file) return;
    setLoading(true);
    try {
      ensureAudio();
      await engine.loadFile(file);
      st.setSampler({ name: file.name, start: 0, end: 1 });
    } catch {
      alert('No se pudo decodificar el archivo de audio.');
    } finally {
      setLoading(false);
    }
  };

  const padNotes = sampler.mode === 'slice' ? Array.from({ length: sampler.slices }, (_, i) => 60 + i) : CHROMA;

  const hit = (note: number, i: number) => {
    audition(track, [note]);
    setHitPad(i);
    setTimeout(() => setHitPad(-1), 100);
    const s = useStore.getState();
    if (rec && s.playing && s.playStep >= 0 && s.playScene === s.selectedScene) {
      const step = s.scenes[s.selectedScene].patterns[track.id][s.playStep];
      if (!step.n.includes(note)) s.toggleNote(track.id, s.playStep, note);
    }
  };

  const dur = engine.sample?.duration ?? 0;
  const regionSecs = dur * Math.abs(sampler.end - sampler.start);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <div className="silk">Sampler · Waveform Editor</div>
        <input ref={fileRef} type="file" accept="audio/*,.wav,.mp3,.ogg,.flac" className="hidden" onChange={(e) => load(e.target.files?.[0])} />
        <button className="hw-btn on" style={{ ['--c' as string]: color }} onClick={() => fileRef.current?.click()}>
          {loading ? 'Cargando…' : '⏏ Load WAV / MP3'}
        </button>
        <span className="lcd-mini truncate rounded px-2 py-0.5 font-mono text-[10px]" style={{ color, maxWidth: 260 }}>
          {sampler.name}
        </span>
        <span className="font-mono text-[10px] text-zinc-500">
          {dur.toFixed(2)}s · región {regionSecs.toFixed(3)}s
        </span>
      </div>

      <div
        className={`panel-inset relative overflow-hidden p-1 ${dropHover ? 'ring-2' : ''}`}
        style={{ ['--tw-ring-color' as string]: color }}
        onDragOver={(e) => {
          e.preventDefault();
          setDropHover(true);
        }}
        onDragLeave={() => setDropHover(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDropHover(false);
          load(e.dataTransfer.files?.[0]);
        }}
      >
        <canvas
          ref={canvas}
          width={W}
          height={H}
          className="block h-[130px] w-full cursor-crosshair touch-none"
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
        />
        {!engine.sample && (
          <div className="absolute inset-0 flex items-center justify-center text-[11px] text-zinc-500">
            Pulsa cualquier botón / Play para generar el sample demo, o arrastra aquí un WAV/MP3
          </div>
        )}
      </div>
      <div className="text-[9px] text-zinc-500">Arrastra sobre la onda para seleccionar la región · arrastra los marcadores para ajustar · suelta un archivo para cargarlo</div>

      <div className="flex flex-wrap items-start gap-3">
        <div className="flex flex-col gap-1.5">
          <div className="flex gap-1">
            <button className={`hw-btn ${sampler.mode === 'chromatic' ? 'on' : ''}`} style={{ ['--c' as string]: color }} onClick={() => st.setSampler({ mode: 'chromatic' })}>
              Chromatic
            </button>
            <button className={`hw-btn ${sampler.mode === 'slice' ? 'on' : ''}`} style={{ ['--c' as string]: color }} onClick={() => st.setSampler({ mode: 'slice' })}>
              Slice
            </button>
          </div>
          <div className="flex gap-1">
            <button className={`hw-btn ${sampler.reverse ? 'on' : ''}`} style={{ ['--c' as string]: color }} onClick={() => st.setSampler({ reverse: !sampler.reverse })}>
              ⇆ Rev
            </button>
            <button
              className="hw-btn"
              title="Recorta el buffer a la región seleccionada"
              onClick={() => {
                engine.trim(sampler.start, sampler.end);
                st.setSampler({ start: 0, end: 1 });
              }}
            >
              ✂ Trim
            </button>
          </div>
          <div className="flex gap-1">
            <button className="hw-btn" onClick={() => engine.normalize()}>Norm</button>
            <button className="hw-btn" onClick={() => st.setSampler({ start: 0, end: 1 })}>All</button>
          </div>
        </div>
        <Knob value={sampler.slices} min={2} max={16} step={1} onChange={(v) => st.setSampler({ slices: v })} label="Slices" color={color} disabled={sampler.mode !== 'slice'} defaultValue={8} format={(v) => String(v)} />
        <Knob value={sampler.start} min={0} max={1} onChange={(v) => st.setSampler({ start: Math.min(v, sampler.end - 0.005) })} label="Start" color={color} defaultValue={0} format={(v) => `${(v * dur).toFixed(2)}s`} />
        <Knob value={sampler.end} min={0} max={1} onChange={(v) => st.setSampler({ end: Math.max(v, sampler.start + 0.005) })} label="End" color={color} defaultValue={1} format={(v) => `${(v * dur).toFixed(2)}s`} />

        <div className="flex flex-1 flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="silk">Pads · {sampler.mode === 'slice' ? 'disparo por slice' : 'cromático'}</span>
            <button
              className={`hw-btn !py-0.5 ${rec ? 'on' : ''}`}
              style={{ ['--c' as string]: '#ff4d5e' }}
              onClick={() => setRec(!rec)}
              title="Con Play activo, los pads graban en el paso actual"
            >
              ● Rec
            </button>
            {rec && !playing && <span className="text-[9px] text-zinc-500">(pulsa Play para grabar en vivo)</span>}
          </div>
          <div className="grid max-w-[520px] gap-1.5" style={{ gridTemplateColumns: `repeat(${Math.min(8, padNotes.length)}, minmax(0, 1fr))` }}>
            {padNotes.map((n, i) => (
              <button
                key={n}
                className={`pad flex flex-col items-center justify-center ${hitPad === i ? 'hit' : ''}`}
                style={{ ['--c' as string]: color, maxWidth: 60 }}
                onPointerDown={() => hit(n, i)}
              >
                <span className="font-mono text-[10px] font-bold text-zinc-300">{sampler.mode === 'slice' ? `S${i + 1}` : noteName(n)}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
