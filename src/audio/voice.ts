/**
 * Voz robot estilo Kraftwerk: texto → secuencia de fonemas con formantes.
 * 100% sintetizado (sin samples ni TTS): el motor pinta los formantes
 * sobre un buzzer de onda sierra, como las voces de Computer World.
 *
 * Dos motores fonéticos: castellano rioplatense (seseo, v=b, h muda)
 * e inglés (digrafos sh/th/ch/oo/ee/igh, magic-e, sight words).
 */

export type VoiceLang = 'es' | 'en';

export interface Phone {
  /** formantes F1/F2/F3 en Hz (vocales, nasales, líquidas y oclusivas sonoras) */
  f1: number;
  f2: number;
  f3: number;
  /** centro de la fricativa/ráfaga de ruido (0 = sin ruido) */
  noiseHz: number;
  /** duración base en segundos (a speed = 1) */
  dur: number;
  voiced: boolean;
  amp: number; // 0..1
}

const V = (f1: number, f2: number, f3: number, dur = 0.115, amp = 1): Phone => ({
  f1, f2, f3, noiseHz: 0, dur, voiced: true, amp,
});
const FRIC = (hz: number, dur = 0.075, amp = 0.6, voiced = false): Phone => ({
  f1: 400, f2: 1700, f3: 2600, noiseHz: hz, dur, voiced, amp,
});

/** Tabla fonética compartida: vocales + consonantes de ambos idiomas */
export const PHONES: Record<string, Phone> = {
  // vocales castellanas puras
  a: V(730, 1090, 2440),
  e: V(530, 1840, 2480),
  i: V(300, 2280, 3000, 0.105),
  o: V(560, 880, 2420),
  u: V(320, 800, 2250, 0.105),
  // vocales inglesas
  'æ': V(660, 1720, 2410, 0.11), // cat
  'ɪ': V(390, 1990, 2550, 0.1), // bit
  'ʌ': V(640, 1190, 2390, 0.1), // cup, love
  'ɔ': V(570, 840, 2410, 0.12), // dog, hot
  'ʊ': V(430, 1200, 2380, 0.08), // book, could
  'ɜ': V(490, 1350, 2100, 0.12), // her, world
  'ɑ': V(730, 1090, 2440), // father, car
  // nasales y líquidas (sonoras, con formantes)
  m: { f1: 280, f2: 900, f3: 2200, noiseHz: 0, dur: 0.075, voiced: true, amp: 0.75 },
  n: { f1: 300, f2: 1700, f3: 2600, noiseHz: 0, dur: 0.07, voiced: true, amp: 0.75 },
  'ŋ': { f1: 300, f2: 2100, f3: 2700, noiseHz: 0, dur: 0.08, voiced: true, amp: 0.75 }, // sing
  'ñ': { f1: 300, f2: 2000, f3: 2800, noiseHz: 0, dur: 0.09, voiced: true, amp: 0.75 },
  l: { f1: 360, f2: 1300, f3: 2900, noiseHz: 0, dur: 0.065, voiced: true, amp: 0.85 },
  r: { f1: 420, f2: 1150, f3: 1600, noiseHz: 0, dur: 0.045, voiced: true, amp: 0.8 }, // tap castellano
  rr: { f1: 420, f2: 1150, f3: 1600, noiseHz: 0, dur: 0.1, voiced: true, amp: 0.85 }, // vibrante
  'ɹ': { f1: 350, f2: 1150, f3: 1450, noiseHz: 0, dur: 0.055, voiced: true, amp: 0.85 }, // r inglesa
  y: V(320, 2100, 2900, 0.06, 0.8), // glide palatal (diphthong -ay/-oy)
  w: V(320, 750, 2250, 0.06, 0.8), // glide labiovelar (diphthong -ow)
  // fricativas sordas
  s: FRIC(5600),
  f: FRIC(4800, 0.08),
  x: FRIC(2800, 0.09, 0.7), // ch castellana
  j: FRIC(1400, 0.09, 0.7), // aspirada castellana (j/g fuerte)
  'ʃ': FRIC(2500, 0.085, 0.65), // english sh
  'θ': FRIC(6600, 0.08, 0.5), // think
  // fricativas sonoras
  z: { f1: 400, f2: 1700, f3: 2600, noiseHz: 5600, dur: 0.065, voiced: true, amp: 0.5 },
  v: { f1: 300, f2: 1100, f3: 2300, noiseHz: 4800, dur: 0.055, voiced: true, amp: 0.55 },
  'ð': { f1: 400, f2: 1700, f3: 2600, noiseHz: 6600, dur: 0.05, voiced: true, amp: 0.4 }, // the
  'ʒ': { f1: 400, f2: 1700, f3: 2600, noiseHz: 2500, dur: 0.06, voiced: true, amp: 0.45 }, // vision
  'ʤ': { f1: 400, f2: 1700, f3: 2600, noiseHz: 2800, dur: 0.08, voiced: true, amp: 0.8 }, // jam, gem
  // h inglesa: soplido suave
  h: { f1: 500, f2: 1500, f3: 2500, noiseHz: 1500, dur: 0.045, voiced: false, amp: 0.3 },
  // oclusivas: ráfaga breve
  p: { f1: 400, f2: 1700, f3: 2600, noiseHz: 900, dur: 0.028, voiced: false, amp: 0.85 },
  t: { f1: 400, f2: 1700, f3: 2600, noiseHz: 3600, dur: 0.028, voiced: false, amp: 0.85 },
  k: { f1: 400, f2: 1700, f3: 2600, noiseHz: 1900, dur: 0.028, voiced: false, amp: 0.85 },
  b: { f1: 400, f2: 1700, f3: 2600, noiseHz: 700, dur: 0.025, voiced: true, amp: 0.7 },
  d: { f1: 400, f2: 1700, f3: 2600, noiseHz: 2800, dur: 0.025, voiced: true, amp: 0.7 },
  g: { f1: 400, f2: 1700, f3: 2600, noiseHz: 1500, dur: 0.025, voiced: true, amp: 0.7 },
  /** pausa entre palabras */
  ' ': { f1: 400, f2: 1700, f3: 2600, noiseHz: 0, dur: 0.06, voiced: false, amp: 0 },
};

