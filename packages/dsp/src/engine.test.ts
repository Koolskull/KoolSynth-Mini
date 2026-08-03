import { test, expect } from "bun:test";
import { SynthEngine } from "./engine";
import { defaultPatch, midiToHz } from "./types";

test("midiToHz A4 is 440", () => {
  expect(midiToHz(69)).toBeCloseTo(440, 5);
});

test("engine produces non-silent output on noteOn", () => {
  const eng = new SynthEngine(48000, defaultPatch());
  eng.noteOn(60, 0.8);
  const L = new Float32Array(512);
  const R = new Float32Array(512);
  eng.process(L, R);
  let peak = 0;
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]!));
  expect(peak).toBeGreaterThan(0.001);
});

test("noteOff eventually silences", () => {
  const base = defaultPatch();
  const eng = new SynthEngine(48000, {
    ...base,
    oscillators: [
      {
        ...base.oscillators[0],
        amp: { attack: 0.001, decay: 0.001, sustain: 1, release: 0.01 },
      },
      {
        ...base.oscillators[1],
        amp: { attack: 0.001, decay: 0.001, sustain: 1, release: 0.01 },
        enabled: false,
      },
      {
        ...base.oscillators[2],
        amp: { attack: 0.001, decay: 0.001, sustain: 1, release: 0.01 },
        enabled: false,
      },
    ],
  });
  eng.noteOn(64, 1);
  const L = new Float32Array(128);
  const R = new Float32Array(128);
  eng.process(L, R);
  eng.noteOff(64);
  // run release (min ~3ms + exp tail)
  for (let i = 0; i < 200; i++) eng.process(L, R);
  let peak = 0;
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]!));
  expect(peak).toBeLessThan(0.02);
});

test("chord poly does not hard-clip peak absurdly", () => {
  const eng = new SynthEngine(48000, defaultPatch());
  for (const n of [48, 52, 55, 60, 64, 67]) eng.noteOn(n, 0.9);
  const L = new Float32Array(2048);
  const R = new Float32Array(2048);
  // let attack settle
  for (let i = 0; i < 20; i++) eng.process(L, R);
  eng.process(L, R);
  let peak = 0;
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]!));
  expect(peak).toBeGreaterThan(0.01);
  expect(peak).toBeLessThanOrEqual(1.01);
});

test("pitch bend moves toward target", () => {
  const eng = new SynthEngine(48000, {
    ...defaultPatch(),
    pitchBendRange: 12,
    pitchBendLegato: 0.01,
  });
  eng.setPitchBend(1);
  const L = new Float32Array(256);
  const R = new Float32Array(256);
  for (let i = 0; i < 100; i++) eng.process(L, R);
  expect(eng.getPitchBend()).toBeGreaterThan(0.9);
  eng.setPitchBend(0);
  for (let i = 0; i < 100; i++) eng.process(L, R);
  expect(Math.abs(eng.getPitchBend())).toBeLessThan(0.15);
});
