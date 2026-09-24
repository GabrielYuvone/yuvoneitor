import { audition } from '../audio/sequencer';
import { noteName, SCENE_NAMES, STEPS, type Track } from '../audio/types';
import { useStore } from '../state/store';
import { Knob } from './Knob';

function Row({ track }: { track: Track }) {
  const pattern = useStore((s) => s.scenes[s.selectedScene].patterns[track.id]);
  const selected = useStore((s) => s.selectedTrack === track.id);
  const playStep = useStore((s) => (s.playScene === s.selectedScene ? s.playStep : -1));
  const playingHit = useStore((s) => {
    if (s.playStep < 0) return false;
    return !!s.scenes[s.playScene]?.patterns[track.id]?.[s.playStep]?.n.length;
  });
  const anySolo = useStore((s) => s.tracks.some((t) => t.params.solo));
  const st = useStore.getState();
  const p = track.params;
  const dimmed = p.mute || (anySolo && !p.solo);

  return (
    <div
      className={`flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors ${selected ? 'bg-white/[0.045] ring-1 ring-white/10' : ''}`}
      style={{ opacity: dimmed ? 0.5 : 1 }}
    >
      <button
        onClick={() => {
          st.selectTrack(track.id);
          audition(track, [track.group === 'drum' ? 60 : track.baseNote + 12 * (track.kind === 'sampler' ? 0 : 0)]);
        }}
        className="flex w-[118px] shrink-0 items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-white/5"
        title="Seleccionar pista y preescuchar"
      >
        <span className={`led ${playingHit && !dimmed ? 'on' : ''}`} style={{ ['--c' as string]: track.color }} />
        <span className="flex flex-col leading-tight">
          <span className="text-[11px] font-bold tracking-wide" style={{ color: selected ? track.color : '#d4d4d8', textShadow: selected ? `0 0 8px ${track.color}` : 'none' }}>
            {track.name}
          </span>
          <span className="font-mono text-[8px] uppercase tracking-widest text-zinc-500">
            {track.group === 'drum' ? 'drum' : track.mono ? 'mono synth' : track.kind === 'sampler' ? 'sampler' : 'poly synth'}
          </span>
        </span>
      </button>
      <button className={`hw-btn !px-1.5 !py-0.5 ${p.mute ? 'on' : ''}`} style={{ ['--c' as string]: '#ff4d5e' }} onClick={() => st.setParam(track.id, 'mute', !p.mute)}>
        M
      </button>
      <button className={`hw-btn !px-1.5 !py-0.5 ${p.solo ? 'on' : ''}`} style={{ ['--c' as string]: '#ffd166' }} onClick={() => st.setParam(track.id, 'solo', !p.solo)}>
        S
      </button>
      <div className="-my-2 shrink-0">
        <Knob value={p.volume} min={0} max={1} size={30} color={track.color} onChange={(v) => st.setParam(track.id, 'volume', v)} defaultValue={0.8} format={(v) => `${Math.round(v * 100)}`} />
      </div>
      <div className="grid min-w-[520px] flex-1 grid-cols-16 gap-[3px]" style={{ gridTemplateColumns: `repeat(${STEPS}, minmax(0, 1fr))` }}>
        {pattern.map((step, i) => {
          const on = step.n.length > 0;
          return (
            <div
              key={i}
              className={`step ${on ? 'on' : ''} ${i % 4 === 0 ? 'beat' : ''} ${playStep === i ? 'play' : ''} ${i % 4 === 3 && i < 15 ? 'mr-1' : ''}`}
              style={{ ['--c' as string]: track.color }}
              onClick={(e) => {
                if (e.altKey || e.shiftKey) st.toggleAccent(track.id, i);
                else st.toggleStep(track.id, i);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                st.toggleAccent(track.id, i);
              }}
              title={on ? `${track.group === 'drum' ? 'Hit' : step.n.map(noteName).join(' ')}${step.a ? ' · ACCENT' : ''} — clic derecho: accent` : `Paso ${i + 1}`}
            >
              {step.a && <span className="acc" />}
              {on && track.group !== 'drum' && (
                <span className="absolute inset-x-0 bottom-0.5 truncate text-center font-mono text-[8px] font-bold text-black/70">
                  {step.n.length > 1 ? `${noteName(step.n[0])}+${step.n.length - 1}` : noteName(step.n[0])}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function SequencerGrid() {
  const tracks = useStore((s) => s.tracks);
  const selectedScene = useStore((s) => s.selectedScene);
  const sceneName = useStore((s) => s.scenes[s.selectedScene].name);

  return (
    <div className="panel p-3">
      <div className="mb-2 flex items-center gap-3">
        <div className="silk silk-line flex-1">
          Step Sequencer · Mixer — editando <span className="text-[var(--amber)]">{sceneName}</span>
        </div>
        <div className="hidden gap-[3px] pr-1 font-mono text-[9px] text-zinc-600 xl:flex">
          clic = paso · clic derecho / shift = accent · {SCENE_NAMES[selectedScene]}
        </div>
      </div>
      <div className="overflow-x-auto">
        <div className="min-w-[860px]">
          <div className="mb-1 flex items-center gap-2 px-1.5">
            <div className="w-[118px] shrink-0 silk !text-[8px]">Track</div>
            <div className="w-[62px] shrink-0 silk !text-[8px]">M / S</div>
            <div className="w-[42px] shrink-0 silk !text-[8px]">Vol</div>
            <div className="grid flex-1 gap-[3px]" style={{ gridTemplateColumns: `repeat(${STEPS}, minmax(0, 1fr))` }}>
              {Array.from({ length: STEPS }, (_, i) => (
                <div key={i} className={`text-center font-mono text-[9px] ${i % 4 === 0 ? 'text-zinc-300' : 'text-zinc-600'} ${i % 4 === 3 && i < 15 ? 'mr-1' : ''}`}>
                  {i + 1}
                </div>
              ))}
            </div>
          </div>
          <div className="flex flex-col gap-[3px]">
            {tracks.map((t, i) => (
              <div key={t.id}>
                {(i === 5 || i === 10) && <div className="my-1.5 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />}
                <Row track={t} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
