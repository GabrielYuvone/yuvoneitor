import { audition } from '../audio/sequencer';
import { DEFAULT_TRACK_IDS, type Track } from '../audio/types';
import { useStore } from '../state/store';
import { splitWords } from '../audio/voice';
import { Knob } from './Knob';

export function VoiceEditor({ track }: { track: Track }) {
  const v = track.voice;
  const st = useStore.getState();
  if (!v) return null;
  const words = splitWords(v.text).length;
  const custom = !DEFAULT_TRACK_IDS.includes(track.id);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="silk">Voz Robot · {track.name}</div>
        <div className="flex items-center gap-1.5">
          <button
            className="hw-btn"
            style={{ ['--c' as string]: track.color }}
            onClick={() => audition(track, [60], true)}
            title="Preescuchar la frase completa"
          >
            🔊 Decir
          </button>
          {custom && (
            <button
              className="hw-btn"
              onClick={() => confirm(`¿Quitar ${track.name}? Se borrará de todas las escenas.`) && st.removeTrack(track.id)}
              title="Eliminar esta pista"
            >
              ✕ Quitar pista
            </button>
          )}
        </div>
      </div>
      <textarea
        className="panel-inset w-full resize-none rounded p-2 font-mono text-[12px] tracking-wide text-[var(--amber)] outline-none placeholder:text-zinc-600"
        rows={2}
        maxLength={160}
        value={v.text}
        placeholder="Escribí la frase acá… cada paso activado dice una palabra"
        onChange={(e) => st.setVoice(track.id, { text: e.target.value })}
      />
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
        <div className="flex flex-col items-start gap-1">
          <div className="flex gap-1">
            <button
              className={`hw-btn !px-2 !py-0.5 !text-[9px] ${v.lang === 'en' ? 'on' : ''}`}
              style={{ ['--c' as string]: track.color }}
              onClick={() => st.setVoice(track.id, { lang: 'en' })}
              title="Fonética inglesa (digrafos, magic-e, sight words)"
            >
              EN
            </button>
            <button
              className={`hw-btn !px-2 !py-0.5 !text-[9px] ${v.lang === 'es' ? 'on' : ''}`}
              style={{ ['--c' as string]: track.color }}
              onClick={() => st.setVoice(track.id, { lang: 'es' })}
              title="Fonética castellana (seseo rioplatense)"
            >
              ES
            </button>
          </div>
          <span className="silk !text-[8px]">Idioma</span>
        </div>
        <Knob
          label="SPD"
          value={v.speed}
          min={0.5}
          max={2.5}
          defaultValue={1}
          color={track.color}
          format={(x) => `${x.toFixed(2)}×`}
          onChange={(x) => st.setVoice(track.id, { speed: x })}
        />
        <Knob
          label="VIB"
          value={v.vibrato}
          min={0}
          max={1}
          defaultValue={0.2}
          color={track.color}
          format={(x) => `${Math.round(x * 100)}%`}
          onChange={(x) => st.setVoice(track.id, { vibrato: x })}
        />
        <p className="min-w-[220px] flex-1 text-[10px] leading-relaxed text-zinc-500">
          <b className="text-zinc-400">{words} palabras</b> · cada paso activo dispara la frase completa desde el principio; si la vuelve a disparar, se corta y reinicia. La{' '}
          <b className="text-zinc-400">nota</b> fija el tono (canta una octava abajo, registro robot) y el <b className="text-zinc-400">accent</b> sube el volumen.
          Fonética en inglés (digrafos sh/th/oo/ee, magic-e, sight words) o castellana según el idioma; lo que no conoce, lo canta letra por letra.
        </p>
      </div>
    </div>
  );
}
