/**
 * Renoise / tracker-style PC keyboard map.
 *
 * Lower row (Z-row): one octave starting at base C
 * Upper row (Q-row): octave above
 *
 * Q 2 W 3 E R 5 T 6 Y 7 U I 9 O 0 P
 * Z S X D C V G B H N J M , . /
 */

/** Semitone offsets from base C for each physical key */
const Z_ROW: Record<string, number> = {
  z: 0,
  s: 1,
  x: 2,
  d: 3,
  c: 4,
  v: 5,
  g: 6,
  b: 7,
  h: 8,
  n: 9,
  j: 10,
  m: 11,
  ",": 12,
  ".": 13,
  "/": 14,
};

const Q_ROW: Record<string, number> = {
  q: 12, // one octave above Z-row C → same as Z+12, but also extends higher
  "2": 13,
  w: 14,
  "3": 15,
  e: 16,
  r: 17,
  "5": 18,
  t: 19,
  "6": 20,
  y: 21,
  "7": 22,
  u: 23,
  i: 24,
  "9": 25,
  o: 26,
  "0": 27,
  p: 28,
  "[": 29,
  "]": 30,
};

/** Default: Z = C3 (MIDI 48), Q-row starts C4 (60) */
export const DEFAULT_BASE_NOTE = 48;

export function keyToNote(key: string, baseNote = DEFAULT_BASE_NOTE): number | null {
  const k = key.length === 1 ? key.toLowerCase() : key;
  if (k in Z_ROW) return baseNote + Z_ROW[k]!;
  if (k in Q_ROW) return baseNote + Q_ROW[k]!;
  // also accept uppercase via toLowerCase on single chars; number keys as-is
  const lower = key.toLowerCase();
  if (lower in Z_ROW) return baseNote + Z_ROW[lower]!;
  if (lower in Q_ROW) return baseNote + Q_ROW[lower]!;
  return null;
}

/** Keys that are part of the musical map (for preventDefault) */
export function isMusicKey(key: string): boolean {
  return keyToNote(key) !== null;
}
