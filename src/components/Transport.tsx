import { useEffect, useRef, useState } from 'react';
import { engine } from '../audio/engine';
import { togglePlay, play, stop } from '../audio/sequencer';
import { DELAY_DIVS, SCENE_NAMES, STEPS } from '../audio/types';
import { useStore } from '../state/store';
import { ExportDialog } from './ExportDialog';
import { Knob } from './Knob';

function Scope() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let raf = 0;
    const data = new Uint8Array(1024);
    const draw = () => {
      const c = ref.current;
      if (c) {
        const g = c.getContext('2d')!;
        const w = c.width;
        const h = c.height;
        g.clearRect(0, 0, w, h);
        g.strokeStyle = 'rgba(52,231,255,0.12)';
        g.lineWidth = 1;
        for (let x = 0; x < w; x += w / 8) {
          g.beginPath();
          g.moveTo(x, 0);
          g.lineTo(x, h);
          g.stroke();
        }
        g.beginPath();
        g.moveTo(0, h / 2);
        g.lineTo(w, h / 2);
        g.stroke();
        g.strokeStyle = '#34e7ff';
        g.shadowColor = '#34e7ff';
        g.shadowBlur = 8;
        g.lineWidth = 1.6;
        g.beginPath();
        if (engine.ctx && engine.analyser) {
          engine.analyser.getByteTimeDomainData(data);
          // trigger en cruce por cero
          let off = 0;
          for (let i = 1; i < 512; i++) if (data[i - 1] < 128 && data[i] >= 128) { off = i; break; }
          for (let i = 0; i < 512; i++) {
            const x = (i / 511) * w;
            const y = h / 2 + ((data[i + off] - 128) / 128) * (h / 2) * 0.9;
            if (i === 0) g.moveTo(x, y);
            else g.lineTo(x, y);
          }
        } else {
          g.moveTo(0, h / 2);
          g.lineTo(w, h / 2);
        }
        g.stroke();
        g.shadowBlur = 0;
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);
  return <canvas ref={ref} width={260} height={64} className="h-16 w-full" />;
}

