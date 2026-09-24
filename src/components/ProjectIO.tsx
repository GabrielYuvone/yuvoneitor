import { useRef, useState } from 'react';
import {
  buildProjectFile,
  buildSceneFile,
  downloadJson,
  parseProjectFile,
  parseSceneFile,
  projectFilename,
  readJsonFile,
  sceneFilename,
} from '../audio/project';
import { SCENE_NAMES } from '../audio/types';
import { stop } from '../audio/sequencer';
import { useStore } from '../state/store';

type Msg = { kind: 'ok' | 'err'; text: string } | null;

export function ProjectIO() {
  const projectRef = useRef<HTMLInputElement>(null);
  const sceneRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<Msg>(null);
  const [busy, setBusy] = useState(false);
  const [dropHover, setDropHover] = useState(false);
  const timer = useRef(0);

  const say = (m: Msg) => {
    window.clearTimeout(timer.current);
    setMsg(m);
    if (m) timer.current = window.setTimeout(() => setMsg(null), 5000);
  };

  const saveProject = () => {
    try {
      const s = useStore.getState();
      const file = buildProjectFile(s);
      downloadJson(file, projectFilename(s.bpm));
      say({ kind: 'ok', text: `Proyecto guardado · ${s.scenes.length} escenas · song ${s.song.length} bars` });
    } catch (e) {
      say({ kind: 'err', text: e instanceof Error ? e.message : 'No se pudo guardar el proyecto.' });
    }
  };

  const saveScene = () => {
    try {
      const s = useStore.getState();
      const scene = s.scenes[s.selectedScene];
      downloadJson(buildSceneFile(scene), sceneFilename(scene.name));
      say({ kind: 'ok', text: `${scene.name} guardada · pattern de 16 pasos` });
    } catch (e) {
      say({ kind: 'err', text: e instanceof Error ? e.message : 'No se pudo guardar la escena.' });
    }
  };

  const applyProjectFile = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    try {
      const raw = await readJsonFile(file);
      const data = parseProjectFile(raw);
      const s = useStore.getState();
      if (s.playing) stop();
      else if (!confirm('¿Cargar proyecto? Se reemplazarán patrones, mezcla y song actual.')) {
        setBusy(false);
        return;
      }
      s.loadProject(data);
      say({ kind: 'ok', text: `Proyecto cargado · ${data.scenes.length} escenas · ${data.bpm} BPM` });
    } catch (e) {
      say({ kind: 'err', text: e instanceof Error ? e.message : 'No se pudo cargar el proyecto.' });
    } finally {
      setBusy(false);
    }
  };

  const applySceneFile = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    try {
      const raw = await readJsonFile(file);
      const s = useStore.getState();
      const trackIds = s.tracks.map((t) => t.id);
      const { name, patterns } = parseSceneFile(raw, trackIds);
      if (!confirm(`¿Cargar pattern en ${s.scenes[s.selectedScene].name}? Se reemplazará su contenido.`)) {
        setBusy(false);
        return;
      }
      if (s.playing) stop();
      s.loadScene(patterns, name);
      say({ kind: 'ok', text: `Pattern cargado en ${SCENE_NAMES[s.selectedScene]} · “${name}”` });
    } catch (e) {
      say({ kind: 'err', text: e instanceof Error ? e.message : 'No se pudo cargar la escena.' });
    } finally {
      setBusy(false);
    }
  };

  const selectedScene = useStore((s) => s.selectedScene);

  return (
    <div
      className={`flex flex-wrap items-center gap-1.5 rounded px-1 py-0.5 ${dropHover ? 'bg-white/5 ring-1 ring-[var(--amber)]' : ''}`}
      onDragOver={(e) => {
        if ([...e.dataTransfer.types].includes('Files')) {
          e.preventDefault();
          setDropHover(true);
        }
      }}
      onDragLeave={() => setDropHover(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDropHover(false);
        const f = e.dataTransfer.files?.[0];
        if (f && /\.json$/i.test(f.name)) applyProjectFile(f);
        else if (f) say({ kind: 'err', text: 'Suelta un .json de proyecto Yuvoneitor.' });
      }}
      title="Arrastra un .json de proyecto aquí para cargarlo"
    >
      <span className="silk !text-[8px]">Data</span>
      <input
        ref={projectRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          applyProjectFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <input
        ref={sceneRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          applySceneFile(e.target.files?.[0]);
          e.target.value = '';
        }}
      />
      <button className="hw-btn !px-2 !py-1 !text-[9px]" style={{ ['--c' as string]: '#7dff9a' }} onClick={saveProject} title="Guardar proyecto completo (patrones, mezcla, master, song) en .json">
        💾 Proyecto
      </button>
      <button className="hw-btn !px-2 !py-1 !text-[9px]" onClick={() => projectRef.current?.click()} disabled={busy} title="Cargar un proyecto .json (o arrástralo aquí)">
        📂 Abrir
      </button>
      <span className="mx-0.5 h-4 w-px bg-white/10" />
      <button className="hw-btn !px-2 !py-1 !text-[9px]" style={{ ['--c' as string]: '#34e7ff' }} onClick={saveScene} title={`Guardar el pattern de la escena ${SCENE_NAMES[selectedScene]} en .json`}>
        💾 Esc {SCENE_NAMES[selectedScene]}
      </button>
      <button className="hw-btn !px-2 !py-1 !text-[9px]" onClick={() => sceneRef.current?.click()} disabled={busy} title={`Cargar un pattern .json en la escena ${SCENE_NAMES[selectedScene]}`}>
        📂 Esc
      </button>
      {msg && (
        <span
          className={`max-w-[280px] truncate font-mono text-[9px] normal-case tracking-normal ${
            msg.kind === 'ok' ? 'text-[var(--green)]' : 'text-red-300'
          }`}
          title={msg.text}
        >
          {msg.kind === 'ok' ? '✔ ' : '✖ '}{msg.text}
        </span>
      )}
    </div>
  );
}
