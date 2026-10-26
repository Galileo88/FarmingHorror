// One shared palette keeps every sprite looking like it came from the same artist.
// Each character in the sprite strings in art.js maps to one of these colors.
FH.PAL = {
  '.': null,       // transparent
  k: '#1a1423',    // outline
  K: '#2d2438',    // dark shade
  g: '#4a7a3d',    // grass
  G: '#6a9a4b',    // grass light
  h: '#355c34',    // grass dark / stems
  b: '#6b4430',    // soil
  B: '#4a2e22',    // soil dark
  n: '#8a5a3c',    // wood
  N: '#b07a4f',    // wood light
  o: '#e07b2c',    // orange
  O: '#f2a541',    // orange light
  d: '#b5501c',    // orange dark
  r: '#a83232',    // red
  R: '#d95763',    // pink / red light
  y: '#f4d35e',    // yellow
  Y: '#fff3b0',    // pale yellow
  l: '#7fbf5a',    // leaf
  L: '#a8d672',    // leaf light
  s: '#f2c9a0',    // skin
  S: '#c98e6a',    // skin shade
  c: '#3f5f9f',    // denim
  C: '#5b82c4',    // denim light
  p: '#9a9aa8',    // stone
  P: '#c4c4cc',    // stone light
  q: '#5f5f70',    // stone dark
  z: '#7e9a5a',    // zombie skin
  Z: '#a4b97a',    // zombie skin light
  x: '#4f6340',    // zombie dark
  v: '#5a3d6b',    // purple cloth
  V: '#7b5a8c',    // purple light
  e: '#e8e8e8',    // white
  i: '#ff3a2e',    // glowing red eye
  u: '#2a2a34',    // crow
  U: '#4a4a62',    // crow highlight
  m: '#d9a441',    // straw
  M: '#f0c870',    // straw light
  t: '#8c6a3c',    // hat brown
  a: '#c6b07a',    // burlap
  A: '#e0d0a0',    // burlap light / paper
  f: '#6a6a7a',    // metal
  F: '#a8a8b8',    // metal light
  w: '#2f4a2c',    // graveyard grass
  W: '#3c5a36'     // graveyard grass light
};

// Handy numeric versions for tints and lights
FH.COLOR = {
  outline: 0x1a1423,
  white: 0xffffff,
  text: 0xf4ecd8,
  gold: 0xf4d35e,
  red: 0xd95763,
  green: 0xa8d672,
  gray: 0x9a9aa8,
  night: 0x23264f
};
