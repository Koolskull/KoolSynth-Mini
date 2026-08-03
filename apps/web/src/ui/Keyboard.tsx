import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { engineHost } from "../audio/engine-host";
import { keyToNote } from "../audio/pc-keymap";
import { noteBus } from "../audio/note-bus";
import { transport } from "../audio/transport";

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"] as const;

/** Visual span covers Z-row + Q-row (~2.5 octaves from current base) */
const KEYBOARD_SPAN = 30;

function isBlack(note: number): boolean {
  const n = note % 12;
  return n === 1 || n === 3 || n === 6 || n === 8 || n === 10;
}

function label(note: number): string {
  const name = NOTE_NAMES[note % 12]!;
  const oct = Math.floor(note / 12) - 1;
  return `${name}${oct}`;
}

function syncBendFromTransport(): void {
  engineHost.setPitchBend(transport.bendTarget);
}

export function Keyboard() {
  const [, tick] = useState(0);
  useEffect(() => noteBus.subscribe(() => tick((n) => n + 1)), []);
  useEffect(() => transport.subscribe(() => tick((n) => n + 1)), []);

  const low = transport.baseNote;
  const high = low + KEYBOARD_SPAN;

  const notes = useMemo(() => {
    const list: number[] = [];
    for (let n = low; n <= high; n++) list.push(n);
    return list;
  }, [low, high]);

  const press = useCallback(async (note: number, velocity = 0.85) => {
    await engineHost.resume();
    if (noteBus.press(note)) {
      engineHost.noteOn(note, velocity);
    } else {
      engineHost.noteOn(note, velocity);
    }
  }, []);

  const release = useCallback((note: number) => {
    if (noteBus.release(note)) {
      engineHost.noteOff(note);
    }
  }, []);

  // Renoise keys + bare arrow keys (octave / pitch bend)
  useEffect(() => {
    /** physical key code → MIDI note sounded at press (survives octave shift) */
    const downNotes = new Map<string, number>();

    const onDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (
        el &&
        (el.tagName === "INPUT" ||
          el.tagName === "SELECT" ||
          el.tagName === "TEXTAREA" ||
          el.isContentEditable)
      ) {
        return;
      }

      // Arrows: octave / pitch bend (no modifier)
      if (e.code === "ArrowUp" || e.code === "ArrowDown") {
        if (e.repeat) return;
        e.preventDefault();
        transport.shiftOctave(e.code === "ArrowUp" ? 1 : -1);
        return;
      }
      if (e.code === "ArrowLeft" || e.code === "ArrowRight") {
        e.preventDefault();
        if (e.code === "ArrowLeft") transport.setBendLeft(true);
        else transport.setBendRight(true);
        void engineHost.resume().then(() => syncBendFromTransport());
        return;
      }

      if (e.repeat) return;
      const note = keyToNote(e.key, transport.baseNote);
      if (note === null) return;
      e.preventDefault();
      const id = e.code || e.key;
      if (downNotes.has(id)) return;
      downNotes.set(id, note);
      void press(note);
    };

    const onUp = (e: KeyboardEvent) => {
      if (e.code === "ArrowLeft") {
        transport.setBendLeft(false);
        syncBendFromTransport();
      }
      if (e.code === "ArrowRight") {
        transport.setBendRight(false);
        syncBendFromTransport();
      }

      const id = e.code || e.key;
      const note = downNotes.get(id);
      if (note === undefined) return;
      downNotes.delete(id);
      release(note);
    };

    const onBlur = () => {
      for (const n of noteBus.snapshot()) {
        engineHost.noteOff(n);
      }
      noteBus.clear();
      downNotes.clear();
      transport.releaseBends();
      syncBendFromTransport();
    };

    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [press, release]);

  const pointerNote = useRef<number | null>(null);

  const onPointerDown = (note: number) => (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointerNote.current = note;
    const h = (e.currentTarget as HTMLElement).clientHeight || 140;
    void press(note, 0.45 + 0.55 * (1 - e.nativeEvent.offsetY / h));
  };

  const onPointerUp = () => {
    if (pointerNote.current !== null) {
      release(pointerNote.current);
      pointerNote.current = null;
    }
  };

  const onPointerEnter = (note: number) => (e: React.PointerEvent) => {
    if (e.buttons !== 1) return;
    if (pointerNote.current !== null && pointerNote.current !== note) {
      release(pointerNote.current);
    }
    pointerNote.current = note;
    void press(note);
  };

  return (
    <div className="keyboard-wrap">
      <div className="keyboard" onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
        {notes.map((note) => {
          const black = isBlack(note);
          const active = noteBus.isHeld(note);
          return (
            <div
              key={note}
              className={`key ${black ? "black" : "white"}${active ? " active" : ""}`}
              onPointerDown={onPointerDown(note)}
              onPointerEnter={onPointerEnter(note)}
            >
              {!black && note % 12 === 0 ? label(note) : ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}