export function Transport() {
  const playing = useStore((s) => s.playing);
  const bpm = useStore((s) => s.bpm);
  const swing = useStore((s) => s.swing);
  const mode = useStore((s) => s.mode);
  const playStep = useStore((s) => s.playStep);
  const playScene = useStore((s) => s.playScene);
  const selectedScene = useStore((s) => s.selectedScene);
  const songPos = useStore((s) => s.songPos);
  const songLen = useStore((s) => s.song.length);
  const master = useStore((s) => s.master);
  const { setBpm, setSwing, setMode, setMaster } = useStore.getState();
  const [showExport, setShowExport] = useState(false);

  const shownScene = playing ? playScene : selectedScene;

  return (
    <div className="flex flex-wrap items-stretch gap-3">
      {/* Logo */}
      <div className="panel flex min-w-[190px] flex-col justify-between px-4 py-3">
        <div className="screw left-1.5 top-1.5" />
        <div className="screw right-1.5 top-1.5" />
        <div className="mt-2">
          <div className="bg-gradient-to-b from-zinc-100 to-zinc-500 bg-clip-text text-[27px] font-black italic leading-none tracking-[-0.02em] text-transparent">
            YUVONEITOR
          </div>
          <div className="mt-1.5 h-[3px] w-full rounded-full bg-gradient-to-r from-[var(--amber)] via-[var(--amber)]/40 to-transparent shadow-[0_0_8px_#ffb347]" />
          <div className="silk mt-0.5 !text-[8px]">Analog Modeling Groovebox</div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <button
            className={`hw-btn flex-1 !py-2 ${playing ? 'on' : ''}`}
            style={{ ['--c' as string]: '#7dff9a' }}
            onClick={play}
            title="Play (Espacio)"
          >
            ▶ Play
          </button>
          <button className="hw-btn flex-1 !py-2" onClick={stop} title="Stop">
            ■ Stop
          </button>
        </div>
        <button
          className="hw-btn mt-2 w-full !py-1.5"
          style={{ ['--c' as string]: '#ff4d5e' }}
          onClick={() => setShowExport(true)}
          title="Grabar el pattern o la song y exportar a WAV/MP3"
        >
          <span className="led mr-1.5" style={{ ['--c' as string]: '#ff4d5e' }} /> ⬤ Export WAV / MP3
        </button>
      </div>
      {showExport && <ExportDialog onClose={() => setShowExport(false)} />}

      {/* LCD */}
      <div className="panel flex min-w-[330px] flex-1 flex-col gap-2 p-3">
        <div className="lcd flex flex-1 gap-3 p-2.5">
          <div className="flex w-[118px] shrink-0 flex-col justify-between text-[11px] leading-tight">
            <div className="flex justify-between">
              <span className="opacity-60">MODE</span>
              <span>{mode === 'song' ? 'SONG' : 'PATTERN'}</span>
            </div>
            <div className="text-[28px] leading-none tracking-wider">
              {bpm}
              <span className="ml-1 text-[10px] opacity-60">BPM</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-60">SCN</span>
              <span className="text-[var(--amber)] [text-shadow:0_0_6px_#ffb347]">{SCENE_NAMES[shownScene]}</span>
              <span className="opacity-60">BAR</span>
              <span>{mode === 'song' && playing ? `${songPos + 1}/${songLen}` : '--'}</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-60">STATUS</span>
              <span className={playing ? 'text-[var(--green)]' : 'opacity-70'}>{playing ? '► RUN' : '■ STOP'}</span>
            </div>
          </div>
          <div className="flex min-w-0 flex-1 flex-col justify-between">
            <Scope />
            <div className="mt-1 flex gap-[3px]">
              {Array.from({ length: STEPS }, (_, i) => (
                <div
                  key={i}
                  className="h-1.5 flex-1 rounded-[1px]"
                  style={{
                    background: i === playStep ? '#34e7ff' : i % 4 === 0 ? 'rgba(52,231,255,0.25)' : 'rgba(52,231,255,0.1)',
                    boxShadow: i === playStep ? '0 0 6px #34e7ff' : 'none',
                  }}
                />
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="silk">Play mode</span>
          <button className={`hw-btn ${mode === 'pattern' ? 'on' : ''}`} style={{ ['--c' as string]: '#34e7ff' }} onClick={() => setMode('pattern')}>
            Pattern
          </button>
          <button className={`hw-btn ${mode === 'song' ? 'on' : ''}`} style={{ ['--c' as string]: '#ffb347' }} onClick={() => setMode('song')}>
            Song
          </button>
          <span className="ml-auto hidden text-[9px] text-zinc-500 md:inline">ESPACIO = Play/Stop · Doble clic en knob = reset · Shift = fino</span>
        </div>
      </div>

      {/* Tempo */}
      <div className="panel flex flex-col items-center justify-center gap-1 px-3 py-2">
        <div className="silk">Tempo</div>
        <div className="flex gap-1">
          <Knob value={bpm} min={60} max={200} step={1} onChange={setBpm} label="BPM" color="#34e7ff" defaultValue={124} format={(v) => v.toFixed(0)} />
          <Knob value={swing} min={0} max={0.6} onChange={setSwing} label="Swing" color="#34e7ff" defaultValue={0} format={(v) => `${Math.round(v * 100)}%`} />
        </div>
        <button className="hw-btn w-full" onClick={togglePlay}>
          {playing ? 'Pause' : 'Start'}
        </button>
      </div>

      {/* Master FX */}
      <div className="panel flex flex-col gap-1 px-3 py-2">
        <div className="silk silk-line">Master Bus · FX</div>
        <div className="flex flex-wrap gap-0.5">
          <Knob value={master.volume} min={0} max={1} onChange={(v) => setMaster('volume', v)} label="Master" color="#ffb347" defaultValue={0.8} format={(v) => `${Math.round(v * 100)}`} />
          <Knob value={master.drive} min={0} max={1} onChange={(v) => setMaster('drive', v)} label="Saturate" color="#ff4d5e" defaultValue={0.1} format={(v) => `${Math.round(v * 100)}%`} />
          <div className="mx-1 w-px self-stretch bg-white/5" />
          <Knob value={master.reverbDecay} min={0.4} max={9} onChange={(v) => setMaster('reverbDecay', v)} label="Rev Decay" color="#b98cff" log defaultValue={3.2} format={(v) => `${v.toFixed(1)}s`} />
          <Knob value={master.reverbMix} min={0} max={1.5} onChange={(v) => setMaster('reverbMix', v)} label="Rev Mix" color="#b98cff" defaultValue={0.8} format={(v) => `${Math.round(v * 100)}`} />
          <div className="mx-1 w-px self-stretch bg-white/5" />
          <Knob value={master.delayDiv} min={0} max={DELAY_DIVS.length - 1} step={1} onChange={(v) => setMaster('delayDiv', v)} label="Dly Time" color="#7dff9a" defaultValue={5} format={(v) => DELAY_DIVS[Math.round(v)].label} />
          <Knob value={master.delayFeedback} min={0} max={0.92} onChange={(v) => setMaster('delayFeedback', v)} label="Feedback" color="#7dff9a" defaultValue={0.42} format={(v) => `${Math.round(v * 100)}%`} />
          <Knob value={master.delayTone} min={0} max={1} onChange={(v) => setMaster('delayTone', v)} label="Dly Tone" color="#7dff9a" defaultValue={0.55} format={(v) => `${Math.round(v * 100)}`} />
          <Knob value={master.delayMix} min={0} max={1.5} onChange={(v) => setMaster('delayMix', v)} label="Dly Mix" color="#7dff9a" defaultValue={0.7} format={(v) => `${Math.round(v * 100)}`} />
        </div>
      </div>
    </div>
  );
}
