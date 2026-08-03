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
  const ops = base.operators.map((op) => ({
    ...op,
    enabled: op === base.operators[3],
    outLevel: op === base.operators[3] ? 1 : 0,
    amp: { attack: 0.001, decay: 0.001, sustain: 1, release: 0.01 },
  })) as typeof base.operators;
  const eng = new SynthEngine(48000, {
    ...base,
    operators: ops,
    links: [],
    fx: base.fx,
  });
  eng.noteOn(64, 1);
  const L = new Float32Array(128);
  const R = new Float32Array(128);
  eng.process(L, R);
  eng.noteOff(64);
  for (let i = 0; i < 200; i++) eng.process(L, R);
  let peak = 0;
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]!));
  expect(peak).toBeLessThan(0.05);
});

test("chord poly does not hard-clip peak absurdly", () => {
  const eng = new SynthEngine(48000, defaultPatch());
  for (const n of [48, 52, 55, 60, 64, 67]) eng.noteOn(n, 0.9);
  const L = new Float32Array(2048);
  const R = new Float32Array(2048);
  for (let i = 0; i < 20; i++) eng.process(L, R);
  eng.process(L, R);
  let peak = 0;
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]!));
  expect(peak).toBeGreaterThan(0.01);
  expect(peak).toBeLessThanOrEqual(1.05);
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
});

test("four operators and algorithm 7 still sound", () => {
  const eng = new SynthEngine(48000, defaultPatch());
  eng.setPatch({ algorithm: 7 });
  eng.noteOn(60, 0.8);
  const L = new Float32Array(1024);
  const R = new Float32Array(1024);
  for (let i = 0; i < 10; i++) eng.process(L, R);
  let peak = 0;
  for (let i = 0; i < L.length; i++) peak = Math.max(peak, Math.abs(L[i]!));
  expect(peak).toBeGreaterThan(0.001);
});
