import { SCENE_NAMES, STEPS } from '../audio/types';
import { useStore } from '../state/store';

export const SCENE_COLORS = ['#ffb347', '#34e7ff', '#b98cff', '#7dff9a', '#ff4d8d', '#ff5a4e', '#5ab0ff', '#f6e58d'];

export function SceneArranger() {
  const scenes = useStore((s) => s.scenes);
  const selected = useStore((s) => s.selectedScene);
  const song = useStore((s) => s.song);
  const songLoop = useStore((s) => s.songLoop);
  const playing = useStore((s) => s.playing);
  const playScene = useStore((s) => s.playScene);
  const songPos = useStore((s) => s.songPos);
  const playStep = useStore((s) => s.playStep);
  const mode = useStore((s) => s.mode);
  const bpm = useStore((s) => s.bpm);
  const clipboard = useStore((s) => s.clipboard);
  const tracks = useStore((s) => s.tracks);
  const st = useStore.getState();

  const barSecs = (60 / bpm) * 4;
  const total = song.length * barSecs;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  return (
    <div className="panel p-3">
      <div className="flex flex-wrap items-start gap-4">
        {/* Escenas */}
        <div className="flex flex-col gap-2">
          <div className="silk silk-line">Scenes · Patrones</div>
          <div className="flex flex-wrap gap-1.5">
            {scenes.map((sc, i) => {
              const hasContent = Object.values(sc.patterns).some((p) => p.some((x) => x.n.length));
              const isPlaying = playing && playScene === i;
              return (
                <button
                  key={i}
                  onClick={() => st.selectScene(i)}
                  className={`hw-btn flex !h-[52px] w-[52px] flex-col items-center justify-center gap-1 !p-0 ${selected === i ? 'on' : ''}`}
                  style={{ ['--c' as string]: SCENE_COLORS[i] }}
                  title={`${sc.name}${hasContent ? '' : ' (vacía)'}`}
                >
                  <span className={`led ${isPlaying ? 'on' : ''}`} style={{ ['--c' as string]: '#7dff9a' }} />
                  <span className="text-lg leading-none">{SCENE_NAMES[i]}</span>
                  <span className="h-[3px] w-5 rounded-full" style={{ background: hasContent ? SCENE_COLORS[i] : '#2a2c31', opacity: selected === i ? 0.6 : 1 }} />
                </button>
              );
            })}
          </div>
          <div className="flex gap-1.5">
            <button className="hw-btn" onClick={st.copyScene}>Copy</button>
            <button className="hw-btn" onClick={st.pasteScene} disabled={!clipboard}>Paste</button>
            <button className="hw-btn" onClick={() => confirm(`¿Borrar ${scenes[selected].name}?`) && st.clearScene()}>Clear</button>
            <button className="hw-btn" style={{ ['--c' as string]: SCENE_COLORS[selected] }} onClick={() => st.songAdd(selected)}>
              + Chain {SCENE_NAMES[selected]}
            </button>
          </div>
        </div>

        {/* Mini vista de la escena */}
        <div className="panel-inset hidden flex-col gap-[2px] p-2 lg:flex">
          <div className="silk mb-1 !text-[8px]">Preview {SCENE_NAMES[selected]}</div>
          {tracks.map((t) => (
            <div key={t.id} className="flex gap-[2px]">
              {Array.from({ length: STEPS }, (_, i) => {
                const on = scenes[selected].patterns[t.id]?.[i]?.n.length;
                return <div key={i} className="h-[4px] w-[6px] rounded-[1px]" style={{ background: on ? t.color : i % 4 === 0 ? '#26282d' : '#1b1c20' }} />;
              })}
            </div>
          ))}
        </div>

        {/* Timeline */}
        <div className="flex min-w-[300px] flex-1 flex-col gap-2">
          <div className="silk silk-line">
            Song Arranger · Timeline
            <span className="font-mono normal-case tracking-normal text-zinc-500">
              {song.length} bars · {fmt(total)}
            </span>
          </div>
          <div className="panel-inset flex min-h-[64px] items-center gap-1.5 overflow-x-auto p-2">
            {song.length === 0 && <div className="px-2 text-[11px] text-zinc-500">Timeline vacío — añade escenas con los botones de abajo para construir tu canción.</div>}
            {song.map((sc, i) => {
              const active = playing && mode === 'song' && songPos === i;
              return (
                <div
                  key={i}
                  className={`song-block group flex shrink-0 flex-col items-center justify-center ${active ? 'playing' : ''}`}
                  style={{ ['--c' as string]: SCENE_COLORS[sc] }}
                  onClick={() => st.selectScene(sc)}
                  title={`Bloque ${i + 1}: ${scenes[sc].name} (clic para editar)`}
                >
                  <span className="absolute left-1 top-0.5 font-mono text-[8px] opacity-70">{i + 1}</span>
                  <span className="text-base font-black leading-none">{SCENE_NAMES[sc]}</span>
                  <div className="mt-1 hidden gap-0.5 group-hover:flex">
                    <button className="rounded bg-black/40 px-1 text-[9px] text-zinc-200 hover:bg-black/70" onClick={(e) => { e.stopPropagation(); st.songMove(i, -1); }}>◀</button>
                    <button className="rounded bg-black/40 px-1 text-[9px] text-red-300 hover:bg-black/70" onClick={(e) => { e.stopPropagation(); st.songRemove(i); }}>✕</button>
                    <button className="rounded bg-black/40 px-1 text-[9px] text-zinc-200 hover:bg-black/70" onClick={(e) => { e.stopPropagation(); st.songMove(i, 1); }}>▶</button>
                  </div>
                  {active && <div className="absolute bottom-0 left-0 h-[3px] bg-white/80" style={{ width: `${((playStep + 1) / STEPS) * 100}%` }} />}
                </div>
              );
            })}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="silk mr-1">Añadir</span>
            {SCENE_NAMES.map((n, i) => (
              <button key={n} className="hw-btn !px-2.5" style={{ color: SCENE_COLORS[i] }} onClick={() => st.songAdd(i)}>
                +{n}
              </button>
            ))}
            <div className="ml-auto flex gap-1.5">
              <button className={`hw-btn ${songLoop ? 'on' : ''}`} style={{ ['--c' as string]: '#7dff9a' }} onClick={() => st.setSongLoop(!songLoop)}>
                ⟲ Loop
              </button>
              <button className="hw-btn" onClick={() => song.length && confirm('¿Vaciar el timeline?') && st.songClear()}>
                Clear
              </button>
              <button
                className={`hw-btn ${mode === 'song' ? 'on' : ''}`}
                style={{ ['--c' as string]: '#ffb347' }}
                onClick={() => st.setMode(mode === 'song' ? 'pattern' : 'song')}
              >
                Song Mode
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