/** Inglés: sight words irregulares frecuentes en frases/letras */
const EN_WORDS: Record<string, Phone[]> = {
  the: [PHONES['ð'], PHONES.i],
  you: [PHONES.u],
  i: [PHONES.a, PHONES.y],
  a: [PHONES['ʌ']],
  to: [PHONES.t, PHONES.u],
  do: [PHONES.d, PHONES.u],
  are: [PHONES['ɑ'], PHONES['ɹ']],
  one: [PHONES.w, PHONES['ʌ'], PHONES.n],
  two: [PHONES.t, PHONES.u],
  who: [PHONES.h, PHONES.u],
  of: [PHONES['ʌ'], PHONES.v],
  is: [PHONES['ɪ'], PHONES.z],
  was: [PHONES.w, PHONES['ʌ'], PHONES.z],
  been: [PHONES.b, PHONES['ɪ'], PHONES.n],
  come: [PHONES.k, PHONES['ʌ'], PHONES.m],
  some: [PHONES.s, PHONES['ʌ'], PHONES.m],
  love: [PHONES.l, PHONES['ʌ'], PHONES.v],
  done: [PHONES.d, PHONES['ʌ'], PHONES.n],
  does: [PHONES.d, PHONES['ʌ'], PHONES.z],
  could: [PHONES.k, PHONES['ʊ'], PHONES.d],
  would: [PHONES.w, PHONES['ʊ'], PHONES.d],
  should: [PHONES['ʃ'], PHONES['ʊ'], PHONES.d],
  world: [PHONES.w, PHONES['ɜ'], PHONES.l, PHONES.d],
  work: [PHONES.w, PHONES['ɜ'], PHONES.k],
  word: [PHONES.w, PHONES['ɜ'], PHONES.d],
  people: [PHONES.p, PHONES.i, PHONES.p, PHONES['ʌ'], PHONES.l],
  computer: [PHONES.k, PHONES['ʌ'], PHONES.m, PHONES.p, PHONES.y, PHONES.u, PHONES.t, PHONES['ɜ'], PHONES['ɹ']],
};

/** Convierte una palabra en fonemas según el idioma de la pista */
export function wordToPhones(word: string, lang: VoiceLang = 'es'): Phone[] {
  return lang === 'en' ? wordToPhonesEn(word) : wordToPhonesEs(word);
}

/* ---------------- castellano rioplatense ---------------- */

function normalizeEs(text: string): string {
  return stripAccents(text)
    .replace(/ch/g, 'x')
    .replace(/ll/g, 'y')
    .replace(/c([ei])/g, 'z$1') // ce/ci → se (seseo)
    .replace(/qu([ei])/g, 'k$1')
    .replace(/q([aou])/g, 'k$1')
    .replace(/gu([ei])/g, 'g$1')
    .replace(/[vw]/g, 'b')
    .replace(/h/g, '');
}

function wordToPhonesEs(word: string): Phone[] {
  const s = normalizeEs(word);
  const out: Phone[] = [];
  let i = 0;
  while (i < s.length) {
    if (s.startsWith('rr', i)) {
      out.push(PHONES.rr);
      i += 2;
      continue;
    }
    const ch = s[i];
    if (ch === '\u0303') {
      i++;
      continue;
    }
    let p = PHONES[ch];
    if (!p && ch === 'c') p = PHONES.k; // ca/co/cu
    if (!p) {
      i++;
      continue;
    }
    out.push(p);
    i++;
  }
  return out;
}

