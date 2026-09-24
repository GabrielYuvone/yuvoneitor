import { useEffect, useState } from 'react';
import { audition } from '../audio/sequencer';
import { noteName, STEPS, type Track } from '../audio/types';
import { useStore } from '../state/store';

const BLACK = [1, 3, 6, 8, 10];

function Tools({ track, extra }: { track: Track; extra?: React.ReactNode }) {
  const st = useStore.getState();
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {extra}
      <button className="hw-btn" onClick={() => st.shiftTrack(track.id, -1)} title="Desplazar a la izquierda">◀ Shift</button>
      <button className="hw-btn" onClick={() => st.shiftTrack(track.id, 1)} title="Desplazar a la derecha">Shift ▶</button>
      <button className="hw-btn" style={{ ['--c' as string]: track.color }} onClick={() => st.randomizeTrack(track.id)}>🎲 Random</button>
      <button className="hw-btn" onClick={() => st.clearTrack(track.id)}>Clear</button>
    </div>
  );
}

function AccentRow({ track }: { track: Track }) {
  const pattern = useStore((s) => s.scenes[s.selectedScene].patterns[track.id]);
  const st = useStore.getState();
  return (
    <div className="grid gap-[2px]" style={{ gridTemplateColumns: `repeat(${STEPS}, minmax(0, 1fr))` }}>
      {pattern.map((s, i) => (
        <button
          key={i}
          disabled={!s.n.length}
          onClick={() => st.toggleAccent(track.id, i)}
          className="flex h-5 items-center justify-center rounded-sm bg-black/40 disabled:opacity-25"
          title="Accent"
        >
          <span className={`led ${s.a ? 'on' : ''}`} style={{ ['--c' as string]: '#fff' }} />
        </button>
      ))}
    </div>
  );
}

export function DrumEditor({ track }: { track: Track }) {
  const [hit, setHit] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="silk">Accent / Velocity · {track.name}</div>
        <Tools track={track} />
      </div>
      <div className="flex items-center gap-3">
        <button
          className={`pad w-20 shrink-0 ${hit ? 'hit' : ''}`}
          style={{ ['--c' as string]: track.color }}
          onPointerDown={() => {
            audition(track, [60], true);
            setHit(true);
            setTimeout(() => setHit(false), 90);
          }}
        >
          <span className="text-[10px] font-bold text-zinc-300">{track.short}</span>
        </button>
        <div className="flex-1">
          <AccentRow track={track} />
          <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
            Voz 808 sintetizada en tiempo real. La forma de onda cambia el cuerpo tonal (kick/snare) o el metal de los hi-hats (Noise = hats de ruido).
            El knob <b className="text-zinc-400">D</b> controla el decaimiento, <b className="text-zinc-400">Tune</b> la afinación, y el filtro/LFO/FX se aplican por golpe.
            El Hat Cerrado corta (choke) al Hat Abierto.
          </p>
        </div>
      </div>
    </div>
  );
}

export function PianoRoll({ track }: { track: Track }) {
  const pattern = useStore((s) => s.scenes[s.selectedScene].patterns[track.id]);
  const playStep = useStore((s) => (s.playScene === s.selectedScene ? s.playStep : -1));
  const sampler = useStore((s) => s.sampler);
  const st = useStore.getState();
  const sliceMode = track.kind === 'sampler' && sampler.mode === 'slice';
  const defaultBase = Math.floor((track.baseNote - 6) / 12) * 12;
  const [base, setBase] = useState(defaultBase);
  useEffect(() => setBase(defaultBase), [track.id, defaultBase]);

  const rows = sliceMode
    ? Array.from({ length: sampler.slices }, (_, i) => 60 + sampler.slices - 1 - i)
    : Array.from({ length: 25 }, (_, i) => base + 24 - i);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="silk">
          {sliceMode ? 'Slice Sequencer' : 'Piano Roll'} · {track.name} {track.mono ? '(mono)' : '(poly)'}
        </div>
        <Tools
          track={track}
          extra={
            !sliceMode && (
              <>
                <button className="hw-btn" onClick={() => setBase((b) => Math.max(0, b - 12))}>Oct ▼</button>
                <span className="lcd-mini rounded px-2 py-0.5 font-mono text-[10px] text-[var(--cyan)]">{noteName(base)}–{noteName(base + 24)}</span>
                <button className="hw-btn" onClick={() => setBase((b) => Math.min(96, b + 12))}>Oct ▲</button>
              </>
            )
          }
        />
      </div>
      <div className="panel-inset overflow-x-auto p-1.5">
        <div className="min-w-[640px]">
          {rows.map((note) => {
            const pc = ((note % 12) + 12) % 12;
            const black = !sliceMode && BLACK.includes(pc);
            return (
              <div key={note} className="flex">
                <button
                  className={`mr-1 flex h-[14px] w-14 shrink-0 items-center justify-end rounded-r-sm pr-1 font-mono text-[8px] ${
                    black ? 'bg-zinc-900 text-zinc-500' : 'bg-zinc-300 text-zinc-700'
                  } ${pc === 0 && !sliceMode ? 'font-bold' : ''} active:brightness-150`}
                  style={sliceMode ? { background: '#2a1620', color: track.color } : undefined}
                  onPointerDown={() => audition(track, [note])}
                >
                  {sliceMode ? `SLICE ${note - 59}` : pc === 0 || !black ? noteName(note) : ''}
                </button>
                <div className="grid flex-1" style={{ gridTemplateColumns: `repeat(${STEPS}, minmax(0, 1fr))` }}>
                  {pattern.map((s, i) => {
                    const on = s.n.includes(note);
                    const bg = playStep === i ? 'rgba(255,255,255,0.09)' : black ? '#141518' : i % 4 === 0 ? '#23252a' : '#1b1c20';
                    return (
                      <div
                        key={i}
                        className={`roll-cell ${on ? 'on' : ''}`}
                        style={{ ['--c' as string]: track.color, background: bg, opacity: on && s.a ? 1 : on ? 0.85 : 1 }}
                        onPointerDown={() => {
                          if (!on) audition(track, [note], s.a);
                          st.toggleNote(track.id, i, note);
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
          <div className="mt-1 flex">
            <div className="mr-1 flex w-14 shrink-0 items-center justify-end pr-1 silk !text-[7px]">Accent</div>
            <div className="flex-1">
              <AccentRow track={track} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
