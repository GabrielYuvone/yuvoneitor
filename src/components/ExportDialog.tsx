import { useEffect, useRef, useState } from 'react';
import { BounceCancelled, getBouncePlan, startBounce, type BounceFormat, type BounceResult, type BounceSource } from '../audio/bounce';
import { SCENE_NAMES } from '../audio/types';
import { useStore } from '../state/store';

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}.${Math.floor((s % 1) * 10)}`;
const fmtSize = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(2)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

type Phase = 'idle' | 'recording' | 'done';

export function ExportDialog({ onClose }: { onClose: () => void }) {
  const bpm = useStore((s) => s.bpm);
  const songLen = useStore((s) => s.song.length);
  const selectedScene = useStore((s) => s.selectedScene);
  const mode = useStore((s) => s.mode);

  const [source, setSource] = useState<BounceSource>(mode);
  const [loops, setLoops] = useState(2);
  const [format, setFormat] = useState<BounceFormat>('wav');
  const [kbps, setKbps] = useState(192);
  const [tail, setTail] = useState(2);
  const [phase, setPhase] = useState<Phase>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<BounceResult | null>(null);
  const [error, setError] = useState('');
  const cancelRef = useRef<(() => void) | null>(null);
  const urlRef = useRef<string | null>(null);

  const plan = getBouncePlan(source, loops, tail);
  const estBytes = format === 'wav' ? 44 + plan.total * 48000 * 4 : (plan.total * kbps * 1000) / 8;
  const recording = phase === 'recording';
  const encoding = recording && elapsed >= plan.total - 0.05;

  useEffect(
    () => () => {
      cancelRef.current?.();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  const start = async () => {
    setError('');
    setResult(null);
    setElapsed(0);
    setPhase('recording');
    try {
      const { done, cancel } = startBounce({
        source,
        loops,
        tail,
        format,
        mp3Kbps: kbps,
        onProgress: (e) => setElapsed(e),
      });
      cancelRef.current = cancel;
      const r = await done;
      cancelRef.current = null;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = r.url;
      setResult(r);
      setPhase('done');
    } catch (e) {
      cancelRef.current = null;
      if (e instanceof BounceCancelled || (e instanceof Error && e.name === 'BounceCancelled')) {
        setPhase('idle');
      } else {
        setError(e instanceof Error ? e.message : 'Error al grabar');
        setPhase('idle');
      }
    }
  };

  const close = () => {
    if (recording) cancelRef.current?.();
    onClose();
  };

  const pct = Math.min(100, (elapsed / Math.max(plan.total, 0.001)) * 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm" onClick={close}>
      <div className="panel w-full max-w-[520px] p-4" onClick={(e) => e.stopPropagation()}>
        <div className="screw left-1.5 top-1.5" />
        <div className="screw right-1.5 top-1.5" />
        <div className="mb-3 flex items-center gap-2 px-2">
          <span className={`led ${recording ? 'on animate-pulse' : result ? 'on' : ''}`} style={{ ['--c' as string]: recording ? '#ff4d5e' : '#7dff9a' }} />
          <span className="text-sm font-black uppercase tracking-[0.2em] text-zinc-100">Tape Out · Bounce a disco</span>
          <button className="hw-btn ml-auto !px-2 !py-0.5" onClick={close} title={recording ? 'Cancelar grabación y cerrar' : 'Cerrar'}>
            ✕
          </button>
        </div>

        {/* Fuente */}
        <div className="silk mb-1.5">1 · Fuente a grabar</div>
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button className={`hw-btn ${source === 'pattern' ? 'on' : ''}`} style={{ ['--c' as string]: '#34e7ff' }} onClick={() => !recording && setSource('pattern')} disabled={recording}>
            Pattern {SCENE_NAMES[selectedScene]}
          </button>
          <button className={`hw-btn ${source === 'song' ? 'on' : ''}`} style={{ ['--c' as string]: '#ffb347' }} onClick={() => !recording && setSource('song')} disabled={recording}>
            Song · {songLen} bars
          </button>
          {source === 'pattern' && (
            <div className="ml-1 flex items-center gap-1">
              <span className="silk">Vueltas</span>
              {[1, 2, 4].map((l) => (
                <button key={l} className={`hw-btn !px-2 ${loops === l ? 'on' : ''}`} style={{ ['--c' as string]: '#34e7ff' }} onClick={() => !recording && setLoops(l)} disabled={recording}>
                  ×{l}
                </button>
              ))}
            </div>
          )}
        </div>
        {source === 'song' && songLen === 0 && (
          <div className="mb-3 rounded bg-amber-500/10 px-2 py-1 text-[11px] text-amber-300">
            Timeline vacío: se grabará 1 compás de la escena actual. Añade bloques en el Song Arranger para una canción completa.
          </div>
        )}

        {/* Formato */}
        <div className="silk mb-1.5">2 · Formato</div>
        <div className="mb-3 flex flex-wrap items-center gap-1.5">
          <button className={`hw-btn ${format === 'wav' ? 'on' : ''}`} style={{ ['--c' as string]: '#7dff9a' }} onClick={() => !recording && setFormat('wav')} disabled={recording}>
            WAV 16-bit
          </button>
          <button className={`hw-btn ${format === 'mp3' ? 'on' : ''}`} style={{ ['--c' as string]: '#7dff9a' }} onClick={() => !recording && setFormat('mp3')} disabled={recording}>
            MP3
          </button>
          {format === 'mp3' && (
            <div className="flex items-center gap-1">
              {[128, 192, 320].map((k) => (
                <button key={k} className={`hw-btn !px-2 ${kbps === k ? 'on' : ''}`} style={{ ['--c' as string]: '#7dff9a' }} onClick={() => !recording && setKbps(k)} disabled={recording}>
                  {k}
                </button>
              ))}
              <span className="silk">kbps</span>
            </div>
          )}
          <div className="ml-1 flex items-center gap-1">
            <span className="silk">Cola</span>
            {[0, 1, 2, 4].map((t) => (
              <button key={t} className={`hw-btn !px-2 ${tail === t ? 'on' : ''}`} style={{ ['--c' as string]: '#b98cff' }} onClick={() => !recording && setTail(t)} disabled={recording} title="Segundos extra para la cola de reverb/delay">
                {t}s
              </button>
            ))}
          </div>
        </div>

        {/* Resumen LCD */}
        <div className="lcd mb-3 flex items-center justify-between px-3 py-2 text-[12px]">
          <span>
            {plan.bars} BAR · {fmtTime(plan.total)} · {bpm} BPM
          </span>
          <span className="opacity-70">≈ {fmtSize(estBytes)} {format.toUpperCase()}</span>
        </div>

        {/* Progreso */}
        {(recording || phase === 'done') && (
          <div className="panel-inset mb-3 p-2.5">
            <div className="mb-1.5 flex items-center justify-between text-[11px]">
              <span className={recording ? 'font-bold text-red-400' : 'text-zinc-400'}>
                {recording ? (encoding ? '▣ Codificando…' : '⬤ GRABANDO — no cierres esta ventana') : '✔ Bounce completado'}
              </span>
              <span className="font-mono text-[var(--cyan)]">
                {fmtTime(elapsed)} / {fmtTime(plan.total)}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-black/60">
              <div
                className="h-full rounded-full transition-[width]"
                style={{ width: `${phase === 'done' ? 100 : pct}%`, background: 'linear-gradient(90deg,#ff4d5e,#ffb347)', boxShadow: '0 0 10px #ff4d5e' }}
              />
            </div>
          </div>
        )}

        {error && <div className="mb-3 rounded bg-red-500/10 px-2 py-1 text-[11px] text-red-300">{error}</div>}

        {/* Resultado */}
        {phase === 'done' && result && (
          <div className="panel-inset mb-3 flex flex-col gap-2 p-2.5">
            <audio controls src={result.url} className="w-full" />
            <div className="flex flex-wrap items-center gap-2">
              <span className="lcd-mini truncate rounded px-2 py-1 font-mono text-[10px] text-[var(--green)]">{result.filename}</span>
              <span className="font-mono text-[10px] text-zinc-500">
                {fmtTime(result.duration)} · {(result.sampleRate / 1000).toFixed(1)} kHz estéreo · {fmtSize(result.blob.size)}
              </span>
              <a href={result.url} download={result.filename} className="hw-btn on ml-auto !py-1.5" style={{ ['--c' as string]: '#7dff9a' }}>
                ⬇ Descargar {format.toUpperCase()}
              </a>
            </div>
          </div>
        )}

        {/* Acciones */}
        <div className="flex gap-2">
          {recording ? (
            <button className="hw-btn on flex-1 !py-2" style={{ ['--c' as string]: '#ff4d5e' }} onClick={() => cancelRef.current?.()}>
              ■ Cancelar
            </button>
          ) : phase === 'done' ? (
            <>
              <button className="hw-btn flex-1 !py-2" onClick={() => setPhase('idle')}>
                ↺ Nueva grabación
              </button>
              <button className="hw-btn flex-1 !py-2" onClick={close}>
                Cerrar
              </button>
            </>
          ) : (
            <button className="hw-btn on flex-1 !py-2" style={{ ['--c' as string]: '#ff4d5e' }} onClick={start}>
              <span className="led mr-1.5" style={{ ['--c' as string]: '#ff4d5e' }} /> ⬤ Grabar {source === 'pattern' ? `Pattern ${SCENE_NAMES[selectedScene]}` : 'Song'}
            </button>
          )}
        </div>
        <p className="mt-2 text-[10px] leading-relaxed text-zinc-500">
          Bounce en tiempo real del bus master: suena la máquina y se captura tal cual la oyes — los movimientos de knobs durante la grabación también quedan registrados.
        </p>
      </div>
    </div>
  );
}