function stripAccents(s: string): string {
  return s
    .toLowerCase()
    .replace(/ü/g, 'u')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, (c) => (c === '\u0303' ? c : ''))
    .normalize('NFC');
}

/* ---------------- inglés ---------------- */

/** Un carácter inglés suelto → fonema(s). c/g suaves se resuelven aparte. */
function letterEn(ch: string): Phone[] {
  const map: Record<string, Phone> = {
    a: PHONES['æ'],
    e: PHONES.e,
    i: PHONES['ɪ'],
    o: PHONES['ɔ'],
    u: PHONES['ʌ'],
    j: PHONES['ʤ'],
    h: PHONES.h,
    v: PHONES.v,
    z: PHONES.z,
    w: PHONES.w,
    y: PHONES.y,
    r: PHONES['ɹ'],
  };
  const p = map[ch] ?? PHONES[ch];
  return p ? [p] : [];
}

function wordToPhonesEn(word: string): Phone[] {
  const lower = word.toLowerCase().replace(/[^a-z']/g, '');
  if (!lower) return [];
  const special = EN_WORDS[lower];
  if (special) return [...special];

  let s = lower.replace(/'/g, '');
  // consonantes dobles colapsan (preserva digrafos vocálicos oo/ee)
  s = s.replace(/([bcdfglmnprstvz])\1/g, '$1');

  const out: Phone[] = [];
  const D = (key: string) => PHONES[key];

  // magic-e: vocal + consonante + e final → vocal larga (time, note, name, cute)
  const magic = s.match(/^(.*?)([aiou])([bcdfgklmnprstv])e$/);
  if (magic) {
    const longV: Phone[] =
      magic[2] === 'a'
        ? [D('e'), D('y')]
        : magic[2] === 'i'
          ? [D('a'), D('y')]
          : magic[2] === 'o'
            ? [D('o'), D('w')]
            : [D('u')];
    return [...wordToPhonesEn(magic[1]), ...longV, ...letterEn(magic[3])];
  }
  // e final muda (dance → danc, love → lov)
  if (s.length > 2 && s.endsWith('e')) s = s.slice(0, -1);
  // y final: "my/cry" → ai; "happy" → i
  if (s.length > 1 && s.endsWith('y')) {
    const base = s.slice(0, -1);
    if (s.length <= 3) return [...wordToPhonesEn(base), D('a'), D('y')];
    return [...wordToPhonesEn(base), D('i')];
  }

  let i = 0;
  while (i < s.length) {
    if (s.startsWith('igh', i)) {
      out.push(D('a'), D('y')); // high, light
      i += 3;
      continue;
    }
    const two = s.slice(i, i + 2);
    const twoMap: Record<string, Phone[]> = {
      sh: [D('ʃ')],
      ch: [D('ʤ')],
      th: [D('θ')],
      ph: [D('f')],
      wh: [D('w')],
      ck: [D('k')],
      ng: [D('ŋ')],
      qu: [D('k'), D('w')],
      oo: [D('u')],
      ee: [D('i')],
      ea: [D('i')],
      ou: [D('a'), D('w')],
      ow: [D('o'), D('w')],
      oi: [D('o'), D('y')],
      oy: [D('o'), D('y')],
      ai: [D('e'), D('y')],
      ay: [D('e'), D('y')],
      au: [D('ɔ')],
      aw: [D('ɔ')],
      ew: [D('u')],
      ir: [D('ɜ'), D('ɹ')],
      er: [D('ɜ'), D('ɹ')],
      ur: [D('ɜ'), D('ɹ')],
      ar: [D('ɑ'), D('ɹ')],
      or: [D('ɔ'), D('ɹ')],
    };
    if (twoMap[two]) {
      out.push(...twoMap[two]);
      i += 2;
      continue;
    }
    // c y g suaves ante e/i/y (city, gem) / duras en el resto
    if (s[i] === 'c' || s[i] === 'g') {
      const soft = ['e', 'i', 'y'].includes(s[i + 1] ?? '');
      out.push(s[i] === 'c' ? (soft ? D('s') : D('k')) : soft ? D('ʤ') : D('g'));
      i++;
      continue;
    }
    out.push(...letterEn(s[i]));
    i++;
  }
  return out;
}

/** Separa la frase en palabras (para cantar una por paso activado) */
export function splitWords(text: string): string[] {
  return text
    .split(/[\s,.;:!?¡¿"']+/)
    .map((w) => w.trim())
    .filter(Boolean);
}
