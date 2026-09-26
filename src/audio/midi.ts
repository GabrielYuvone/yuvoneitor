import { emptyPattern, STEPS, type Pattern } from './types';

/**
 * Parser de Standard MIDI File (SMF) + mapeo a patterns de la YUVONEITOR2000.
 * Sin dependencias: lee formatos 0/1 (y 2 como si fuera 1), running status,
 * meta-events de tempo/nombre y división SMPTE (aproximada a 120 BPM).
 */

export interface MidiNote {
  note: number; // 0..127
  velocity: number; // 1..127
  channel: number; // 0..15 (9 = batería GM)
  startTick: number;
  endTick: number;
}

export interface MidiFile {
  format: number;
  trackCount: number;
  ppq: number; // ticks por negra (o equivalente si es SMPTE)
  bpm: number; // primer tempo del archivo (o 120 por defecto)
  bpmDetected: boolean;
  name: string; // nombre del track (meta 0x03) si existe
  notes: MidiNote[];
  bars: number; // compases de 16 avos que cubren las notas
  drumNotes: number; // notas del canal 10
  melodicNotes: number;
  unmappedDrums: number; // notas de canal 10 que no entran en el mapa GM
}

/* ---------------- parser ---------------- */

const err = (msg: string): never => {
  throw new Error(msg);
};

export function parseMidi(data: ArrayBuffer): MidiFile {
  const v = new DataView(data);
  const u32 = (p: number) => v.getUint32(p);
  const u16 = (p: number) => v.getUint16(p);
  const u8 = (p: number) => v.getUint8(p);
  const fourcc = (p: number) => String.fromCharCode(u8(p), u8(p + 1), u8(p + 2), u8(p + 3));

  if (data.byteLength < 14 || fourcc(0) !== 'MThd')
    err('No es un archivo MIDI válido (falta la cabecera MThd).');

  const headerLen = u32(4);
  const format = u16(8);
  const division = u16(12);

  let ppq: number;
  if (division & 0x8000) {
    // SMPTE: frames/seg × ticks/frame → equivalent a ppq asumiendo 120 BPM (negra = 0.5 s)
    const fps = 256 - (division >> 8);
    const tpf = division & 0xff;
    ppq = Math.max(1, Math.round(fps * tpf * 0.5));
  } else {
    ppq = Math.max(1, division);
  }

  let mpq = 500000; // 120 BPM
  let bpmDetected = false;
  let name = '';
  const notes: MidiNote[] = [];
  let trackCount = 0;

  let pos = 8 + headerLen;
  while (pos + 8 <= data.byteLength) {
    const id = fourcc(pos);
    const len = u32(pos + 4);
    const chunkStart = pos + 8;
    const chunkEnd = Math.min(chunkStart + len, data.byteLength);
    if (chunkEnd < chunkStart + len) break; // chunk truncado
    if (id === 'MTrk') {
      trackCount++;
      // --- eventos del track ---
      let p = chunkStart;
      let tick = 0;
      let status = 0;
      const pending = new Map<number, { tick: number; vel: number }>(); // key = ch*128+note
      const vlq = (): number => {
        let out = 0;
        for (let i = 0; i < 4; i++) {
          if (p >= chunkEnd) err('Archivo MIDI corrupto: delta time incompleto.');
          const b = u8(p++);
          out = (out << 7) | (b & 0x7f);
          if (!(b & 0x80)) break;
        }
        return out;
      };
      const noteOff = (key: number, endTick: number) => {
        const open = pending.get(key);
        if (!open) return;
        pending.delete(key);
        notes.push({
          note: key & 127,
          channel: key >> 7,
          velocity: open.vel,
          startTick: open.tick,
          endTick: endTick,
        });
      };
      const need = (n: number) => {
        if (p + n > chunkEnd) err('Archivo MIDI corrupto: evento truncado.');
      };

      while (p < chunkEnd) {
        tick += vlq();
        let b = u8(p++);
        if (b < 0x80) {
          if (!status) err('Archivo MIDI corrupto: running status sin estado previo.');
          b = status;
          p--;
        }
        if (b === 0xff) {
          status = 0;
          need(2);
          const type = u8(p++);
          const len2 = vlq();
          need(len2);
          if (type === 0x51 && len2 === 3) {
            mpq = (u8(p) << 16) | (u8(p + 1) << 8) | u8(p + 2);
            bpmDetected = true;
          } else if (type === 0x03 && !name) {
            let s = '';
            for (let i = 0; i < len2; i++) s += String.fromCharCode(u8(p + i));
            name = s.trim();
          }
          p += len2;
        } else if (b === 0xf0 || b === 0xf7) {
          status = 0;
          const len2 = vlq();
          need(len2);
          p += len2;
        } else if (b >= 0x80) {
          status = b;
          const hi = b & 0xf0;
          if (hi === 0x90 || hi === 0x80 || hi === 0xa0 || hi === 0xb0 || hi === 0xe0) {
            need(2);
            const key = ((b & 0x0f) << 7) | (u8(p) & 127);
            const vel = u8(p + 1);
            if (hi === 0x90 && vel > 0) {
              if (pending.has(key)) noteOff(key, tick); // re-disparo sin note-off
              pending.set(key, { tick, vel: Math.max(1, vel) });
            } else if (hi === 0x90 || hi === 0x80) {
              noteOff(key, tick);
            }
            p += 2;
          } else {
            need(1);
            p += 1;
          }
        }
      }
      for (const key of [...pending.keys()]) noteOff(key, tick); // notas sin cerrar
    }
    pos = chunkStart + len;
  }

  if (!trackCount) err('El archivo MIDI no contiene pistas.');
  if (!notes.length) err('El archivo MIDI no contiene notas para importar.');

  // los compases se cuentan por dónde EMPIEZAN las notas (la cola de la última nota no suma un compás vacío)
  let maxStart = 0;
  for (const n of notes) {
    n.startTick = Math.max(0, n.startTick);
    maxStart = Math.max(maxStart, n.startTick);
  }

  const step16 = ppq / 4;
  const maxStep = Math.round(maxStart / step16);
  const bars = Math.min(999, Math.max(1, Math.ceil((maxStep + 1) / STEPS)));

  let drumNotes = 0;
  let melodicNotes = 0;
  let unmappedDrums = 0;
  for (const n of notes) {
    if (n.channel === 9) {
      drumNotes++;
      if (!GM_DRUM_MAP[n.note]) unmappedDrums++;
    } else melodicNotes++;
  }

  return {
    format,
    trackCount,
    ppq,
    bpm: Math.min(300, Math.max(40, Math.round(60000000 / mpq))),
    bpmDetected,
    name,
    notes,
    bars,
    drumNotes,
    melodicNotes,
    unmappedDrums,
  };
}

