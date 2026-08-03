/**
 * Sample browser — local cache first, optional device upload (≤128 KiB).
 * Matches B&W terminal submenu aesthetics.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { engineHost } from "../audio/engine-host";
import {
  deleteSample,
  formatBytes,
  getSample,
  listSamples,
  MAX_SAMPLE_BYTES,
  putSample,
  type CachedSampleMeta,
} from "../audio/sample-cache";

type View = "cache" | "permission" | "import";

interface Props {
  open: boolean;
  opIndex: number;
  currentId: string;
  onClose: () => void;
  onPick: (sampleId: string, name: string) => void;
}

export function SampleBrowser({ open, opIndex, currentId, onClose, onPick }: Props) {
  const [view, setView] = useState<View>("cache");
  const [items, setItems] = useState<CachedSampleMeta[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(currentId || null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const list = await listSamples();
      setItems(list);
    } catch {
      setItems([]);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    setView("cache");
    setError(null);
    setSelected(currentId || null);
    void refresh();
    document.body.classList.add("submenu-open");
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("submenu-open");
      window.removeEventListener("keydown", onKey);
    };
  }, [open, currentId, onClose, refresh]);

  if (!open) return null;

  const loadIntoEngine = async (id: string, name: string, data: ArrayBuffer) => {
    await engineHost.loadSampleBuffer(name, data, id);
    onPick(id, name);
  };

  const useSelected = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      const row = await getSample(selected);
      if (!row) throw new Error("Sample missing from cache");
      await loadIntoEngine(row.id, row.name, row.data.slice(0));
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const removeSelected = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      await deleteSample(selected);
      if (selected === currentId) {
        /* keep op sampleId; user can re-pick */
      }
      setSelected(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const ingestFile = async (file: File) => {
    setError(null);
    if (file.size > MAX_SAMPLE_BYTES) {
      setError(`File too large (${formatBytes(file.size)}). Max ${formatBytes(MAX_SAMPLE_BYTES)}.`);
      return;
    }
    setBusy(true);
    try {
      await engineHost.resume();
      const ctx = engineHost.audioContext;
      if (!ctx) throw new Error("Start audio first (tap Start)");
      const ab = await file.arrayBuffer();
      const audio = await ctx.decodeAudioData(ab.slice(0));
      const id = `smp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
      const copy = ab.slice(0);
      await putSample({
        id,
        name: file.name,
        size: file.size,
        sampleRate: audio.sampleRate,
        duration: audio.duration,
        createdAt: Date.now(),
        data: copy,
      });
      await loadIntoEngine(id, file.name, copy.slice(0));
      await refresh();
      setSelected(id);
      setView("cache");
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="browser-root" role="dialog" aria-modal="true" aria-label="Sample browser">
      <button type="button" className="submenu-scrim" aria-label="Close browser" onClick={onClose} />
      <div className="browser-panel submenu-panel">
        <header className="browser-head">
          <div className="browser-head-left">
            <span className="browser-title">Sample bank</span>
            <span className="browser-meta">OP{opIndex + 1} · max {formatBytes(MAX_SAMPLE_BYTES)}</span>
          </div>
          <button type="button" className="btn help-close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <nav className="browser-tabs" aria-label="Browser location">
          <button
            type="button"
            className={`browser-tab${view === "cache" ? " is-active" : ""}`}
            onClick={() => setView("cache")}
          >
            Local cache
          </button>
          <button
            type="button"
            className={`browser-tab${view === "permission" || view === "import" ? " is-active" : ""}`}
            onClick={() => setView("permission")}
          >
            Device
          </button>
        </nav>

        <div className="browser-body">
          {view === "cache" && (
            <>
              <p className="browser-hint">
                Cached samples stay in this browser. Select one, then load into OP{opIndex + 1}.
              </p>
              <div className="browser-list" role="listbox">
                {items.length === 0 && (
                  <div className="browser-empty">
                    <span>// empty cache</span>
                    <span>Import a file under {formatBytes(MAX_SAMPLE_BYTES)} from Device.</span>
                  </div>
                )}
                {items.map((it) => (
                  <button
                    key={it.id}
                    type="button"
                    role="option"
                    aria-selected={selected === it.id}
                    className={`browser-row${selected === it.id ? " is-active" : ""}${
                      currentId === it.id ? " is-current" : ""
                    }`}
                    onClick={() => setSelected(it.id)}
                    onDoubleClick={() => {
                      setSelected(it.id);
                      void useSelected();
                    }}
                  >
                    <span className="browser-row-name">{it.name}</span>
                    <span className="browser-row-meta">
                      {formatBytes(it.size)} · {it.duration.toFixed(2)}s · {it.sampleRate}Hz
                      {currentId === it.id ? " · in use" : ""}
                    </span>
                  </button>
                ))}
              </div>
              <div className="browser-actions">
                <button
                  type="button"
                  className="btn primary"
                  disabled={!selected || busy}
                  onClick={() => void useSelected()}
                >
                  Load
                </button>
                <button
                  type="button"
                  className="btn"
                  disabled={!selected || busy}
                  onClick={() => void removeSelected()}
                >
                  Delete
                </button>
                <button type="button" className="btn" onClick={() => setView("permission")}>
                  Import…
                </button>
              </div>
            </>
          )}

          {view === "permission" && (
            <div className="browser-permission">
              <div className="browser-perm-icon" aria-hidden>
                <span>[::]</span>
              </div>
              <h3 className="browser-perm-title">Allow device files?</h3>
              <p className="browser-perm-body">
                KoolSynth Mini only reads audio you pick. Files must be under{" "}
                <strong>{formatBytes(MAX_SAMPLE_BYTES)}</strong> and are stored in this browser’s
                local cache — nothing uploads to a server.
              </p>
              <ul className="browser-perm-list">
                <li>WAV / MP3 / OGG / M4A (decoded in-browser)</li>
                <li>Hard cap {formatBytes(MAX_SAMPLE_BYTES)} per file</li>
                <li>You choose each file — no full-disk scan</li>
              </ul>
              <div className="browser-actions">
                <button type="button" className="btn primary" onClick={() => setView("import")}>
                  Allow &amp; choose file
                </button>
                <button type="button" className="btn" onClick={() => setView("cache")}>
                  Not now
                </button>
              </div>
            </div>
          )}

          {view === "import" && (
            <div className="browser-import">
              <p className="browser-hint">
                Drop a short clip or browse. Rejected if larger than {formatBytes(MAX_SAMPLE_BYTES)}.
              </p>
              <div
                className="browser-drop"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add("is-drag");
                }}
                onDragLeave={(e) => e.currentTarget.classList.remove("is-drag")}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove("is-drag");
                  const f = e.dataTransfer.files?.[0];
                  if (f) void ingestFile(f);
                }}
              >
                <span className="browser-drop-title">Drop audio here</span>
                <span className="browser-drop-sub">or</span>
                <button
                  type="button"
                  className="btn primary"
                  disabled={busy}
                  onClick={() => fileRef.current?.click()}
                >
                  Browse device…
                </button>
                <input
                  ref={fileRef}
                  type="file"
                  accept="audio/*,.wav,.mp3,.ogg,.m4a,.aif,.aiff"
                  hidden
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    e.target.value = "";
                    if (f) void ingestFile(f);
                  }}
                />
              </div>
              <div className="browser-actions">
                <button type="button" className="btn" onClick={() => setView("cache")}>
                  ← Back to cache
                </button>
              </div>
            </div>
          )}

          {error && <p className="browser-error">{error}</p>}
          {busy && <p className="browser-hint">Working…</p>}
        </div>
      </div>
    </div>
  );
}
