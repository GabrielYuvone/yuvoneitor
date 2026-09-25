import { useEffect } from 'react';
import { engine } from './audio/engine';
import { audition, bindEngine, togglePlay } from './audio/sequencer';
import { ChannelStrip } from './components/ChannelStrip';
import { DrumEditor, PianoRoll } from './components/PianoRoll';
import { ProjectIO } from './components/ProjectIO';
import { SamplerEditor } from './components/SamplerEditor';
import { SceneArranger } from './components/SceneArranger';
import { SequencerGrid } from './components/SequencerGrid';
import { Transport } from './components/Transport';
import { useStore } from './state/store';

const KEYS = 'awsedftgyhujk';

function TrackDetail() {
  const tracks = useStore((s) => s.tracks);
  const selectedId = useStore((s) => s.selectedTrack);
  const track = tracks.find((t) => t.id === selectedId) ?? tracks[0];
  const st = useStore.getState();

  return (
    <div className="panel p-3">
      <div className="screw left-1.5 top-1.5" />
      <div className="screw right-1.5 top-1.5" />
      <div className="mb-3 flex flex-wrap items-center gap-2 px-3">
        <div className="mr-2 flex items-center gap-2">
          <span className="led on" style={{ ['--c' as string]: track.color }} />
          <span className="text-sm font-black uppercase tracking-[0.2em]" style={{ color: track.color, textShadow: `0 0 10px ${track.color}` }}>
            {track.name}
          </span>
          <span className="silk">Channel Strip</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {tracks.map((t) => (
            <button
              key={t.id}
              className={`hw-btn !px-2 !py-1 ${t.id === track.id ? 'on' : ''}`}
              style={{ ['--c' as string]: t.color }}
              onClick={() => st.selectTrack(t.id)}
              title={t.name}
            >
              {t.short}
            </button>
          ))}
        </div>
        <span className="ml-auto hidden font-mono text-[9px] text-zinc-600 lg:inline">Teclado: A W S E D F T G Y H U J K = notas</span>
      </div>
      <ChannelStrip track={track} />
      <div className="mt-3 flex flex-col gap-3">
        {track.kind === 'sampler' && (
          <div className="panel-inset p-3">
            <SamplerEditor track={track} />
          </div>
        )}
        <div className="panel-inset p-3">{track.group === 'drum' ? <DrumEditor track={track} /> : <PianoRoll track={track} />}</div>
      </div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    const unbind = bindEngine();
    engine.onSampleChange = () => useStore.getState().setRuntime({ sampleVersion: useStore.getState().sampleVersion + 1 });
    engine.renderDemoSample().catch(() => {});

    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.repeat || e.metaKey || e.ctrlKey) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
        return;
      }
      const idx = KEYS.indexOf(e.key.toLowerCase());
      if (idx >= 0) {
        const s = useStore.getState();
        const tr = s.tracks.find((t) => t.id === s.selectedTrack);
        if (!tr) return;
        const note = tr.group === 'drum' ? 60 : tr.kind === 'sampler' && s.sampler.mode === 'slice' ? 60 + (idx % s.sampler.slices) : Math.floor(tr.baseNote / 12) * 12 + idx;
        audition(tr, [note]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      unbind();
      window.removeEventListener('keydown', onKey);
    };
  }, []);

  return (
    <div className="min-h-screen px-2 py-4 md:px-4">
      <div className="mx-auto flex max-w-[1680px] gap-0">
        <div className="wood hidden w-5 shrink-0 rounded-l-xl xl:block" />
        <div className="chassis flex min-w-0 flex-1 flex-col gap-3 xl:rounded-none">
          <div className="screw left-2 top-2" />
          <div className="screw right-2 top-2" />
          <div className="screw bottom-2 left-2" />
          <div className="screw bottom-2 right-2" />
          <Transport />
          <SceneArranger />
          <SequencerGrid />
          <TrackDetail />
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-2 pb-1">
            <span className="text-[9px] uppercase tracking-[0.25em] text-zinc-600">
              YUVONEITOR2000 · Web Audio Synthesis Engine · 11 tracks · 8 scenes · 16 steps
            </span>
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              <ProjectIO />
              <button className="hw-btn !px-2 !py-1 !text-[9px]" onClick={() => confirm('¿Restaurar el proyecto demo? Se perderán los cambios.') && useStore.getState().resetAll()}>
                Reset demo
              </button>
            </div>
          </div>
        </div>
        <div className="wood hidden w-5 shrink-0 rounded-r-xl xl:block" />
      </div>
    </div>
  );
}