/* ---------------- mapeo GM de batería ---------------- */

export const DRUM_TRACK_IDS = ['kick', 'snare', 'chh', 'ohh', 'clap'] as const;
export const MELODIC_TRACK_IDS = ['moog', 'acid', 'pad', 'ambient', 'pluck', 'sampler'] as const;

/** Nota GM de canal 10 → pista de la máquina */
export const GM_DRUM_MAP: Record<number, string> = {
  35: 'kick', 36: 'kick', // Acoustic / Bass Drum
  37: 'snare', 38: 'snare', 40: 'snare', // Side Stick, Snare, Electric Snare
  41: 'snare', 43: 'snare', 45: 'snare', // toms graves/medios
  47: 'snare', 48: 'snare', 50: 'snare', // toms agudos
  22: 'chh', 42: 'chh', 44: 'chh', // closed hats + pedal
  51: 'chh', 53: 'chh', 59: 'chh', // ride → hat cerrado
  26: 'ohh', 46: 'ohh', // open hats
  49: 'ohh', 52: 'ohh', 55: 'ohh', 57: 'ohh', // crashes → hat abierto
  39: 'clap', // Hand Clap
};

export const ACCENT_VELOCITY = 100;

export interface MidiMapOptions {
  melodicTrack: string;
  mono: boolean; // la pista melódica destino es mono
  octaveShift: number; // -2..+2
}

/** Cuantiza un archivo MIDI a los 16 pasos de UN compás y devuelve las pistas afectadas. */
export function mapMidiBar(midi: MidiFile, bar: number, opts: MidiMapOptions): Record<string, Pattern> {
  const out: Record<string, Pattern> = {};
  const pat = (id: string): Pattern => (out[id] ??= emptyPattern());
  const vels = new Map<string, number[]>(); // velocity del ganador mono por pista/paso
  const step16 = midi.ppq / 4;
  const startStep = Math.round(bar * STEPS);

  for (const nt of midi.notes) {
    const step = Math.round(nt.startTick / step16) - startStep;
    if (step < 0 || step >= STEPS) continue;
    const accent = nt.velocity >= ACCENT_VELOCITY;

    if (nt.channel === 9) {
      const id = GM_DRUM_MAP[nt.note];
      if (!id) continue;
      const st = pat(id)[step];
      if (!st.n.length) {
        st.n = [60];
        st.a = accent;
      } else st.a = st.a || accent;
    } else {
      const note = Math.min(127, Math.max(0, nt.note + opts.octaveShift * 12));
      const st = pat(opts.melodicTrack)[step];
      if (opts.mono) {
        // mono: gana la nota de mayor velocity (a igualdad, la última)
        let vs = vels.get(opts.melodicTrack);
        if (!vs) vels.set(opts.melodicTrack, (vs = Array<number>(STEPS).fill(0)));
        if (!st.n.length || nt.velocity >= vs[step]) {
          st.n = [note];
          vs[step] = nt.velocity;
          st.a = accent;
        }
      } else if (!st.n.includes(note) && st.n.length < 6) {
        st.n = [...st.n, note];
        if (accent) st.a = true;
      }
    }
  }
  return out;
}

/** Superpone las notas mapeadas sobre un pattern existente (modo "mezclar"). */
export function mergeMidiBar(existing: Pattern | undefined, mapped: Pattern): Pattern {
  const out: Pattern = existing
    ? existing.map((st) => ({ n: [...st.n], a: st.a }))
    : emptyPattern();
  for (let i = 0; i < STEPS; i++) {
    const src = mapped[i];
    const dst = out[i];
    for (const n of src.n) {
      if (dst.n.includes(n) || dst.n.length >= 6) continue;
      dst.n = [...dst.n, n];
    }
    if (src.a && dst.n.length) dst.a = true;
  }
  return out;
}
