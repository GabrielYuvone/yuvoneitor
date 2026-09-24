<div align="center">

# 🎛️ YUVONEITOR

**Groovebox analógica virtual — 11 pistas · 8 escenas · 16 pasos**

🚀 **Demo en vivo:** https://yuvoneitor.gabrielyuvone.workers.dev/

*Kick/Snare/Hats/Clap 808 · Moog Bass · Acid 303 · Poly Pad · Ambient · Pluck · Sampler con waveform editor*

![React](https://img.shields.io/badge/React-19-61dafb?logo=react)
![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite)
![Tailwind](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)
![Web Audio API](https://img.shields.io/badge/Web_Audio_API-síntesis_en_tiempo_real-ffb347)

</div>

## ✨ Características

- **🥁 Batería 808 sintetizada** en tiempo real (sin samples): kick con pitch-sweep, snare tono+ruido, hi-hats metálicos con choke, claps.
- **🎹 5 sintetizadores**: Moog Bass (filtro 24 dB/oct), Acid 303 (resonante, glide, accent), Poly Pad (supersaw), Ambient (FM) y Pluck.
- **🎛️ Channel strip por pista**: 6 formas de onda, FM, filtro multimodo LP/HP/BP/Notch, ADSR completa, LFO asignable, drive, envíos de reverb/delay.
- **🎚️ Master bus**: saturación, compresor, reverb generativa y delay ping-pong sincronizado al tempo.
- **🎤 Sampler**: carga WAV/MP3 (botón o drag & drop), editor de waveform con selección de región, trim, normalize, reverse, modo cromático o por slices (2–16) y pads con grabación en vivo.
- **🎬 Scene Arranger**: 8 escenas (A–H) + timeline de canción por bloques con loop.
- **⬤ Tape Out**: graba el Pattern o la Song en tiempo real y exporta a **WAV 16-bit** o **MP3** (128/192/320 kbps), con preescucha y descarga directa.
- **💡 Knobs retroiluminados** con anillo LED que responde al valor y a la interacción.
- **⌨️ Atajos**: `Espacio` = Play/Stop · `A W S E D F T G Y H U J K` = tocar notas.

## 🚀 Puesta en marcha

```bash
npm install
npm run dev      # servidor de desarrollo
npm run build    # build de producción (dist/index.html autocontenido)
```

> 🔊 El audio arranca con el primer gesto del usuario (Play, pads o teclas), como exige la política de autoplay de los navegadores.

## 🛠️ Stack

React 19 · Vite 7 (`vite-plugin-singlefile`) · Tailwind CSS 4 · Zustand (estado + persistencia en localStorage) · Web Audio API (síntesis, sin samples salvo el sampler)

## 📁 Estructura

```
src/
├── audio/
│   ├── engine.ts      # Motor de síntesis y mezcla (Web Audio API)
│   ├── sequencer.ts   # Secuenciador look-ahead + binding con el store
│   └── types.ts       # Tipos, presets de pistas y escenas demo
├── state/store.ts     # Estado global (zustand + persist)
├── components/        # Transport, SceneArranger, SequencerGrid,
│                       # ChannelStrip, PianoRoll, SamplerEditor, Knob
├── App.tsx
└── index.css          # Estética hardware retro
```

## 📄 Licencia

MIT — úsalo, mézclalo y sácale humo a los filtros. 🔥
