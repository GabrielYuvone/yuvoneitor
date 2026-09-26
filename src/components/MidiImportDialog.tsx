import { useMemo, useState } from 'react';
import { stop } from '../audio/sequencer';
import { useStore } from '../state/store';
import {
  DRUM_TRACK_IDS,
  mapMidiBar,
  mergeMidiBar,
  type MidiFile,
} from '../audio/midi';
import { emptyPattern as blank, SCENE_NAMES, type Pattern } from '../audio/types';

type Mode = 'scene' | 'scenes8';

export function MidiImportDialog({
  fileName,
  midi,
  onDone,
  onClose,
}: {
  fileName: string;
  midi: MidiFile;
  onDone: (msg: { kind: 'ok' | 'err'; text: string }) => void;
  onClose: () => void;
}) {
  const tracks = useStore((s) => s.tracks);
  const selectedScene = useStore((s) => s.selectedScene);

  const [mode, setMode] = useState<Mode>('scene');
  const [startBar, setStartBar] = useState(0);
  const [melodicTrack, setMelodicTrack] = useState('moog');
  const [octave, setOctave] = useState(0);
  const [replace, setReplace] = useState(true);
  const [applyBpm, setApplyBpm] = useState(midi.bpmDetected && midi.bpm >= 60 && midi.bpm <= 200);
  const [buildSong, setBuildSong] = useState(true);

  const melodicTracks = tracks.filter((t) => t.group === 'synth' || t.kind === 'sampler');
  const target = tracks.find((t) => t.id === melodicTrack);
  const affectedBars = mode === 'scene' ? 1 : 8;
  const maxStart = Math.max(0, midi.bars - affectedBars);
  const bar = Math.min(startBar, maxStart);

  // Vista previa: hits por pista con las opciones actuales
  const preview = useMemo(() => {
    const counts: Record<string, number> = {};
    for (let b = 0; b < affectedBars; b++) {
      const pats = mapMidiBar(midi, bar + b, {
        melodicTrack,
        mono: !!target?.mono,
        octaveShift: octave,
      });
      for (const [id, p] of Object.entries(pats)) {
        counts[id] = (counts[id] ?? 0) + p.reduce((a, st) => a + st.n.length, 0);
      }
    }
    return counts;
  }, [midi, bar, affectedBars, melodicTrack, octave, target]);

  const totalHits = Object.values(preview).reduce((a, b) => a + b, 0);

  const apply = () => {
    try {
      const s = useStore.getState();
      if (s.playing) stop();

      const affected = [...DRUM_TRACK_IDS, melodicTrack];
      for (let b = 0; b < affectedBars; b++) {
        const sceneIdx = mode === 'scene' ? s.selectedScene : b;
        const mapped = mapMidiBar(midi, bar + b, {
          melodicTrack,
          mono: !!target?.mono,
          octaveShift: octave,
        });
        const out: Record<string, Pattern> = {};
        for (const id of affected) {
          const m = mapped[id] ?? blank();
          out[id] = replace
            ? m
            : mergeMidiBar(s.scenes[sceneIdx]?.patterns[id], m);
        }
        s.importPatterns(sceneIdx, out);
      }
      if (applyBpm) s.setBpm(Math.min(200, Math.max(60, midi.bpm)));
      if (mode === 'scenes8' && buildSong) s.songReplace([0, 1, 2, 3, 4, 5, 6, 7]);

      const destino =
        mode === 'scene'
          ? `escena ${SCENE_NAMES[s.selectedScene]}`
          : `escenas ${SCENE_NAMES[0]}–${SCENE_NAMES[7]}${buildSong ? ' + song' : ''}`;
      onDone({
        kind: 'ok',
        text: `MIDI importado · ${totalHits} notas → ${destino}${applyBpm ? ` · ${Math.min(200, Math.max(60, midi.bpm))} BPM` : ''}`,
      });
      onClose();
    } catch (e) {
      onDone({ kind: 'err', text: e instanceof Error ? e.message : 'No se pudo importar el MIDI.' });
      onClose();
    }
  };

  const stepper = (value: number, set: (v: number) => void, min: number, max: number, label: string) => (
    <div className="flex items-center gap-1">
      <button className="hw-btn !px-2" onClick={() => set(Math.max(min, value - 1))} disabled={value <= min}>◀</button>
      <button
        className="lcd-mini rounded px-2 py-0.5 font-mono text-[10px] text-[var(--cyan)]"
        onClick={() => {
          const v = prompt(`Compás (1–${max + 1}):`, String(value + 1));
          if (v !== null) {
            const n = parseInt(v, 10);
            if (Number.isFinite(n)) set(Math.min(max, Math.max(min, n - 1)));
          }
        }}
        title="Clic para escribir el número de compás"
      >
        {label}
      </button>
      <button className="hw-btn !px-2" onClick={() => set(Math.min(max, value + 1))} disabled={value >= max}>▶</button>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" onClick={onClose}>
      <div className="panel w-full max-w-[560px] p-4" onClick={(e) => e.stopPropagation()}>
        <div className="screw left-1.5 top-1.5" />
        <div className="screw right-1.5 top-1.5" />
        <div className="mb-3 flex items-center gap-2 px-2">
          <span className="led on" style={{ ['--c' as string]: '#b98cff' }} />
          <span className="text-sm font-black uppercase tracking-[0.2em] text-zinc-100">MIDI Import</span>
          <span className="silk truncate" title={fileName}>{fileName}</span>
          <button className="hw-btn ml-auto !px-2 !py-0.5" onClick={onClose} title="Cerrar">✕</button>
        </div>

        {/* Resumen del archivo */}
        <div className="lcd mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-[11px]">
          <span>FORMATO {midi.format} · {midi.trackCount} TRK</span>
          <span>{midi.bars} BARS</span>
          <span>{midi.bpm} BPM{midi.bpmDetected ? '' : ' (DEF)'}</span>
          <span className="opacity-80">
            {midi.notes.length} NOTAS · {midi.drumNotes} DRUM / {midi.melodicNotes} MEL
          </span>
        </div>
        {midi.unmappedDrums > 0 && (
          <div className="mb-3 rounded bg-amber-500/10 px-2 py-1 text-[10px] text-amber-300">
            {midi.unmappedDrums} notas de batería fuera del mapa GM (congas, bongós, etc.) se ignorarán.
          </div>
        )}

        {/* 1 · Destino */}
        <div className="silk mb-1.5">1 · Destino</div>
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <button
            className={`hw-btn ${mode === 'scene' ? 'on' : ''}`}
            style={{ ['--c' as string]: '#34e7ff' }}
            onClick={() => setMode('scene')}
            title="Importar un compás en la escena seleccionada"
          >
            Escena actual {SCENE_NAMES[selectedScene]}
          </button>
          <button
            className={`hw-btn ${mode === 'scenes8' ? 'on' : ''}`}
            style={{ ['--c' as string]: '#ffb347' }}
            onClick={() => setMode('scenes8')}
            title="Importar hasta 8 compases consecutivos en las escenas A–H"
          >
            8 escenas A–H
          </button>
        </div>

        {/* 2 · Compás de origen */}
        <div className="silk mb-1.5">
          2 · Compás{affectedBars > 1 ? `s (${bar + 1}–${Math.min(midi.bars, bar + affectedBars)} de ${midi.bars})` : ` de origen`}
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          {stepper(bar, (v) => setStartBar(v), 0, maxStart, `BAR ${bar + 1}/${midi.bars}`)}
          {mode === 'scenes8' && (
            <button
              className={`hw-btn ml-1 ${buildSong ? 'on' : ''}`}
              style={{ ['--c' as string]: '#7dff9a' }}
              onClick={() => setBuildSong(!buildSong)}
              title="Armar el timeline de song con las escenas A→H"
            >
              ♫ Armar song
            </button>
          )}
        </div>

        {/* 3 · Melodía → pista */}
        <div className="silk mb-1.5">3 · Melodía → pista (canal 10 va a la batería GM)</div>
        <div className="mb-1.5 flex flex-wrap items-center gap-1">
          {melodicTracks.map((t) => (
            <button
              key={t.id}
              className={`hw-btn ${melodicTrack === t.id ? 'on' : ''}`}
              style={{ ['--c' as string]: t.color }}
              onClick={() => setMelodicTrack(t.id)}
              title={t.name}
            >
              {t.short}
            </button>
          ))}
          <span className="mx-0.5 h-4 w-px bg-white/10" />
          <button className="hw-btn !px-2" onClick={() => setOctave((o) => Math.max(-2, o - 1))} disabled={octave <= -2}>Oct ▼</button>
          <span className="lcd-mini rounded px-2 py-0.5 font-mono text-[10px] text-[#b98cff]">
            {octave > 0 ? `+${octave}` : octave} OCT
          </span>
          <button className="hw-btn !px-2" onClick={() => setOctave((o) => Math.min(2, o + 1))} disabled={octave >= 2}>Oct ▲</button>
        </div>
        {target && (
          <p className="mb-3 text-[10px] text-zinc-500">
            Todo lo que no sea canal 10 entra en <b style={{ color: target.color }}>{target.name}</b>
            {target.mono ? ' (mono: se queda la nota más fuerte por paso)' : ' (poly: hasta 6 notas por paso)'}.
          </p>
        )}

        {/* 4 · Opciones */}
        <div className="silk mb-1.5">4 · Opciones</div>
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <button className={`hw-btn ${replace ? 'on' : ''}`} style={{ ['--c' as string]: '#ff5a4e' }} onClick={() => setReplace(true)} title="Limpia las pistas afectadas antes de escribir">
            Reemplazar
          </button>
          <button className={`hw-btn ${!replace ? 'on' : ''}`} style={{ ['--c' as string]: '#34e7ff' }} onClick={() => setReplace(false)} title="Suma las notas del MIDI a lo que ya hay">
            Mezclar
          </button>
          <span className="mx-0.5 h-4 w-px bg-white/10" />
          <button
            className={`hw-btn ${applyBpm ? 'on' : ''}`}
            style={{ ['--c' as string]: '#7dff9a' }}
            onClick={() => setApplyBpm(!applyBpm)}
            title={`Aplicar el tempo del archivo (${midi.bpm} BPM)`}
          >
            BPM {midi.bpm}
          </button>
        </div>

        {/* Vista previa del mapeo */}
        <div className="panel-inset mb-3 p-2">
          <div className="silk mb-1.5 !text-[8px]">Vista previa del mapeo</div>
          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[10px]">
            {Object.keys(preview).length === 0 && <span className="text-amber-300">Sin notas en este rango — probá otro compás.</span>}
            {Object.entries(preview).map(([id, count]) => {
              const t = tracks.find((x) => x.id === id);
              return (
                <span key={id} style={{ color: t?.color }}>
                  {t?.short} ×{count}
                </span>
              );
            })}
            {totalHits > 0 && (
              <span className="ml-auto text-zinc-500">
                {affectedBars} bar{affectedBars > 1 ? 's' : ''} · velocity ≥ 100 = accent
              </span>
            )}
          </div>
        </div>

        {/* Acciones */}
        <div className="flex gap-2">
          <button className="hw-btn on flex-1 !py-2" style={{ ['--c' as string]: '#b98cff' }} onClick={apply} disabled={totalHits === 0}>
            ⤓ Importar MIDI
          </button>
          <button className="hw-btn !py-2" onClick={onClose}>
            Cancelar
          </button>
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
          Cuantización a 16 avos de la escena (los tresillos se ajustan a la grilla más cercana). Batería: mapa GM del canal 10 → BD/SD/CH/OH/CP.
        </p>
      </div>
    </div>
  );
}
